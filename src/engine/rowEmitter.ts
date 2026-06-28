import type { AutomationProject } from '../types';

type RowListener = (project: AutomationProject) => void;

class RowEmitter {
  private listeners = new Map<string, Set<RowListener>>();

  /**
   * Subscribe a row component to its unique internal_uid updates.
   */
  on(uid: string, listener: RowListener) {
    if (!this.listeners.has(uid)) {
      this.listeners.set(uid, new Set());
    }
    this.listeners.get(uid)!.add(listener);
  }

  /**
   * Unsubscribe a row component from updates.
   */
  off(uid: string, listener: RowListener) {
    const set = this.listeners.get(uid);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(uid);
      }
    }
  }

  /**
   * Broadcast an update to a specific row.
   */
  emit(uid: string, project: AutomationProject) {
    const set = this.listeners.get(uid);
    if (set) {
      set.forEach(listener => listener(project));
    }
  }
}

export const rowEmitter = new RowEmitter();
export default rowEmitter;
