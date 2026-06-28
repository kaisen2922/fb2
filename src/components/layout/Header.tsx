import { useRef, useState, useEffect, memo } from 'react';
import { useDashboardStore, DEFAULT_COLUMNS } from '../../store/useDashboardStore';
import { Sun, Moon, Bell, Cpu, Database, SlidersHorizontal, Eye, EyeOff, Camera, Loader2 } from 'lucide-react';
import { formatNumber } from '../../utils/format';
import { triggerSnapshotExport, isExporting, onExportStatus } from '../../utils/snapshotExport';

const HeaderDiagnostics = memo(() => {
  const fps = useDashboardStore(state => state.performanceMetrics.fps);
  const memoryUsage = useDashboardStore(state => state.performanceMetrics.memoryUsage);

  return (
    <>
      {/* FPS Telemetry */}
      <div className="hidden md:flex items-center gap-1 text-[11px] font-mono text-gray-400 border border-gray-800/80 px-2 py-1 rounded bg-slate-900/40">
        <Cpu size={12} className="text-emerald-400" />
        <span>FPS:</span>
        <span className="font-bold text-white">{fps}</span>
      </div>

      {/* Memory Telemetry */}
      <div className="hidden md:flex items-center gap-1 text-[11px] font-mono text-gray-400 border border-gray-800/80 px-2 py-1 rounded bg-slate-900/40">
        <Database size={12} className="text-purple-400" />
        <span>RAM:</span>
        <span className="font-bold text-white">
          {memoryUsage > 0 ? `${formatNumber(memoryUsage)}MB` : 'N/A'}
        </span>
      </div>
    </>
  );
});

/** Snapshot Export button — subscribes to export event bus, not Zustand */
const SnapshotButton = memo(() => {
  const filteredUids = useDashboardStore(state => state.filteredUids);
  const [exporting, setExporting] = useState(false);
  const [percent, setPercent]     = useState(0);

  useEffect(() => {
    const unsub = onExportStatus(s => {
      const active = s.phase === 'extracting' || s.phase === 'serializing' || s.phase === 'downloading';
      setExporting(active);
      setPercent(s.percent);
    });
    return unsub;
  }, []);

  const handleClick = () => {
    if (isExporting()) return;
    triggerSnapshotExport(useDashboardStore.getState().filteredUids);
  };

  return (
    <button
      id="snapshot-export-btn"
      onClick={handleClick}
      disabled={exporting}
      title={`Snapshot Export — ${filteredUids.length.toLocaleString()} rows (Ctrl+Shift+E)`}
      className={`
        hidden md:flex items-center gap-1.5
        px-2.5 py-1 rounded-lg border text-[11px] font-semibold
        transition-all duration-200 cursor-pointer
        focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500
        ${
          exporting
            ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 cursor-not-allowed'
            : 'border-gray-800 bg-slate-900/60 text-gray-300 hover:border-cyan-500/50 hover:text-cyan-300 hover:bg-cyan-500/5'
        }
      `}
    >
      {exporting ? (
        <Loader2 size={12} className="text-cyan-400 animate-spin" />
      ) : (
        <Camera size={12} className="text-cyan-400" />
      )}
      <span className="font-mono">
        {exporting
          ? `${percent}%`
          : filteredUids.length.toLocaleString()}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-gray-500">
        {exporting ? 'exporting' : 'rows'}
      </span>
      <kbd className="hidden lg:inline-block ml-0.5 px-1 py-0.5 rounded bg-gray-800 text-[9px] font-mono text-gray-500 border border-gray-700">
        ⌃⇧E
      </kbd>
    </button>
  );
});

export const Header = memo(() => {
  const theme = useDashboardStore(state => state.theme);
  const setTheme = useDashboardStore(state => state.setTheme);
  
  const notificationCount = useDashboardStore(state => state.notificationCount);
  const setAlertHistoryOpen = useDashboardStore(state => state.setAlertHistoryOpen);
  const isAlertHistoryOpen = useDashboardStore(state => state.isAlertHistoryOpen);

  const columnVisibility = useDashboardStore(state => state.columnVisibility);
  const toggleColumnVisibility = useDashboardStore(state => state.toggleColumnVisibility);
  
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);

  // Sync dark class on mount/theme change
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Click outside listener to close settings dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node)) {
        setShowSettingsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleSettingsClick = () => {
    setShowSettingsDropdown(!showSettingsDropdown);
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-gray-800 bg-slate-950/85 backdrop-blur-md px-6 py-3 flex items-center justify-between">
      {/* 1. LOGO & CONNECTIVITY */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-cyan-600 flex items-center justify-center border border-cyan-500 shadow-lg shadow-cyan-500/20">
            <span className="font-mono font-bold text-white text-sm">R</span>
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white leading-none tracking-tight">
              Enterprise RPA Control Center
            </h1>
            <p className="text-[9px] font-mono text-cyan-400 mt-0.5">
              TELEMETRY DESK
            </p>
          </div>
        </div>

        <div className="h-4 w-[1px] bg-gray-800 hidden sm:block" />

        {/* Live Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse pulse-indicator" />
          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
            Live Stream
          </span>
        </div>
      </div>

      {/* 2. REAL-TIME ENGINE DIAGNOSTICS & ACTIONS */}
      <div className="flex items-center gap-4">
        <HeaderDiagnostics />

        {/* Snapshot Export Button */}
        <SnapshotButton />

        <div className="h-4 w-[1px] bg-gray-800" />

        {/* Notification Bell */}
        <button
          onClick={() => setAlertHistoryOpen(!isAlertHistoryOpen)}
          className="relative p-2 rounded-lg border border-gray-800 hover:bg-slate-900 text-gray-400 hover:text-white transition-colors cursor-pointer focus:outline-none"
        >
          <Bell size={15} />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-[9px] font-extrabold text-white flex items-center justify-center border border-slate-950 animate-pulse">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Column Settings Trigger */}
        <div className="relative" ref={settingsDropdownRef}>
          <button
            onClick={handleSettingsClick}
            className={`p-2 rounded-lg border border-gray-800 hover:bg-slate-900 transition-colors cursor-pointer focus:outline-none ${
              showSettingsDropdown ? 'bg-slate-900 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <SlidersHorizontal size={15} />
          </button>

          {/* Column Toggle Dropdown */}
          {showSettingsDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-gray-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-2.5 py-1.5 border-b border-gray-800/60 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                Visible Columns
              </div>
              <div className="max-h-56 overflow-y-auto mt-1 py-1 space-y-0.5 scrollbar-thin">
                {DEFAULT_COLUMNS.map(col => {
                  const isVisible = columnVisibility[col.id] !== false;
                  return (
                    <button
                      key={col.id}
                      onClick={() => toggleColumnVisibility(col.id)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-slate-800 transition-colors cursor-pointer text-left ${
                        isVisible ? 'text-gray-200' : 'text-gray-500'
                      }`}
                    >
                      <span>{col.label}</span>
                      {isVisible ? (
                        <Eye size={13} className="text-cyan-400" />
                      ) : (
                        <EyeOff size={13} className="text-gray-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Theme Switch */}
        <button
          onClick={handleThemeToggle}
          className="p-2 rounded-lg border border-gray-800 hover:bg-slate-900 text-gray-400 hover:text-white transition-colors cursor-pointer focus:outline-none"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
});
export default Header;
