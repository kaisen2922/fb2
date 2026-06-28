import type { AutomationProject, SortConfig } from '../types';

/**
 * High-performance multi-column sort function.
 * Compares rows based on an array of SortConfigs.
 */
export const multiColumnSort = (
  data: AutomationProject[],
  sortConfigs: SortConfig[]
): AutomationProject[] => {
  if (sortConfigs.length === 0) return data;

  // Clone to avoid mutation
  return [...data].sort((a, b) => {
    for (const config of sortConfigs) {
      const key = config.key;
      const direction = config.direction;

      const valA = a[key];
      const valB = b[key];

      // Handle undefined/null
      if (valA === undefined && valB !== undefined) return 1;
      if (valB === undefined && valA !== undefined) return -1;
      if (valA === undefined && valB === undefined) continue;

      let comparison = 0;

      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        comparison = (valA ? 1 : 0) - (valB ? 1 : 0);
      } else {
        // String locale comparison
        comparison = String(valA).localeCompare(String(valB), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }

      if (comparison !== 0) {
        return direction === 'asc' ? comparison : -comparison;
      }
    }
    return 0;
  });
};
