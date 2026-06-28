import { useState, useEffect, useMemo, memo } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { Cpu, Database, LayoutGrid, Activity, Clock, Layers } from 'lucide-react';

export const PerformancePanel = memo(() => {
  const performanceMetrics = useDashboardStore(state => state.performanceMetrics);

  const { fps, memoryUsage, queueSize, renderedRows, domNodes, rowsPerSec, renderTime } = performanceMetrics;

  // Track historical FPS and Memory for mini diagnostics graphs (capped at 60 items - Priority 3)
  const [fpsHistory, setFpsHistory] = useState<number[]>(Array(60).fill(60));
  const [memHistory, setMemHistory] = useState<number[]>(Array(60).fill(0));

  useEffect(() => {
    setFpsHistory(prev => [...prev.slice(1), fps]);
  }, [fps]);

  useEffect(() => {
    if (memoryUsage > 0) {
      setMemHistory(prev => [...prev.slice(1), memoryUsage]);
    }
  }, [memoryUsage]);

  // BUGFIX: Memoize chart computation — was recalculated on every render (60x/sec with Bug #1).
  // Also replaced Math.max(...arr) spread with Math.max.apply to avoid arg-array allocation.
  const fpsMiniChart = useMemo(() => {
    const history = fpsHistory;
    if (history.length < 2) return null;
    const w = 80;
    const h = 18;
    const pad = 1;
    const minV = Math.min.apply(null, history);
    const maxV = Math.max.apply(null, history);
    const range = (maxV - minV) || 1;
    const points = history.map((val, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const y = h - ((val - minV) / range) * (h - pad * 2) - pad;
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={w} height={h} className="overflow-visible opacity-60">
        <polyline fill="none" stroke="#10b981" strokeWidth="1" points={points} />
      </svg>
    );
  }, [fpsHistory]);

  const memMiniChart = useMemo(() => {
    const history = memHistory;
    if (history.length < 2) return null;
    const w = 80;
    const h = 18;
    const pad = 1;
    const minV = Math.min.apply(null, history);
    const maxV = Math.max.apply(null, history);
    const range = (maxV - minV) || 1;
    const points = history.map((val, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const y = h - ((val - minV) / range) * (h - pad * 2) - pad;
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={w} height={h} className="overflow-visible opacity-60">
        <polyline fill="none" stroke="#a855f7" strokeWidth="1" points={points} />
      </svg>
    );
  }, [memHistory]);

  // Get status color for FPS
  const getFpsColor = (f: number) => {
    if (f >= 55) return 'text-emerald-400';
    if (f >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

  // Get status color for Queue Size
  const getQueueColor = (q: number) => {
    if (q === 0) return 'text-gray-400';
    if (q < 100) return 'text-cyan-400';
    if (q < 500) return 'text-amber-400';
    return 'text-red-400 font-bold animate-pulse';
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950/40 border border-gray-800 rounded-lg overflow-hidden">
      {/* Panel Header */}
      <div className="px-4 py-2 bg-slate-900 border-b border-gray-800 flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
          <Activity size={15} className="text-emerald-400 animate-pulse" />
          Engine Diagnostics
        </h4>
        <span className="text-[9px] font-mono text-gray-500">
          SECURE CONNECTION
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="flex-1 p-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
        {/* 1. FPS Tracker */}
        <div className="flex items-center justify-between border-b border-gray-800/40 pb-2">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Cpu size={13} className="text-emerald-400" />
            <span>Framerate</span>
          </div>
          <div className="flex items-center gap-2">
            {fpsMiniChart}
            <span className={`font-mono font-bold text-sm ${getFpsColor(fps)}`}>
              {fps} <span className="text-[9px] font-normal text-gray-500">FPS</span>
            </span>
          </div>
        </div>

        {/* 2. Memory Usage */}
        <div className="flex items-center justify-between border-b border-gray-800/40 pb-2">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Database size={13} className="text-purple-400" />
            <span>Heap Usage</span>
          </div>
          <div className="flex items-center gap-2">
            {memoryUsage > 0 && memMiniChart}
            <span className="font-mono font-bold text-white">
              {memoryUsage > 0 ? `${memoryUsage}MB` : 'N/A'}
            </span>
          </div>
        </div>

        {/* 3. Queue Buffer */}
        <div className="flex items-center justify-between border-b border-gray-800/40 pb-2">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Layers size={13} className="text-cyan-400" />
            <span>Buffer Queue</span>
          </div>
          <span className={`font-mono font-bold ${getQueueColor(queueSize)}`}>
            {queueSize} <span className="text-[9px] font-normal text-gray-500">rows</span>
          </span>
        </div>

        {/* 4. Throughput (Rows/Sec) */}
        <div className="flex items-center justify-between border-b border-gray-800/40 pb-2">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Activity size={13} className="text-cyan-400" />
            <span>Throughput</span>
          </div>
          <span className="font-mono font-bold text-white">
            {rowsPerSec} <span className="text-[9px] font-normal text-gray-500">rows/s</span>
          </span>
        </div>

        {/* 5. Render Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Clock size={13} className="text-amber-400" />
            <span>Cycle Time</span>
          </div>
          <span className="font-mono font-bold text-white">
            {renderTime} <span className="text-[9px] font-normal text-gray-500">ms</span>
          </span>
        </div>

        {/* 6. Virtualized Nodes */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-gray-400">
            <LayoutGrid size={13} className="text-pink-400" />
            <span>DOM Nodes</span>
          </div>
          <span className="font-mono font-semibold text-gray-300">
            {renderedRows} <span className="text-[9px] text-gray-500">rows</span> / {domNodes} <span className="text-[9px] text-gray-500">nodes</span>
          </span>
        </div>
      </div>
    </div>
  );
});
export default PerformancePanel;
