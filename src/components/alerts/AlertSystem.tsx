import { useEffect, useState, useRef, memo } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import type { TelemetryAlert } from '../../types';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  X, 
  AlertTriangle, 
  DollarSign, 
  AlertCircle, 
  Bell, 
  Check, 
  Trash2,
  Inbox
} from 'lucide-react';
import { formatTime } from '../../utils/format';

interface ToastMessage extends TelemetryAlert {
  visible: boolean;
}

export const AlertSystem = memo(() => {
  const alerts = useDashboardStore(state => state.alerts);
  const alertHistory = useDashboardStore(state => state.alertHistory);
  const isAlertHistoryOpen = useDashboardStore(state => state.isAlertHistoryOpen);
  const setAlertHistoryOpen = useDashboardStore(state => state.setAlertHistoryOpen);
  const markAlertAsRead = useDashboardStore(state => state.markAlertAsRead);
  const markAllAlertsAsRead = useDashboardStore(state => state.markAllAlertsAsRead);
  const clearAlerts = useDashboardStore(state => state.clearAlerts);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const shownAlertIdsRef = useRef(new Set<string>());

  // Monitor store alerts. If a new alert is added, display a toast notification.
  useEffect(() => {
    if (alerts.length === 0) return;
    
    const latestAlert = alerts[0]; // Prepend mode
    
    // Check if toast already shown
    if (!shownAlertIdsRef.current.has(latestAlert.id)) {
      shownAlertIdsRef.current.add(latestAlert.id);
      const newToast = { ...latestAlert, visible: true };
      setToasts(prev => [newToast, ...prev].slice(0, 5)); // cap at 5 toasts visible

      // Auto dismiss after 4 seconds
      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === latestAlert.id ? { ...t, visible: false } : t));
        // Remove from list after exit animation
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== latestAlert.id));
        }, 300);
      }, 4000);
    }
  }, [alerts]);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    markAlertAsRead(id);
  };

  const getAlertIcon = (type: string, size = 18) => {
    switch (type) {
      case 'failed_project':
        return <AlertCircle size={size} className="text-red-400" />;
      case 'negative_roi':
        return <AlertTriangle size={size} className="text-amber-400" />;
      case 'budget_exceeded':
        return <DollarSign size={size} className="text-red-400" />;
      default:
        return <Bell size={size} className="text-cyan-400" />;
    }
  };

  const getAlertColor = (severity: string) => {
    return severity === 'critical' 
      ? 'border-red-500/30 bg-red-950/20' 
      : 'border-amber-500/30 bg-amber-950/20';
  };

  return (
    <>
      {/* 1. TOAST NOTIFICATIONS WRAPPER */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.filter(t => t.visible).map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, y: 0, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className={`p-3 border rounded-xl shadow-2xl flex gap-3 backdrop-blur-md items-start justify-between pointer-events-auto ${getAlertColor(toast.severity)}`}
            >
              <div className="flex gap-2.5 items-start">
                <span className="p-1.5 rounded-lg bg-gray-950 border border-gray-800 flex items-center justify-center">
                  {getAlertIcon(toast.type)}
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    {toast.severity === 'critical' ? 'CRITICAL SYSTEM ALERT' : 'TELEMETRY WARNING'}
                  </h4>
                  <p className="text-xs text-gray-300 mt-0.5 leading-snug">
                    {toast.message}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => dismissToast(toast.id)}
                className="text-gray-500 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 2. ALERT HISTORY DRAWER */}
      <AnimatePresence>
        {isAlertHistoryOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setAlertHistoryOpen(false)}
              className="fixed inset-0 bg-black z-40"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 right-0 h-full w-[400px] bg-slate-900 border-l border-gray-800 shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-slate-950">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">System Alert Center</h3>
                </div>
                <button 
                  onClick={() => setAlertHistoryOpen(false)}
                  className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Toolbar */}
              <div className="px-4 py-2 bg-slate-900/60 border-b border-gray-800/40 flex justify-between items-center text-[10px] text-gray-400">
                <span>{alertHistory.length} events logged</span>
                <div className="flex gap-2">
                  <button 
                    onClick={markAllAlertsAsRead}
                    className="flex items-center gap-1 hover:text-cyan-400 cursor-pointer"
                  >
                    <Check size={11} /> Mark all read
                  </button>
                  <button 
                    onClick={clearAlerts}
                    className="flex items-center gap-1 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 size={11} /> Clear all
                  </button>
                </div>
              </div>

              {/* Alert Logs */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {alertHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 py-12">
                    <Inbox size={32} className="text-gray-700 mb-2" />
                    <p className="text-xs font-medium">No alerts triggered</p>
                    <p className="text-[10px] text-gray-600 mt-1">All automation telemetry bounds are healthy.</p>
                  </div>
                ) : (
                  alertHistory.map((alert) => (
                    <div 
                      key={alert.id}
                      className={`p-3 border rounded-xl relative transition-all duration-200 text-xs ${
                        alert.read ? 'border-gray-800 bg-slate-950/20 opacity-70' : getAlertColor(alert.severity)
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="p-1 rounded bg-gray-950/60 border border-gray-800">
                          {getAlertIcon(alert.type, 14)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                              {alert.project_name}
                            </span>
                            <span className="font-mono text-[9px] text-gray-500">
                              {formatTime(alert.timestamp)}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-200 mt-1 leading-snug">
                            {alert.message}
                          </p>
                        </div>
                      </div>
                      
                      {!alert.read && (
                        <button
                          onClick={() => markAlertAsRead(alert.id)}
                          className="absolute bottom-2 right-2 text-[9px] font-semibold text-cyan-400 hover:text-white flex items-center gap-0.5 cursor-pointer"
                        >
                          <Check size={10} /> Read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});
export default AlertSystem;
