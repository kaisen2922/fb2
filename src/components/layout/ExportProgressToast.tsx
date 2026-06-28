/**
 * ExportProgressToast.tsx
 *
 * A fixed-position, non-intrusive progress toast that tracks the lifecycle of
 * a Snapshot Export operation in real time.
 *
 * Renders as:
 *   - Hidden when phase === 'idle'
 *   - A compact progress card (bottom-left) for all active phases
 *   - A success card with the filename when phase === 'done'
 *   - An error card with the reason when phase === 'error'
 *
 * Subscribes directly to the snapshotExport event bus — zero Zustand writes,
 * zero impact on the streaming telemetry pipeline.
 */

import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  Database,
  FileDown,
  X,
} from 'lucide-react';
import { onExportStatus, cancelExport } from '../../utils/snapshotExport';
import type { ExportStatus } from '../../utils/snapshotExport';

// Phase metadata lookup
const PHASE_META: Record<
  ExportStatus['phase'],
  { label: string; subLabel: (s: ExportStatus) => string; color: string; borderColor: string }
> = {
  idle: {
    label: '',
    subLabel: () => '',
    color: 'text-gray-400',
    borderColor: 'border-gray-800',
  },
  extracting: {
    label: 'Extracting Data',
    subLabel: s => `Reading ${s.rowCount.toLocaleString()} rows from registry…`,
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
  },
  serializing: {
    label: 'Serializing CSV',
    subLabel: s => `${s.percent}% — ${s.rowCount.toLocaleString()} rows off-thread…`,
    color: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
  },
  downloading: {
    label: 'Preparing Download',
    subLabel: () => 'Creating Blob URL…',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
  },
  done: {
    label: 'Snapshot Ready',
    subLabel: s => s.filename,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
  },
  error: {
    label: 'Export Failed',
    subLabel: s => s.errorMessage ?? 'Unknown error',
    color: 'text-red-400',
    borderColor: 'border-red-500/30',
  },
};

const SpinnerIcon = () => (
  <Loader2 size={16} className="text-cyan-400 animate-spin" />
);

const PhaseIcon = ({ phase }: { phase: ExportStatus['phase'] }) => {
  switch (phase) {
    case 'extracting': return <Database size={16} className="text-cyan-400" />;
    case 'serializing': return <SpinnerIcon />;
    case 'downloading': return <FileDown size={16} className="text-emerald-400" />;
    case 'done':        return <CheckCircle2 size={16} className="text-emerald-400" />;
    case 'error':       return <XCircle size={16} className="text-red-400" />;
    default:            return <Download size={16} className="text-gray-400" />;
  }
};

export const ExportProgressToast = memo(() => {
  const [status, setStatus] = useState<ExportStatus>({
    phase: 'idle',
    percent: 0,
    rowCount: 0,
    filename: '',
  });

  // Subscribe to the export event bus — no Zustand, no re-render cascade
  useEffect(() => {
    const unsub = onExportStatus(setStatus);
    return unsub;
  }, []);

  const isVisible = status.phase !== 'idle';
  const meta = PHASE_META[status.phase];
  const isActive = status.phase === 'extracting' || status.phase === 'serializing' || status.phase === 'downloading';
  const isDone  = status.phase === 'done';
  const isError = status.phase === 'error';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="export-toast"
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          exit={{   opacity: 0, y: 24,  scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`
            fixed bottom-6 left-6 z-50 w-[340px]
            bg-slate-900/95 backdrop-blur-md
            border rounded-xl shadow-2xl
            overflow-hidden
            ${meta.borderColor}
          `}
          role="status"
          aria-live="polite"
        >
          {/* Progress bar strip — only shown during active phases */}
          {isActive && (
            <div className="w-full h-0.5 bg-slate-800">
              <motion.div
                className="h-full bg-cyan-500"
                initial={{ width: '0%' }}
                animate={{ width: `${status.percent || 15}%` }}
                transition={{ ease: 'linear', duration: 0.3 }}
              />
            </div>
          )}

          {/* Done: green accent strip */}
          {isDone && <div className="w-full h-0.5 bg-emerald-500" />}

          {/* Error: red accent strip */}
          {isError && <div className="w-full h-0.5 bg-red-500" />}

          {/* Content */}
          <div className="p-4 flex items-start gap-3">
            {/* Icon */}
            <div className={`
              mt-0.5 p-2 rounded-lg border flex items-center justify-center flex-shrink-0
              ${isDone  ? 'bg-emerald-500/10 border-emerald-500/20' :
                isError ? 'bg-red-500/10 border-red-500/20'         :
                          'bg-cyan-500/10 border-cyan-500/20'}
            `}>
              <PhaseIcon phase={status.phase} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}>
                  {meta.label}
                </p>
                {/* Percentage badge — only during serializing */}
                {status.phase === 'serializing' && (
                  <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 flex-shrink-0">
                    {status.percent}%
                  </span>
                )}
              </div>

              <p className="text-[11px] text-gray-400 mt-1 truncate leading-relaxed">
                {meta.subLabel(status)}
              </p>

              {/* Row count badge */}
              {isActive && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
                  <span className="h-1 w-1 rounded-full bg-cyan-500 animate-pulse" />
                  <span>Snapshot Export · {status.rowCount.toLocaleString()} rows</span>
                </div>
              )}

              {/* Done: shortcut reminder */}
              {isDone && (
                <p className="mt-1.5 text-[10px] text-gray-500 font-mono">
                  Check your Downloads folder
                </p>
              )}
            </div>

            {/* Dismiss / cancel button */}
            <button
              onClick={isActive ? cancelExport : () => {
                // Manually reset to idle on dismiss for done/error states
                // (the done auto-reset timer will also fire, this is just immediate)
                cancelExport();
              }}
              className="flex-shrink-0 mt-0.5 text-gray-600 hover:text-white transition-colors cursor-pointer rounded p-0.5 hover:bg-gray-800"
              title={isActive ? 'Cancel export' : 'Dismiss'}
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default ExportProgressToast;
