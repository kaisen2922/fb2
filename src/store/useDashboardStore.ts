import { create } from 'zustand';
import type { 
  AutomationProject, 
  SortConfig, 
  DashboardFilters, 
  TelemetryAlert, 
  TelemetryActivity, 
  PerformanceMetrics,
  TableColumn
} from '../types';
import { filterProjects } from '../engine/filterEngine';
import { multiColumnSort } from '../engine/sorting';


// Global O(1) Data Registry Map: Excludes the 50,000 projects from React state copying
export const projectRegistry = new Map<string, AutomationProject>();

// Track the last time Recharts trend history was updated (Step 7)
let lastHistoryUpdateTime = 0;

export interface KpiMetrics {
  projects: number;
  savings: number;
  robots: number;
  roi: number;
  hours: number;
}

// Default columns and configurations
export const DEFAULT_COLUMNS: TableColumn[] = [
  { id: 'project_id', label: 'ID', width: 90, visible: true, sortable: true, resizable: true },
  { id: 'project_name', label: 'Project Name', width: 220, visible: true, sortable: true, resizable: true },
  { id: 'company_id', label: 'Company', width: 95, visible: true, sortable: true, resizable: true },
  { id: 'project_status', label: 'Status', width: 100, visible: true, sortable: true, resizable: true },
  { id: 'automation_type', label: 'Type', width: 160, visible: true, sortable: true, resizable: true },
  { id: 'robots_deployed', label: 'Bots', width: 75, visible: true, sortable: true, resizable: true },
  { id: 'budget_usd', label: 'Budget', width: 110, visible: true, sortable: true, resizable: true },
  { id: 'annual_savings_usd', label: 'Savings', width: 115, visible: true, sortable: true, resizable: true },
  { id: 'roi_percent', label: 'ROI', width: 90, visible: true, sortable: true, resizable: true },
  { id: 'department', label: 'Department', width: 155, visible: true, sortable: true, resizable: true },
  { id: 'implementation_partner', label: 'Partner', width: 160, visible: false, sortable: true, resizable: true },
  { id: 'country', label: 'Country', width: 110, visible: true, sortable: true, resizable: true },
  { id: 'industry', label: 'Industry', width: 160, visible: false, sortable: true, resizable: true },
  { id: 'employee_hours_saved', label: 'Hours Saved', width: 120, visible: true, sortable: true, resizable: true },
  { id: 'ai_enabled', label: 'AI', width: 70, visible: false, sortable: true, resizable: true },
  { id: 'cloud_deployment', label: 'Cloud', width: 85, visible: false, sortable: true, resizable: true }
];

const loadSettings = () => {
  try {
    const saved = localStorage.getItem('rpa_dashboard_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        theme: parsed.theme || 'dark',
        columnWidths: parsed.columnWidths || {},
        columnVisibility: parsed.columnVisibility || {},
        filters: parsed.filters || { departments: [], industries: [], automationTypes: [] },
      };
    }
  } catch (e) {
    console.error('Failed to load local storage settings', e);
  }
  return {
    theme: 'dark',
    columnWidths: DEFAULT_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.width }), {}),
    columnVisibility: DEFAULT_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.visible }), {}),
    filters: { departments: [], industries: [], automationTypes: [] },
  };
};

const savedSettings = loadSettings();

const computeDistributions = (filteredList: AutomationProject[]) => {
  const deptMap: Record<string, number> = {};
  const indMap: Record<string, number> = {};
  const countryMap: Record<string, number> = {};

  filteredList.forEach(p => {
    if (p.department) deptMap[p.department] = (deptMap[p.department] || 0) + 1;
    if (p.industry) indMap[p.industry] = (indMap[p.industry] || 0) + 1;
    if (p.country) countryMap[p.country] = (countryMap[p.country] || 0) + 1;
  });

  const mapToArr = (m: Record<string, number>) => 
    Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

  return {
    depts: mapToArr(deptMap).slice(0, 5),
    industries: mapToArr(indMap).slice(0, 5),
    countries: mapToArr(countryMap).slice(0, 5)
  };
};

interface DashboardState {
  // --- UI SLICE ---
  theme: 'dark' | 'light';
  isFullscreen: boolean;
  isCommandPaletteOpen: boolean;
  isSettingsOpen: boolean;
  isAlertHistoryOpen: boolean;
  selectedProjectIds: Set<string>;
  columnWidths: Record<string, number>;
  columnVisibility: Record<string, boolean>;

  // --- TELEMETRY SLICE ---
  isStreamPaused: boolean;
  performanceMetrics: PerformanceMetrics;

  // --- NOTIFICATION SLICE ---
  activityLog: TelemetryActivity[];
  alerts: TelemetryAlert[];
  alertHistory: TelemetryAlert[];
  notificationCount: number;

  // --- DATA SLICE ---
  filteredUids: string[];
  searchQuery: string;
  filters: DashboardFilters;
  sortConfigs: SortConfig[];
  distributions: {
    depts: { name: string; value: number }[];
    industries: { name: string; value: number }[];
    countries: { name: string; value: number }[];
  };
  kpiMetrics: KpiMetrics;
  runningRoiSum: number; // Backing variable for O(1) incremental ROI averages
  kpiHistory: {
    projects: number[];
    savings: number[];
    robots: number[];
    roi: number[];
    hours: number[];
  };

  // --- ACTIONS ---
  // UI Actions
  setTheme: (theme: 'dark' | 'light') => void;
  setFullscreen: (fullscreen: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setAlertHistoryOpen: (open: boolean) => void;
  toggleSelectProject: (uid: string) => void;
  selectAllProjects: (visibleOnly: boolean) => void;
  clearSelection: () => void;
  updateColumnWidth: (columnId: string, width: number) => void;
  toggleColumnVisibility: (columnId: string) => void;
  toggleColumnSort: (key: keyof AutomationProject, shiftKey: boolean) => void;
  resetSorting: () => void;

  // Telemetry Actions
  setStreamPaused: (paused: boolean) => void;
  updatePerformanceMetrics: (metrics: Partial<PerformanceMetrics>) => void;

  // Notification Actions
  clearAlerts: () => void;
  markAlertAsRead: (alertId: string) => void;
  markAllAlertsAsRead: () => void;
  pruneActivities: () => void;

  // Data Actions
  initializeData: (projects: AutomationProject[]) => void;
  applyTelemetryBatch: (
    batch: AutomationProject[], 
    generatedActivities: TelemetryActivity[], 
    generatedAlerts: TelemetryAlert[],
    savingsDelta: number,
    robotsDelta: number,
    roiSumDelta: number,
    hoursDelta: number
  ) => void;
  setFilters: (filters: Partial<DashboardFilters>) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  // Core UI state
  theme: savedSettings.theme,
  isFullscreen: false,
  isCommandPaletteOpen: false,
  isSettingsOpen: false,
  isAlertHistoryOpen: false,
  selectedProjectIds: new Set(),
  columnWidths: savedSettings.columnWidths,
  columnVisibility: savedSettings.columnVisibility,

  // Stream telemetry controls
  isStreamPaused: false,
  performanceMetrics: {
    fps: 0,
    memoryUsage: 0,
    queueSize: 0,
    domNodes: 0,
    rowsPerSec: 0,
    renderedRows: 0,
    renderTime: 0
  },

  // Log and Alerts slices
  activityLog: [],
  alerts: [],
  alertHistory: [],
  notificationCount: 0,

  // Grid Data slices
  filteredUids: [],
  searchQuery: '',
  filters: savedSettings.filters,
  sortConfigs: [],
  distributions: { depts: [], industries: [], countries: [] },
  kpiMetrics: { projects: 0, savings: 0, robots: 0, roi: 0, hours: 0 },
  runningRoiSum: 0,
  kpiHistory: { projects: [], savings: [], robots: [], roi: [], hours: [] },

  // --- ACTIONS IMPLEMENTATION ---

  // UI Slice Actions
  setTheme: (theme) => {
    set({ theme });
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    const currentSettings = loadSettings();
    localStorage.setItem('rpa_dashboard_settings', JSON.stringify({ ...currentSettings, theme }));
  },

  setFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setAlertHistoryOpen: (open) => set({ isAlertHistoryOpen: open }),

  toggleSelectProject: (uid) => {
    const newSelection = new Set(get().selectedProjectIds);
    if (newSelection.has(uid)) {
      newSelection.delete(uid);
    } else {
      newSelection.add(uid);
    }
    set({ selectedProjectIds: newSelection });
  },

  selectAllProjects: (visibleOnly) => {
    const newSelection = new Set<string>();
    if (visibleOnly) {
      get().filteredUids.forEach(uid => newSelection.add(uid));
    } else {
      projectRegistry.forEach((_, uid) => newSelection.add(uid));
    }
    set({ selectedProjectIds: newSelection });
  },

  clearSelection: () => set({ selectedProjectIds: new Set() }),

  updateColumnWidth: (columnId, width) => {
    const newWidths = { ...get().columnWidths, [columnId]: width };
    set({ columnWidths: newWidths });
    const currentSettings = loadSettings();
    localStorage.setItem('rpa_dashboard_settings', JSON.stringify({ ...currentSettings, columnWidths: newWidths }));
  },

  toggleColumnVisibility: (columnId) => {
    const newVisibility = { ...get().columnVisibility, [columnId]: !get().columnVisibility[columnId] };
    set({ columnVisibility: newVisibility });
    const currentSettings = loadSettings();
    localStorage.setItem('rpa_dashboard_settings', JSON.stringify({ ...currentSettings, columnVisibility: newVisibility }));
  },

  toggleColumnSort: (key, shiftKey) => {
    const { sortConfigs, filteredUids } = get();
    let newConfigs: SortConfig[] = [];
    const existingIndex = sortConfigs.findIndex(cfg => cfg.key === key);

    if (shiftKey) {
      newConfigs = [...sortConfigs];
      if (existingIndex > -1) {
        const currentDir = sortConfigs[existingIndex].direction;
        if (currentDir === 'asc') {
          newConfigs[existingIndex] = { key, direction: 'desc' };
        } else {
          newConfigs.splice(existingIndex, 1);
        }
      } else {
        newConfigs.push({ key, direction: 'asc' });
      }
    } else {
      if (existingIndex > -1) {
        const currentDir = sortConfigs[existingIndex].direction;
        if (currentDir === 'asc') {
          newConfigs = [{ key, direction: 'desc' }];
        } else {
          newConfigs = [];
        }
      } else {
        newConfigs = [{ key, direction: 'asc' }];
      }
    }

    // Apply sorting to active list from registry
    const currentList = filteredUids.map(uid => projectRegistry.get(uid)!).filter(Boolean);
    const sorted = newConfigs.length > 0 ? multiColumnSort(currentList, newConfigs) : currentList;
    
    set({
      sortConfigs: newConfigs,
      filteredUids: sorted.map(p => p.internal_uid)
    });
  },

  resetSorting: () => {
    const { searchQuery, filters } = get();
    const allProjects = Array.from(projectRegistry.values());
    const filtered = filterProjects(allProjects, searchQuery, filters);
    set({
      sortConfigs: [],
      filteredUids: filtered.map(p => p.internal_uid)
    });
  },

  // Telemetry Actions
  setStreamPaused: (paused) => set({ isStreamPaused: paused }),
  updatePerformanceMetrics: (newMetrics) => {
    set((state) => ({
      performanceMetrics: {
        ...state.performanceMetrics,
        ...newMetrics,
      }
    }));
  },

  // Notification Actions
  clearAlerts: () => set({ alerts: [], notificationCount: 0 }),
  markAlertAsRead: (alertId) => {
    const { alerts } = get();
    const updated = alerts.map(a => a.id === alertId ? { ...a, read: true } : a);
    set({ alerts: updated, notificationCount: updated.filter(a => !a.read).length });
  },
  markAllAlertsAsRead: () => {
    set({ alerts: get().alerts.map(a => ({ ...a, read: true })), notificationCount: 0 });
  },
  pruneActivities: () => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    const { activityLog } = get();
    const filtered = activityLog.filter(a => a.timestamp >= cutoff);
    if (filtered.length !== activityLog.length) {
      set({ activityLog: filtered });
    }
  },

  // Data Actions
  initializeData: (projects) => {
    // Phase 1 (immediate): Populate mutable registry Map and show rows in table
    projectRegistry.clear();
    projects.forEach(p => projectRegistry.set(p.internal_uid, p));

    const { searchQuery, filters } = get();
    const filtered = filterProjects(projects, searchQuery, filters);
    const filteredUids = filtered.map(p => p.internal_uid);
    const dists = computeDistributions(filtered);

    // Show the table rows immediately — KPIs will arrive in phase 2
    set({
      filteredUids,
      distributions: dists,
      selectedProjectIds: new Set()
    });

    // Phase 2 (deferred): Compute KPI aggregations off the hot paint path
    const computeKpis = () => {
      const totalProjects = projects.length;
      let totalSavings = 0;
      let totalRobots = 0;
      let totalRoiSum = 0;
      let totalHours = 0;

      for (let i = 0; i < projects.length; i++) {
        const p = projects[i];
        totalSavings += p.annual_savings_usd;
        totalRobots += p.robots_deployed;
        totalRoiSum += p.roi_percent;
        totalHours += p.employee_hours_saved;
      }

      const avgRoi = totalProjects > 0 ? totalRoiSum / totalProjects : 0;
      const kpis: KpiMetrics = {
        projects: totalProjects,
        savings: totalSavings,
        robots: totalRobots,
        roi: avgRoi,
        hours: totalHours
      };

      const initialHistory = {
        projects: Array(30).fill(totalProjects),
        savings: Array(30).fill(totalSavings),
        robots: Array(30).fill(totalRobots),
        roi: Array(30).fill(avgRoi),
        hours: Array(30).fill(totalHours),
      };

      set({
        kpiMetrics: kpis,
        runningRoiSum: totalRoiSum,
        kpiHistory: initialHistory,
      });
    };

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(computeKpis, { timeout: 2000 });
    } else {
      setTimeout(computeKpis, 100);
    }
  },

  applyTelemetryBatch: (_batch, generatedActivities, generatedAlerts, savingsDelta, robotsDelta, roiSumDelta, hoursDelta) => {
    if (get().isStreamPaused) return;

    const { kpiMetrics, runningRoiSum, kpiHistory, activityLog, alerts, alertHistory, notificationCount } = get();

    // Compute O(1) incremental aggregates
    const totalProjects = projectRegistry.size;
    const newSavings = kpiMetrics.savings + savingsDelta;
    const newRobots = kpiMetrics.robots + robotsDelta;
    const newRoiSum = runningRoiSum + roiSumDelta;
    const newHours = kpiMetrics.hours + hoursDelta;

    const avgRoi = totalProjects > 0 ? newRoiSum / totalProjects : 0;
    const newKpis: KpiMetrics = {
      projects: totalProjects,
      savings: newSavings,
      robots: newRobots,
      roi: avgRoi,
      hours: newHours
    };

    // Append to historical arrays only once every 1000ms to reduce Recharts rendering overhead (Step 7)
    const nowTime = Date.now();
    const shouldUpdateHistory = nowTime - lastHistoryUpdateTime >= 1000;
    
    let newKpiHistory = kpiHistory;
    if (shouldUpdateHistory) {
      newKpiHistory = {
        projects: [...kpiHistory.projects.slice(1), totalProjects],
        savings: [...kpiHistory.savings.slice(1), newSavings],
        robots: [...kpiHistory.robots.slice(1), newRobots],
        roi: [...kpiHistory.roi.slice(1), avgRoi],
        hours: [...kpiHistory.hours.slice(1), newHours],
      };
      lastHistoryUpdateTime = nowTime;
    }

    // Prepend and filter out old/duplicate activities
    const cutoff = Date.now() - 5 * 60 * 1000;
    const existingMsgKeys = new Set(activityLog.map(a => `${a.project_name}-${a.message}`));
    const uniqueIncoming = generatedActivities.filter(a => {
      const key = `${a.project_name}-${a.message}`;
      if (existingMsgKeys.has(key)) return false;
      existingMsgKeys.add(key);
      return true;
    });

    const newActivities = [...uniqueIncoming, ...activityLog]
      .filter(a => a.timestamp >= cutoff)
      .slice(0, 100);

    const newAlerts = [...generatedAlerts, ...alerts].slice(0, 50);
    const newAlertHistory = [...generatedAlerts, ...alertHistory].slice(0, 50); // Hard limit to 50 items (Step 2)

    set({
      kpiMetrics: newKpis,
      runningRoiSum: newRoiSum,
      kpiHistory: newKpiHistory,
      activityLog: newActivities,
      alerts: newAlerts,
      alertHistory: newAlertHistory,
      notificationCount: notificationCount + generatedAlerts.length
    });
  },

  setFilters: (newFilters) => {
    const updatedFilters = { ...get().filters, ...newFilters };
    const { searchQuery, sortConfigs } = get();
    const allProjects = Array.from(projectRegistry.values());
    
    const filtered = filterProjects(allProjects, searchQuery, updatedFilters);
    const sorted = sortConfigs.length > 0 ? multiColumnSort(filtered, sortConfigs) : filtered;
    const dists = computeDistributions(sorted);

    set({
      filters: updatedFilters,
      filteredUids: sorted.map(p => p.internal_uid),
      distributions: dists
    });

    const currentSettings = loadSettings();
    localStorage.setItem('rpa_dashboard_settings', JSON.stringify({ ...currentSettings, filters: updatedFilters }));
  },

  setSearchQuery: (query) => {
    const { filters, sortConfigs } = get();
    const allProjects = Array.from(projectRegistry.values());
    
    const filtered = filterProjects(allProjects, query, filters);
    const sorted = sortConfigs.length > 0 ? multiColumnSort(filtered, sortConfigs) : filtered;
    const dists = computeDistributions(sorted);

    set({
      searchQuery: query,
      filteredUids: sorted.map(p => p.internal_uid),
      distributions: dists
    });
  },

  resetFilters: () => {
    const emptyFilters = { departments: [], industries: [], automationTypes: [] };
    const { searchQuery, sortConfigs } = get();
    const allProjects = Array.from(projectRegistry.values());

    const filtered = filterProjects(allProjects, searchQuery, emptyFilters);
    const sorted = sortConfigs.length > 0 ? multiColumnSort(filtered, sortConfigs) : filtered;
    const dists = computeDistributions(sorted);

    set({
      filters: emptyFilters,
      filteredUids: sorted.map(p => p.internal_uid),
      distributions: dists
    });

    const currentSettings = loadSettings();
    localStorage.setItem('rpa_dashboard_settings', JSON.stringify({ ...currentSettings, filters: emptyFilters }));
  }
}));
