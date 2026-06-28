import type { AutomationProject, DashboardFilters } from '../types';
import { fuzzyMatchProject } from './searchEngine';

/**
 * Filter projects based on active search queries and multi-select filters.
 */
export const filterProjects = (
  projects: AutomationProject[],
  query: string,
  filters: DashboardFilters
): AutomationProject[] => {
  const hasActiveQuery = !!query;
  const hasDeptFilters = filters.departments.length > 0;
  const hasIndFilters = filters.industries.length > 0;
  const hasTypeFilters = filters.automationTypes.length > 0;

  // Shortcut if no filters are active
  if (!hasActiveQuery && !hasDeptFilters && !hasIndFilters && !hasTypeFilters) {
    return projects;
  }

  // Pre-lowercase filters for fast lookup
  const deptSet = new Set(filters.departments.map(d => d.toLowerCase()));
  const indSet = new Set(filters.industries.map(i => i.toLowerCase()));
  const typeSet = new Set(filters.automationTypes.map(t => t.toLowerCase()));

  return projects.filter(project => {
    // 1. Fuzzy Search match
    if (hasActiveQuery && !fuzzyMatchProject(project, query)) {
      return false;
    }

    // 2. Department match
    if (hasDeptFilters && !deptSet.has((project.department || '').toLowerCase())) {
      return false;
    }

    // 3. Industry match
    if (hasIndFilters && !indSet.has((project.industry || '').toLowerCase())) {
      return false;
    }

    // 4. Automation Type match
    if (hasTypeFilters && !typeSet.has((project.automation_type || '').toLowerCase())) {
      return false;
    }

    return true;
  });
};
