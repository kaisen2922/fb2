import type { AutomationProject, TelemetryActivity, TelemetryAlert } from '../types';
import { useDashboardStore, projectRegistry } from '../store/useDashboardStore';
import { formatCurrency, formatPercent } from '../utils/format';
import { rowEmitter } from './rowEmitter';

// In-memory queue buffer
let queue: AutomationProject[] = [];
let isProcessing = false;
let processedRowsInLastSec = 0;
let lastProcessFrameTime = performance.now();
const MAX_PROCESS_BATCH = 1;
const PROCESS_INTERVAL_MS = 2000;
const UI_FLUSH_INTERVAL_MS = 5000;

// UI update throttling variables (React UI updates at most once every 5s)
let accumulatedBatch: AutomationProject[] = [];
let accumulatedActivities: TelemetryActivity[] = [];
let accumulatedAlerts: TelemetryAlert[] = [];
let accumulatedSavingsDelta = 0;
let accumulatedRobotsDelta = 0;
let accumulatedRoiSumDelta = 0;
let accumulatedHoursDelta = 0;
let lastUiUpdateTime = performance.now();
let lastRenderTime = 0;

// Export queue length for telemetry
export const getQueueSize = () => queue.length;

/**
 * Pushes a telemetry batch into the processing buffer queue.
 */
export const pushToQueue = (batch: AutomationProject[]) => {
  queue.push(...batch);
  if (queue.length > 500) {
    // Keep only the latest 500 items to avoid backlog explosion under background tab suspension (Step 9)
    queue = queue.slice(-500);
    console.warn(`⚠️ [Queue Engine] Queue overflow. Pruned to latest 500 items.`);
  }
};

/**
 * Custom ID generator
 */
const generateId = () => Math.random().toString(36).substring(2, 11);

/**
 * Simulates high-fidelity RPA changes for projects selected by dataStream.js.
 * Transforms raw telemetry ticks into realistic enterprise dashboard events.
 * Alerts and activities are only triggered on state transitions.
 */
const processTelemetryItem = (
  rawItem: AutomationProject,
  currentProject: AutomationProject | undefined
): { 
  project: AutomationProject; 
  activities: TelemetryActivity[]; 
  alerts: TelemetryAlert[]; 
  sDelta: number;
  rDelta: number;
  roiDelta: number;
  hDelta: number;
} => {
  const activities: TelemetryActivity[] = [];
  const alerts: TelemetryAlert[] = [];

  const base = currentProject ? currentProject : { ...rawItem };

  const budgetVal = typeof rawItem.budget_usd === 'string' ? parseInt(rawItem.budget_usd, 10) || 0 : rawItem.budget_usd;
  
  const savingsVal = typeof rawItem.annual_revenue_usd === 'string' 
    ? parseInt(rawItem.annual_revenue_usd, 10) || 0 
    : typeof rawItem.annual_revenue_usd === 'number' && !isNaN(rawItem.annual_revenue_usd)
      ? rawItem.annual_revenue_usd 
      : typeof rawItem.annual_savings_usd === 'string'
        ? parseInt(rawItem.annual_savings_usd, 10) || 0
        : rawItem.annual_savings_usd || 0;

  const robotsVal = typeof rawItem.robots_deployed === 'string' ? parseInt(rawItem.robots_deployed, 10) || 0 : rawItem.robots_deployed;
  const hoursVal = typeof rawItem.employee_hours_saved === 'string' ? parseInt(rawItem.employee_hours_saved, 10) || 0 : rawItem.employee_hours_saved;

  let roiVal = 0.0;
  if (typeof rawItem.roi_percent === 'string') {
    roiVal = parseFloat(rawItem.roi_percent) || 0.0;
  } else if (typeof rawItem.roi_percent === 'number' && !isNaN(rawItem.roi_percent)) {
    roiVal = rawItem.roi_percent;
  } else {
    roiVal = budgetVal > 0 ? parseFloat(((savingsVal / budgetVal) * 100).toFixed(1)) : 0.0;
  }

  // Calculate O(1) deltas before mutating values
  let sDelta = 0;
  let rDelta = 0;
  let roiDelta = 0;
  let hDelta = 0;

  if (currentProject) {
    sDelta = savingsVal - currentProject.annual_savings_usd;
    rDelta = robotsVal - currentProject.robots_deployed;
    roiDelta = roiVal - currentProject.roi_percent;
    hDelta = hoursVal - currentProject.employee_hours_saved;
  } else {
    sDelta = savingsVal;
    rDelta = robotsVal;
    roiDelta = roiVal;
    hDelta = hoursVal;
  }

  const oldBudget = currentProject ? currentProject.budget_usd : rawItem.budget_usd;
  const oldSavings = currentProject ? currentProject.annual_savings_usd : savingsVal;

  // In-place updates
  base.budget_usd = budgetVal;
  base.annual_savings_usd = savingsVal;
  base.annual_revenue_usd = savingsVal;
  base.robots_deployed = robotsVal;
  base.employee_hours_saved = hoursVal;
  base.roi_percent = roiVal;

  // Anomaly simulation
  const isAnomaly = Math.random() > 0.95; 

  if (isAnomaly) {
    const anomalyType = Math.random();
    
    if (anomalyType < 0.35 && base.project_status === 'Active') {
      base.project_status = 'Failed';
      
      activities.push({
        id: generateId(),
        type: 'project_failed',
        project_id: base.project_id,
        project_name: base.project_name,
        message: `⚠️ Project "${base.project_name}" critical crash reported in "${base.department}".`,
        timestamp: Date.now(),
        details: `Implementation partner: ${base.implementation_partner}`
      });

      alerts.push({
        id: generateId(),
        project_id: base.project_id,
        project_name: base.project_name,
        type: 'failed_project',
        message: `Critical Error: Automation project "${base.project_name}" failed!`,
        timestamp: Date.now(),
        severity: 'critical',
        read: false,
        value: 'Failed'
      });
    } else if (anomalyType < 0.7) {
      const oldRoi = currentProject ? currentProject.roi_percent : 0;
      base.roi_percent = parseFloat((-Math.random() * 45).toFixed(1)); 
      
      if (oldRoi >= 0) {
        activities.push({
          id: generateId(),
          type: 'roi_changed',
          project_id: base.project_id,
          project_name: base.project_name,
          message: `📉 ROI dropped into negative bounds for "${base.project_name}": ${formatPercent(base.roi_percent)}`,
          timestamp: Date.now()
        });

        alerts.push({
          id: generateId(),
          project_id: base.project_id,
          project_name: base.project_name,
          type: 'negative_roi',
          message: `Negative ROI alert on "${base.project_name}": ${formatPercent(base.roi_percent)}`,
          timestamp: Date.now(),
          severity: 'warning',
          read: false,
          value: formatPercent(base.roi_percent)
        });
      }
    } else {
      const costIncrease = Math.floor(Math.random() * 200000) + 100000;
      base.budget_usd += costIncrease;
      
      if (Math.random() > 0.8) {
        activities.push({
          id: generateId(),
          type: 'savings_updated',
          project_id: base.project_id,
          project_name: base.project_name,
          message: `💸 Budget increased for "${base.project_name}" to ${formatCurrency(base.budget_usd)}`,
          timestamp: Date.now()
        });
      }
      
      const wasExceeded = oldBudget > oldSavings;
      const isExceeded = base.budget_usd > base.annual_savings_usd;
      if (isExceeded && !wasExceeded) {
        alerts.push({
          id: generateId(),
          project_id: base.project_id,
          project_name: base.project_name,
          type: 'budget_exceeded',
          message: `Budget Exceeded: "${base.project_name}" cost (${formatCurrency(base.budget_usd)}) exceeds annual savings (${formatCurrency(base.annual_savings_usd)})`,
          timestamp: Date.now(),
          severity: 'warning',
          read: false,
          value: formatCurrency(base.budget_usd)
        });
      }
    }
  } else {
    // Normal noise updates
    const noiseType = Math.random();
    const shouldLogActivity = Math.random() > 0.96; 

    if (noiseType < 0.3) {
      const savingsDelta = Math.floor(Math.random() * 15000) + 5000;
      base.annual_savings_usd += savingsDelta;
      if (base.budget_usd > 0) {
        base.roi_percent = parseFloat(((base.annual_savings_usd / base.budget_usd) * 100).toFixed(1));
      }
      if (shouldLogActivity) {
        activities.push({
          id: generateId(),
          type: 'savings_updated',
          project_id: base.project_id,
          project_name: base.project_name,
          message: `📈 Annual savings updated for "${base.project_name}": +$${savingsDelta.toLocaleString()}`,
          timestamp: Date.now()
        });
      }
    } else if (noiseType < 0.6) {
      const robotDelta = Math.random() > 0.45 ? 1 : -1;
      const newRobots = Math.max(1, base.robots_deployed + robotDelta);
      
      if (newRobots !== base.robots_deployed) {
        base.robots_deployed = newRobots;
        if (shouldLogActivity) {
          activities.push({
            id: generateId(),
            type: 'robot_deployed',
            project_id: base.project_id,
            project_name: base.project_name,
            message: `🤖 Robot fleet adjusted for "${base.project_name}": ${robotDelta > 0 ? '+' : ''}${robotDelta} (Total: ${base.robots_deployed})`,
            timestamp: Date.now()
          });
        }
      }
    } else if (noiseType < 0.8) {
      const hoursDelta = Math.floor(Math.random() * 50) + 10;
      base.employee_hours_saved += hoursDelta;
      if (shouldLogActivity) {
        activities.push({
          id: generateId(),
          type: 'savings_updated',
          project_id: base.project_id,
          project_name: base.project_name,
          message: `⏳ Productivity boost on "${base.project_name}": +${hoursDelta} employee hours saved`,
          timestamp: Date.now()
        });
      }
    } else if (noiseType < 0.9 && base.project_status === 'Active') {
      base.project_status = 'Completed';
      activities.push({
        id: generateId(),
        type: 'project_completed',
        project_id: base.project_id,
        project_name: base.project_name,
        message: `🎉 Automation Project completed successfully: "${base.project_name}"`,
        timestamp: Date.now(),
        details: `Delivered by: ${base.implementation_partner}`
      });
    }
  }

  base.last_updated = Date.now();
  return { project: base, activities, alerts, sDelta, rDelta, roiDelta, hDelta };
};

/**
 * Initializes and loops the double-buffered queue batch processor.
 */
export const startQueueProcessor = () => {
  if (isProcessing) return;
  isProcessing = true;

  const processLoop = (timestamp: number) => {
    const elapsedSinceLastProcess = timestamp - lastProcessFrameTime;
    if (elapsedSinceLastProcess < PROCESS_INTERVAL_MS) {
      window.setTimeout(() => processLoop(performance.now()), PROCESS_INTERVAL_MS - elapsedSinceLastProcess);
      return;
    }
    lastProcessFrameTime = timestamp;

    // Process a chunk of updates
    if (queue.length > 0 && !useDashboardStore.getState().isStreamPaused) {
      const startTime = performance.now();
      
      const chunkSize = Math.min(queue.length, MAX_PROCESS_BATCH);
      const batchChunk = queue.splice(0, chunkSize); // Immediately removes processed rows (Step 9)

      // Optimize: Use high-speed for-loop instead of .forEach closure (Step 2)
      for (let i = 0; i < chunkSize; i++) {
        const rawItem = batchChunk[i];
        const currentProject = projectRegistry.get(rawItem.internal_uid);
        const { project, activities, alerts, sDelta, rDelta, roiDelta, hDelta } = processTelemetryItem(rawItem, currentProject);

        // Mutate registry Map directly in O(1) (Step 10)
        projectRegistry.set(rawItem.internal_uid, project);
        
        // Notify visible VirtualTableRow listeners instantly via pub/sub (O(1) updates)
        rowEmitter.emit(rawItem.internal_uid, project);

        // Accumulate updates for throttled UI flush
        accumulatedBatch.push(project);
        accumulatedActivities.push(...activities);
        accumulatedAlerts.push(...alerts);
        accumulatedSavingsDelta += sDelta;
        accumulatedRobotsDelta += rDelta;
        accumulatedRoiSumDelta += roiDelta;
        accumulatedHoursDelta += hDelta;
      }
      
      processedRowsInLastSec += chunkSize;

      const duration = performance.now() - startTime;
      lastRenderTime = parseFloat(duration.toFixed(2));
    }

    // Flush accumulated UI metrics to Zustand store at most once every 5s
    if (timestamp - lastUiUpdateTime >= UI_FLUSH_INTERVAL_MS) {
      // Compute diagnostics here — piggybacks on the same set() so only one React render fires
      let mem = 0;
      if ((performance as any).memory) {
        mem = Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024));
      } else {
        mem = Math.round(75 + Math.sin(timestamp / 15000) * 6 + (Math.random() - 0.5) * 1.5);
      }

      if (accumulatedBatch.length > 0) {
        useDashboardStore.getState().applyTelemetryBatch(
          accumulatedBatch,
          accumulatedActivities,
          accumulatedAlerts,
          accumulatedSavingsDelta,
          accumulatedRobotsDelta,
          accumulatedRoiSumDelta,
          accumulatedHoursDelta
        );

        // Reset accumulation buffers
        accumulatedBatch = [];
        accumulatedActivities = [];
        accumulatedAlerts = [];
        accumulatedSavingsDelta = 0;
        accumulatedRobotsDelta = 0;
        accumulatedRoiSumDelta = 0;
        accumulatedHoursDelta = 0;
      }

      // Single separate metrics set (low-frequency, outside the hot path)
      useDashboardStore.getState().updatePerformanceMetrics({
        memoryUsage: mem,
        queueSize: queue.length,
        domNodes: 0,
        rowsPerSec: processedRowsInLastSec,
        renderTime: lastRenderTime
      });
      processedRowsInLastSec = 0;

      lastUiUpdateTime = timestamp;
    }

    window.setTimeout(() => processLoop(performance.now()), PROCESS_INTERVAL_MS);
  };

  window.setTimeout(() => processLoop(performance.now()), PROCESS_INTERVAL_MS);
};
