import { useRef, useEffect, memo } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { formatTime } from '../../utils/format';
import { 
  Cpu, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Terminal
} from 'lucide-react';

interface ActivityItemProps {
  activity: {
    id: string;
    type: string;
    project_id: string;
    project_name: string;
    message: string;
    timestamp: number;
    details?: string;
  };
}

const getActivityIcon = (type: string, message: string) => {
  switch (type) {
    case 'robot_deployed':
      return <Cpu size={14} className="text-purple-400" />;
    case 'roi_changed':
      return message.includes('📉') 
        ? <TrendingDown size={14} className="text-red-400" />
        : <TrendingUp size={14} className="text-emerald-400" />;
    case 'savings_updated':
      return <DollarSign size={14} className="text-emerald-400" />;
    case 'project_completed':
      return <CheckCircle size={14} className="text-emerald-400 animate-pulse" />;
    case 'project_failed':
      return <AlertTriangle size={14} className="text-red-400 animate-bounce" />;
    default:
      return <Terminal size={14} className="text-cyan-400" />;
  }
};

const getActivityBg = (type: string) => {
  switch (type) {
    case 'robot_deployed':
      return 'bg-purple-500/10 border-purple-500/20';
    case 'project_failed':
      return 'bg-red-500/10 border-red-500/20';
    case 'project_completed':
      return 'bg-emerald-500/10 border-emerald-500/20';
    default:
      return 'bg-slate-900 border-gray-800/60';
  }
};

const ActivityItem = memo(({ activity }: ActivityItemProps) => {
  return (
    <div
      className={`p-3 border rounded-lg flex flex-col gap-1.5 transition-all text-xs ${getActivityBg(activity.type)}`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 font-semibold text-gray-200">
          <span className="p-1 rounded bg-gray-950/60 border border-gray-800">
            {getActivityIcon(activity.type, activity.message)}
          </span>
          <span className="text-[11px] truncate max-w-[120px]">
            {activity.project_name}
          </span>
        </div>
        <span className="font-mono text-[9px] text-gray-500">
          {formatTime(activity.timestamp)}
        </span>
      </div>

      <p className="text-[11px] text-gray-300 leading-relaxed pl-1">
        {activity.message}
      </p>

      {activity.details && (
        <span className="text-[9px] text-gray-500 pl-1 font-mono">
          {activity.details}
        </span>
      )}
    </div>
  );
});

export const ActivityFeed = memo(() => {
  const activityLog = useDashboardStore(state => state.activityLog);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtTopRef = useRef(true);

  // Monitor scroll position to check if user is at the top (with a 15px threshold)
  const handleScroll = () => {
    if (containerRef.current) {
      isAtTopRef.current = containerRef.current.scrollTop <= 15;
    }
  };

  // Auto-scroll logic: scroll to top ONLY when user is already at the top
  useEffect(() => {
    if (containerRef.current && isAtTopRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activityLog]);

  // Set up 5-second interval timer to prune activities older than 5 minutes
  useEffect(() => {
    const pruneTimer = setInterval(() => {
      useDashboardStore.getState().pruneActivities();
    }, 5000);
    return () => clearInterval(pruneTimer);
  }, []);

  return (
    <div className="flex flex-col h-full w-full border border-gray-800 bg-slate-950/40 rounded-lg overflow-hidden">
      {/* Title */}
      <div className="px-4 py-3 border-b border-gray-800 bg-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-cyan-400 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Live Telemetry Feed</h3>
        </div>
        <span className="px-2 py-0.5 rounded bg-gray-800 text-[10px] font-mono text-cyan-400">
          LIVE
        </span>
      </div>

      {/* Feed Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin"
      >
        <div>
          {activityLog.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <Clock size={24} className="text-gray-600 mb-2 animate-spin-slow" />
              <p className="text-xs text-gray-500">Awaiting stream telemetry...</p>
            </div>
          ) : (
            activityLog.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))
          )}
        </div>
      </div>
    </div>
  );
});
export default ActivityFeed;
