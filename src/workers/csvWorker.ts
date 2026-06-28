/**
 * csvWorker.ts
 * Web Worker for non-blocking CSV serialization.
 *
 * Message IN  (from main thread):
 *   { rows: Record<string, unknown>[], columns: { id: string; label: string }[] }
 *
 * Messages OUT (to main thread):
 *   { type: 'progress', percent: number }    — emitted after every chunk
 *   { type: 'done',     csv: string }        — final complete CSV string
 *   { type: 'error',    message: string }    — on unexpected failure
 */

const CHUNK_SIZE = 2_000; // rows processed per tick — keeps UI at 60 FPS

/**
 * Escape a single CSV cell value per RFC 4180.
 * Wraps in double-quotes if the value contains a comma, double-quote, or newline.
 */
function escapeCell(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const str = String(raw);
  // Only quote when necessary (avoids bloating the output size)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

self.onmessage = (e: MessageEvent) => {
  try {
    const { rows, columns } = e.data as {
      rows: Record<string, unknown>[];
      columns: { id: string; label: string }[];
    };

    const total = rows.length;
    // Pre-build header line once
    const header = columns.map(c => escapeCell(c.label)).join(',');
    // Pre-allocate lines array (header + all rows) for one final join
    const lines: string[] = [header];

    let i = 0;

    const processChunk = () => {
      const end = Math.min(i + CHUNK_SIZE, total);

      for (; i < end; i++) {
        const row = rows[i];
        let line = '';
        for (let col = 0; col < columns.length; col++) {
          if (col > 0) line += ',';
          line += escapeCell(row[columns[col].id]);
        }
        lines.push(line);
      }

      // Report progress after every chunk
      (self as unknown as Worker).postMessage({
        type: 'progress',
        percent: total === 0 ? 100 : Math.round((i / total) * 100),
      });

      if (i < total) {
        // Yield back to the Worker event loop before the next chunk.
        // This keeps the worker responsive to future cancellation messages.
        setTimeout(processChunk, 0);
      } else {
        // All rows processed — send the completed CSV
        (self as unknown as Worker).postMessage({
          type: 'done',
          csv: lines.join('\n'),
        });
      }
    };

    processChunk();
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
