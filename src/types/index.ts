export interface AutomationProject {
  project_id: string;
  company_id: string;
  project_name: string;
  start_date: string;
  completion_date: string;
  project_status: 'Active' | 'Completed' | 'Failed';
  automation_type: string;
  robots_deployed: number;
  budget_usd: number;
  annual_savings_usd: number;
  roi_percent: number;
  department: string;
  implementation_partner: string;
  country: string;
  industry: string;
  employee_hours_saved: number;
  ai_enabled: 'Yes' | 'No';
  cloud_deployment: 'Yes' | 'No';
  internal_uid: string;
  
  // Dynamic fields
  last_updated?: number; // timestamp
  anomaly_detected?: boolean;
  
  // dataStream.js updates these fields (which might be NaN/missing from CSV initially)
  employee_count?: number;
  annual_revenue_usd?: number;
  customer_count?: number;
  founded_year?: number;
  market_share_percent?: number;
}

export interface TelemetryAlert {
  id: string;
  project_id: string;
  project_name: string;
  type: 'failed_project' | 'negative_roi' | 'budget_exceeded';
  message: string;
  timestamp: number;
  severity: 'critical' | 'warning' | 'info';
  read: boolean;
  value?: string | number;
}

export interface TelemetryActivity {
  id: string;
  type: 'robot_deployed' | 'roi_changed' | 'savings_updated' | 'project_completed' | 'project_failed';
  project_id: string;
  project_name: string;
  message: string;
  timestamp: number;
  details?: string;
}

export interface PerformanceMetrics {
  fps: number;
  memoryUsage: number; // in MB
  queueSize: number;
  renderedRows: number;
  domNodes: number;
  rowsPerSec: number;
  renderTime: number; // in ms
}

export interface TableColumn {
  id: keyof AutomationProject;
  label: string;
  width: number;
  visible: boolean;
  sortable: boolean;
  resizable: boolean;
}

export interface DashboardFilters {
  departments: string[];
  industries: string[];
  automationTypes: string[];
}

export interface SortConfig {
  key: keyof AutomationProject;
  direction: 'asc' | 'desc';
}
