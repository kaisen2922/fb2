/**
 * snapshotExport.ts
 *
 * Non-blocking "Snapshot Export" coordinator.
 *
 * Responsibilities:
 *  1. Reads the current filteredUids (already sorted + filtered by the store)
 *     and resolves them from the projectRegistry Map — O(n) Map lookups, fast.
 *  2. Passes the resolved plain array to a CSV Web Worker for off-main-thread
 *     serialization — the dashboard stream continues unaffected.
 *  3. Emits fine-grained ExportStatus events that any React component can
 *     subscribe to via `onExportStatus()`.
 *  4. On worker completion, creates a Blob URL and triggers a browser download.
 *  5. Guards against concurrent export runs (only one at a time).
 */

import { projectRegistry } from '../store/useDashboardStore';
import type { AutomationProject } from '../types';

// ─── Column definitions for the snapshot ─────────────────────────────────────
// The snapshot always exports ALL data columns regardless of table visibility,
// giving the operator a complete data picture.
export interface SnapshotColumn {
  id: keyof AutomationProject;
  label: string;
}

export const SNAPSHOT_COLUMNS: SnapshotColumn[] = [
  { id: 'project_id',            label: 'Project ID' },
  { id: 'project_name',          label: 'Project Name' },
  { id: 'company_id',            label: 'Company ID' },
  { id: 'project_status',        label: 'Status' },
  { id: 'automation_type',       label: 'Automation Type' },
  { id: 'department',            label: 'Department' },
  { id: 'industry',              label: 'Industry' },
  { id: 'country',               label: 'Country' },
  { id: 'implementation_partner',label: 'Implementation Partner' },
  { id: 'robots_deployed',       label: 'Robots Deployed' },
  { id: 'budget_usd',            label: 'Budget (USD)' },
  { id: 'annual_savings_usd',    label: 'Annual Savings (USD)' },
  { id: 'roi_percent',           label: 'ROI (%)' },
  { id: 'employee_hours_saved',  label: 'Employee Hours Saved' },
  { id: 'ai_enabled',            label: 'AI Enabled' },
  { id: 'cloud_deployment',      label: 'Cloud Deployment' },
  { id: 'start_date',            label: 'Start Date' },
  { id: 'completion_date',       label: 'Completion Date' },
];

// ─── Progress event bus ───────────────────────────────────────────────────────

export type ExportPhase = 'idle' | 'extracting' | 'serializing' | 'downloading' | 'done' | 'error';

export interface ExportStatus {
  phase: ExportPhase;
  /** 0–100. Only meaningful during 'serializing'. */
  percent: number;
  /** Number of rows being exported */
  rowCount: number;
  /** Generated filename (available once download triggers) */
  filename: string;
  /** Human-readable error message on phase === 'error' */
  errorMessage?: string;
}

type StatusListener = (status: ExportStatus) => void;

const _listeners = new Set<StatusListener>();
let _current: ExportStatus = { phase: 'idle', percent: 0, rowCount: 0, filename: '' };

/** Subscribe to export status events. Returns an unsubscribe function. */
export const onExportStatus = (fn: StatusListener): (() => void) => {
  _listeners.add(fn);
  // Immediately deliver current status to new subscriber
  fn(_current);
  return () => _listeners.delete(fn);
};

const _emit = (patch: Partial<ExportStatus>) => {
  _current = { ..._current, ...patch };
  _listeners.forEach(fn => fn(_current));
};

// ─── Worker lifecycle ─────────────────────────────────────────────────────────

let _activeWorker: Worker | null = null;

/** True when an export is currently in progress. */
export const isExporting = (): boolean =>
  _current.phase !== 'idle' && _current.phase !== 'done' && _current.phase !== 'error';

/** Cancel the in-flight export (if any). */
export const cancelExport = (): void => {
  if (_activeWorker) {
    _activeWorker.terminate();
    _activeWorker = null;
  }
  _emit({ phase: 'idle', percent: 0, rowCount: 0, filename: '' });
};

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Triggers a non-blocking snapshot export.
 *
 * @param filteredUids  The ordered array of UIDs from the store's filteredUids
 *                      (already reflects the operator's current sort + filter state).
 */
export const triggerSnapshotExport = (filteredUids: string[]): void => {
  // Guard: only one export at a time
  if (isExporting()) {
    console.warn('[SnapshotExport] Export already in progress — ignoring duplicate request.');
    return;
  }

  // ── PHASE 1: Extract data from registry (sync, fast — O(n) Map lookups) ──
  _emit({ phase: 'extracting', percent: 0, rowCount: filteredUids.length, filename: '' });

  // Use setTimeout(0) to yield to the browser before the extraction loop,
  // ensuring the "extracting" toast renders before we occupy the main thread.
  setTimeout(() => {
    // Build a plain-object array from the registry — structured-clone safe.
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < filteredUids.length; i++) {
      const project = projectRegistry.get(filteredUids[i]);
      if (project) {
        // Copy only the columns we'll serialize (avoids sending the full object)
        const row: Record<string, unknown> = {};
        for (const col of SNAPSHOT_COLUMNS) {
          row[col.id] = (project as unknown as Record<string, unknown>)[col.id];
        }
        rows.push(row);
      }
    }

    // ── PHASE 2: Hand off to Web Worker for off-thread serialization ──
    _emit({ phase: 'serializing', percent: 0, rowCount: rows.length });

    // Spawn the CSV worker via Vite's worker import syntax
    const worker = new Worker(
      new URL('../workers/csvWorker.ts', import.meta.url),
      { type: 'module' }
    );
    _activeWorker = worker;

    worker.onmessage = (e: MessageEvent) => {
      const { type, percent, csv, message } = e.data;

      if (type === 'progress') {
        _emit({ phase: 'serializing', percent: percent as number });
        return;
      }

      if (type === 'done') {
        worker.terminate();
        _activeWorker = null;

        // ── PHASE 3: Create Blob URL and trigger download ──
        _emit({ phase: 'downloading', percent: 100 });

        const filename = buildFilename(filteredUids.length);
        try {
          const blob = new Blob([csv as string], { type: 'text/csv;charset=utf-8;' });
          const url  = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href  = url;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Revoke the object URL after the browser has had time to initiate the download
          setTimeout(() => URL.revokeObjectURL(url), 10_000);

          _emit({ phase: 'done', percent: 100, filename });

          // Auto-reset to idle after 6 s so the toast disappears
          setTimeout(() => {
            if (_current.phase === 'done') {
              _emit({ phase: 'idle', percent: 0, filename: '' });
            }
          }, 6_000);
        } catch (err) {
          _emit({
            phase: 'error',
            percent: 0,
            errorMessage: err instanceof Error ? err.message : 'Download failed',
          });
        }
        return;
      }

      if (type === 'error') {
        worker.terminate();
        _activeWorker = null;
        _emit({
          phase: 'error',
          percent: 0,
          errorMessage: message as string ?? 'Worker serialization error',
        });
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      _activeWorker = null;
      _emit({ phase: 'error', percent: 0, errorMessage: err.message });
    };

    // Transfer the column spec and rows to the worker
    worker.postMessage({ rows, columns: SNAPSHOT_COLUMNS });
  }, 0);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildFilename = (rowCount: number): string => {
  const now  = new Date();
  const pad  = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `rpa_snapshot_${date}_${time}_${rowCount}rows.csv`;
};
