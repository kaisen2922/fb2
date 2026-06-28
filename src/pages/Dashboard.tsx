import { useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { KpiCards } from '../components/cards/KpiCards';
import { FiltersPanel } from '../components/filters/FiltersPanel';
import { VirtualTable } from '../components/table/VirtualTable';
import { ActivityFeed } from '../components/activity/ActivityFeed';
import { PerformancePanel } from '../components/layout/PerformancePanel';
import { AnalyticsCharts } from '../components/charts/AnalyticsCharts';
import { AlertSystem } from '../components/alerts/AlertSystem';
import { CommandPalette } from '../components/layout/CommandPalette';
import { ExportProgressToast } from '../components/layout/ExportProgressToast';
import { connectRpaStream } from '../engine/streamEngine';
import { useDashboardStore } from '../store/useDashboardStore';

export const Dashboard = () => {
  const isFullscreen = useDashboardStore(state => state.isFullscreen);

  // Initialize and connect to the official telemetry stream on startup
  useEffect(() => {
    connectRpaStream('./automation_projects.csv');
  }, []);

  // Dedicated requestAnimationFrame FPS monitor (updates store once every second)
  // BUGFIX: Previously called updatePerformanceMetrics() on every frame (~60x/sec),
  // triggering Zustand set() 60 times/sec and cascading re-renders to all subscribers.
  // Now the store write only fires once per second — the rAF loop still counts frames accurately.
  useEffect(() => {
    let animId: number;
    let frameCount = 0;
    let lastFpsTime = performance.now();
    // Stable ref to avoid capturing stale closure — avoids re-creating the loop on re-renders
    const storeRef = useDashboardStore;

    const tick = (now: DOMHighResTimeStamp) => {
      frameCount++;
      const elapsed = now - lastFpsTime;

      if (elapsed >= 1000) {
        const calculatedFps = Math.min(60, Math.round((frameCount * 1000) / elapsed));
        // Write to store ONLY once per second — not 60x/sec
        storeRef.getState().updatePerformanceMetrics({ fps: calculatedFps });
        frameCount = 0;
        lastFpsTime = now;
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className={`min-h-screen flex flex-col bg-slate-950 text-gray-100 font-sans selection:bg-cyan-500/20 selection:text-cyan-200 transition-all duration-300 ${
      isFullscreen ? 'p-0 bg-black' : 'p-0'
    }`}>
      {/* Top Navbar */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col gap-5 px-6 py-5 max-w-[1600px] w-full mx-auto overflow-x-hidden">
        {/* Row 1: KPI Cards */}
        <KpiCards />

        {/* Row 2: Search and Category Multi-Filters */}
        <FiltersPanel />

        {/* Row 3: Virtualized scrolling table (75%) & Live Activity Feed (25%) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 lg:h-[480px] lg:min-h-[480px] h-auto">
          <div className="lg:col-span-3 h-[480px] lg:h-full flex flex-col">
            <VirtualTable />
          </div>
          <div className="lg:col-span-1 h-[320px] lg:h-full">
            <ActivityFeed />
          </div>
        </div>

        {/* Bottom Section: Performance Diagnostics (25%) & Recharts Trends/Distributions (75%) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 lg:h-[250px] lg:min-h-[250px] h-auto mb-4">
          <div className="lg:col-span-1 h-[260px] lg:h-full">
            <PerformancePanel />
          </div>
          <div className="lg:col-span-3 h-[320px] lg:h-full">
            <AnalyticsCharts />
          </div>
        </div>
      </main>

      {/* Global Toast Alert Overlay */}
      <AlertSystem />

      {/* Non-blocking Snapshot Export Progress Toast (bottom-left) */}
      <ExportProgressToast />

      {/* Ctrl+K Command Palette Trigger Overlay */}
      <CommandPalette />
    </div>
  );
};
export default Dashboard;
