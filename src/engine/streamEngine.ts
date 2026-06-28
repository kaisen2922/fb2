import { pushToQueue, startQueueProcessor } from './queueEngine';
import { parseRpaProjectsCsv } from '../utils/csv';
import { useDashboardStore } from '../store/useDashboardStore';

// Strict initialization guard for step 2
let isStreamConnected = false;

// Monkey-patch window.fetch to map the CSV header "annual_savings_usd" to "annual_revenue_usd".
// Uses a streaming TransformStream so we never buffer the entire 9MB CSV into RAM.
// Only the first chunk (which always contains the header line) is modified.
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input as URL).href || '';
    if (url.includes('automation_projects.csv')) {
      try {
        const response = await originalFetch(input, init);
        if (response.ok && response.body) {
          let headerPatched = false;
          const decoder = new TextDecoder();
          const encoder = new TextEncoder();

          const transformed = new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              if (!headerPatched) {
                // The header is always in the first chunk — replace just once
                let text = decoder.decode(chunk, { stream: true });
                text = text.replace('annual_savings_usd', 'annual_revenue_usd');
                headerPatched = true;
                controller.enqueue(encoder.encode(text));
              } else {
                controller.enqueue(chunk);
              }
            }
          });

          const patchedBody = response.body.pipeThrough(transformed);
          return new Response(patchedBody, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
      } catch (err) {
        console.error('📡 [Fetch Interceptor] Interceptor failed, falling back to original fetch:', err);
      }
    }
    return originalFetch(input, init);
  };
}

/**
 * Orchestrates connection between global initializeRpaStream and Zustand dashboard store.
 */
export const connectRpaStream = async (csvUrl = './automation_projects.csv') => {
  // Step 2 Guard check
  if (isStreamConnected) {
    console.warn('⚠️ [Stream Engine] connectRpaStream was called multiple times. Skipping duplicate connection request.');
    return;
  }
  isStreamConnected = true;

  console.log('🔗 [Stream Engine] Establishing connection to telemetry stream...');

  // 1. Initial Load: Parse the full CSV for 50,000 baseline items on startup
  try {
    console.log(`📦 [Stream Engine] Fetching CSV data from ${csvUrl}...`);
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Failed to load baseline CSV: ${response.statusText}`);
    }
    const text = await response.text();
    const baselineProjects = parseRpaProjectsCsv(text);
    
    console.log(`📦 [Stream Engine] CSV Loaded. Rows parsed: ${baselineProjects.length}`);
    useDashboardStore.getState().initializeData(baselineProjects);
    console.log('✅ [Stream Engine] Initial store loaded with baseline projects.');
  } catch (error) {
    console.error('❌ [Stream Engine] Error loading baseline CSV:', error);
  }

  // 2. Start the processing loop
  startQueueProcessor();
  console.log('⚙️ [Stream Engine] Double-buffered Queue Processor started.');

  // 3. Connect to the high-frequency stream firehose
  const win = window as any;
  if (typeof win.initializeRpaStream === 'function') {
    console.log('📡 [Stream Engine] Found window.initializeRpaStream hook, starting stream listener...');
    win.initializeRpaStream((incomingBatch: any[]) => {
      // Guard: Discard incoming updates when paused to prevent queue memory leaks
      if (useDashboardStore.getState().isStreamPaused) {
        return;
      }
      
      // Direct push to double-buffered queue
      pushToQueue(incomingBatch);
    }, csvUrl);
    console.log('🚀 [Stream Engine] Telemetry stream registered and connected successfully.');
  } else {
    console.error(
      '❌ [Stream Engine] window.initializeRpaStream is not defined. Ensure dataStream.js is loaded in index.html.'
    );
  }
};
