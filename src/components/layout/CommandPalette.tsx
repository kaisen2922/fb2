import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useDashboardStore, DEFAULT_COLUMNS } from '../../store/useDashboardStore';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Play,
  Pause,
  Moon,
  Sun,
  Trash2,
  Columns,
  Maximize,
  RefreshCw,
  Search,
  Command,
  ArrowRight,
  Camera,
} from 'lucide-react';
import { triggerSnapshotExport, isExporting } from '../../utils/snapshotExport';

interface CommandItem {
  id: string;
  name: string;
  category: string;
  icon: ReactNode;
  action: () => void;
  shortcut?: string;
}

export const CommandPalette = () => {
  const isOpen = useDashboardStore(state => state.isCommandPaletteOpen);
  const setOpen = useDashboardStore(state => state.setCommandPaletteOpen);
  
  const isStreamPaused = useDashboardStore(state => state.isStreamPaused);
  const setStreamPaused = useDashboardStore(state => state.setStreamPaused);
  const theme = useDashboardStore(state => state.theme);
  const setTheme = useDashboardStore(state => state.setTheme);
  const isFullscreen = useDashboardStore(state => state.isFullscreen);
  const setFullscreen = useDashboardStore(state => state.setFullscreen);
  
  const clearSelection = useDashboardStore(state => state.clearSelection);
  const resetFilters = useDashboardStore(state => state.resetFilters);
  const resetSorting = useDashboardStore(state => state.resetSorting);
  const columnVisibility = useDashboardStore(state => state.columnVisibility);
  const toggleColumnVisibility = useDashboardStore(state => state.toggleColumnVisibility);
  const filteredUids  = useDashboardStore(state => state.filteredUids);
  const sortConfigs   = useDashboardStore(state => state.sortConfigs);
  const searchQuery   = useDashboardStore(state => state.searchQuery);
  const filters       = useDashboardStore(state => state.filters);

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Toggle command palette on Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!isOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // ── Snapshot Export: non-blocking, Web-Worker-backed ────────────────────
  const handleSnapshotExport = () => {
    if (isExporting()) return; // guard duplicate triggers
    triggerSnapshotExport(filteredUids);
  };

  // Global keyboard shortcut: Ctrl+Shift+E — fires even when palette is closed.
  // Reads filteredUids directly from the store at call-time to avoid stale closure.
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (isExporting()) return;
        // Always read live state — avoids stale closure from effect registration
        triggerSnapshotExport(useDashboardStore.getState().filteredUids);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  // Build a human-readable context label for the snapshot command
  const exportContextLabel = (() => {
    const parts: string[] = [];
    if (searchQuery)   parts.push(`query: "${searchQuery}"`);
    const activeFilters = [
      ...filters.departments,
      ...filters.industries,
      ...filters.automationTypes,
    ];
    if (activeFilters.length > 0) parts.push(`${activeFilters.length} filter(s)`);
    if (sortConfigs.length > 0)   parts.push(`sorted by ${sortConfigs.map(s => s.key).join(', ')}`);
    return parts.length > 0 ? parts.join(' · ') : 'no active filters or sorting';
  })();

  // Fullscreen trigger
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setFullscreen(true);
      }).catch(err => {
        console.error('Error entering fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setFullscreen(false);
      });
    }
  };

  // List of all commands
  const commands: CommandItem[] = [
    {
      id: 'stream-toggle',
      name: isStreamPaused ? 'Resume Telemetry Stream' : 'Pause Telemetry Stream',
      category: 'Controls',
      icon: isStreamPaused ? <Play size={15} /> : <Pause size={15} />,
      action: () => setStreamPaused(!isStreamPaused),
      shortcut: 'Space'
    },
    {
      id: 'theme-toggle',
      name: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      category: 'Theme',
      icon: theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />,
      action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      shortcut: 'Ctrl+Shift+L'
    },
    {
      id: 'snapshot-export',
      name: `Snapshot Export  ·  ${filteredUids.length.toLocaleString()} rows  [${exportContextLabel}]`,
      category: 'Export',
      icon: <Camera size={15} className="text-cyan-400" />,
      action: handleSnapshotExport,
      shortcut: 'Ctrl+Shift+E',
    },
    {
      id: 'clear-selection',
      name: 'Clear Selected Rows',
      category: 'Table',
      icon: <Trash2 size={15} />,
      action: clearSelection
    },
    {
      id: 'reset-filters',
      name: 'Reset All Dropdown Filters',
      category: 'Filters',
      icon: <RefreshCw size={15} />,
      action: resetFilters
    },
    {
      id: 'reset-sorting',
      name: 'Reset Grid Sorting',
      category: 'Sorting',
      icon: <RefreshCw size={15} />,
      action: resetSorting
    },
    {
      id: 'toggle-fullscreen',
      name: isFullscreen ? 'Exit Fullscreen Mode' : 'Enter Fullscreen Mode',
      category: 'System',
      icon: <Maximize size={15} />,
      action: handleToggleFullscreen,
      shortcut: 'F11'
    },
    // Generate Column visibility toggles
    ...DEFAULT_COLUMNS.map(col => ({
      id: `toggle-col-${col.id}`,
      name: `Toggle Column: ${col.label} (${columnVisibility[col.id] !== false ? 'Hide' : 'Show'})`,
      category: 'Column Visibility',
      icon: <Columns size={15} className="text-gray-500" />,
      action: () => toggleColumnVisibility(col.id)
    }))
  ];

  // Filter commands by search query
  const filteredCommands = commands.filter(cmd => 
    cmd.name.toLowerCase().includes(search.toLowerCase()) || 
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  // Keyboard navigation inside modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          setOpen(false);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, setOpen]);

  // Center selected item in scroll container
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        const listHeight = listRef.current.clientHeight;
        const activeTop = activeEl.offsetTop;
        const activeHeight = activeEl.clientHeight;

        if (activeTop + activeHeight > listRef.current.scrollTop + listHeight) {
          listRef.current.scrollTop = activeTop + activeHeight - listHeight;
        } else if (activeTop < listRef.current.scrollTop) {
          listRef.current.scrollTop = activeTop;
        }
      }
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -40 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[15%] left-1/2 transform -translate-x-1/2 max-w-xl w-full bg-slate-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col font-sans"
          >
            {/* Input Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-800 bg-slate-950">
              <Search className="text-gray-400" size={18} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a command or column name to search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedIndex(0);
                }}
                className="flex-1 bg-transparent border-none text-white text-sm focus:outline-none placeholder-gray-500"
              />
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-[10px] text-gray-400 font-mono">
                <Command size={10} />
                <span>K</span>
              </div>
            </div>

            {/* Commands List */}
            <div 
              ref={listRef}
              className="flex-1 max-h-[300px] overflow-y-auto p-2 space-y-0.5 scrollbar-thin"
            >
              {filteredCommands.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  No commands match your query.
                </div>
              ) : (
                filteredCommands.map((cmd, index) => (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      cmd.action();
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                      index === selectedIndex 
                        ? 'bg-cyan-600 text-white shadow-lg' 
                        : 'text-gray-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`${index === selectedIndex ? 'text-white' : 'text-cyan-400'}`}>
                        {cmd.icon}
                      </span>
                      <span>{cmd.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${
                        index === selectedIndex 
                          ? 'bg-cyan-800 text-cyan-200' 
                          : 'bg-slate-950 text-gray-500 border border-gray-800/80'
                      }`}>
                        {cmd.category}
                      </span>
                    </div>

                    {cmd.shortcut ? (
                      <span className={`font-mono text-[9px] ${index === selectedIndex ? 'text-cyan-100' : 'text-gray-500'}`}>
                        {cmd.shortcut}
                      </span>
                    ) : (
                      index === selectedIndex && <ArrowRight size={12} className="text-white animate-pulse" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer Status */}
            <div className="px-4 py-2 border-t border-gray-800/60 bg-slate-950/40 text-[10px] text-gray-500 flex justify-between font-mono">
              <span>Use ↑ ↓ to navigate, Enter to run</span>
              <span>Esc to close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
export default CommandPalette;
