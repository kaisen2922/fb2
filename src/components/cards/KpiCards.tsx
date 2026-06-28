import { useEffect, useState, useRef, memo } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { formatCurrencyCompact, formatNumberCompact, formatPercent, formatNumber } from '../../utils/format';
import { Briefcase, DollarSign, Cpu, Percent, Clock, ChevronUp, ChevronDown } from 'lucide-react';

// Eased animated counter component with layout animation frame cleanup
const AnimatedCounter = ({ value, formatFn }: { value: number; formatFn: (v: number) => string }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current === value) return;

    setDisplayValue(value);
    prevValueRef.current = value;
  }, [value]);

  // Sync ref if value doesn't trigger effect
  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  let formattedValue = '';
  try {
    formattedValue = formatFn(displayValue);
  } catch (err) {
    console.error('❌ [AnimatedCounter] Format function failed:', err, 'value:', displayValue);
    formattedValue = String(displayValue);
  }

  return <span className="font-mono font-bold tracking-tight">{formattedValue}</span>;
};

// Custom premium sparkline SVG component
const Sparkline = ({ history, color = '#06b6d4' }: { history: number[]; color?: string }) => {
  if (!history || history.length < 2) return null;

  const width = 120;
  const height = 36;
  const padding = 2;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;

  const points = history.map((val, index) => {
    const x = (index / (history.length - 1)) * (width - padding * 2) + padding;
    const y = height - ((val - min) / range) * (height - padding * 2) - padding;
    return { x, y };
  });

  let pathD = '';
  try {
    pathD = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');
  } catch (err) {
    console.error('❌ [Sparkline] Path reduction failed:', err);
    return null;
  }

  return (
    <svg width={width} height={height} className="overflow-visible select-none pointer-events-none">
      <defs>
        <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`}
        fill={`url(#gradient-${color.replace('#', '')})`}
      />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-[0_2px_4px_var(--tw-shadow)]"
        style={{ ['--tw-shadow' as any]: `${color}40` }}
      />
      {/* Pulsating glowing tracker dot for the last telemetry frame */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="3"
        fill={color}
      />
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="6"
        fill="none"
        stroke={color}
        strokeWidth="1"
        className="animate-ping origin-center opacity-60"
        style={{ transformOrigin: `${points[points.length - 1].x}px ${points[points.length - 1].y}px` }}
      />
    </svg>
  );
};

export const KpiCards = memo(() => {
  // Safe default hooks to block undefined state crashes
  const kpiMetrics = useDashboardStore(state => state.kpiMetrics) || { projects: 0, savings: 0, robots: 0, roi: 0, hours: 0 };
  const kpiHistory = useDashboardStore(state => state.kpiHistory) || { projects: [], savings: [], robots: [], roi: [], hours: [] };

  // Compute variance from history (last index vs 5 ticks ago)
  const getVariance = (arr: number[] | undefined) => {
    if (!arr || arr.length < 6) return { val: 0, isUp: true };
    const current = arr[arr.length - 1];
    const prev = arr[arr.length - 6];
    const delta = current - prev;
    return {
      val: prev > 0 ? (delta / prev) * 100 : 0,
      isUp: delta >= 0
    };
  };

  const variances = {
    projects: getVariance(kpiHistory.projects),
    savings: getVariance(kpiHistory.savings),
    robots: getVariance(kpiHistory.robots),
    roi: getVariance(kpiHistory.roi),
    hours: getVariance(kpiHistory.hours)
  };

  const renderTrend = (variance: { val: number; isUp: boolean }) => {
    if (variance.val === 0) return <span className="text-gray-500 text-[10px]">0.0%</span>;
    return (
      <span className={`inline-flex items-center text-[10px] font-semibold ${variance.isUp ? 'text-emerald-400' : 'text-red-400'}`}>
        {variance.isUp ? <ChevronUp size={11} className="mr-0.5" /> : <ChevronDown size={11} className="mr-0.5" />}
        {Math.abs(variance.val).toFixed(2)}%
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full">
      {/* 1. Projects Card */}
      <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between h-[108px]">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wider">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Briefcase size={14} />
            </div>
            <span>Total Projects</span>
          </div>
          {renderTrend(variances.projects)}
        </div>
        <div className="flex justify-between items-end mt-2">
          <div className="text-2xl font-extrabold text-white leading-none">
            <AnimatedCounter value={kpiMetrics.projects} formatFn={formatNumber} />
          </div>
          <Sparkline history={kpiHistory.projects} color="#06b6d4" />
        </div>
      </div>

      {/* 2. Annual Savings Card */}
      <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between h-[108px]">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wider">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign size={14} />
            </div>
            <span>Annual Savings</span>
          </div>
          {renderTrend(variances.savings)}
        </div>
        <div className="flex justify-between items-end mt-2">
          <div className="text-2xl font-extrabold text-white leading-none">
            <AnimatedCounter value={kpiMetrics.savings} formatFn={formatCurrencyCompact} />
          </div>
          <Sparkline history={kpiHistory.savings} color="#10b981" />
        </div>
      </div>

      {/* 3. Robots Deployed Card */}
      <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between h-[108px]">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wider">
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Cpu size={14} />
            </div>
            <span>Robots Deployed</span>
          </div>
          {renderTrend(variances.robots)}
        </div>
        <div className="flex justify-between items-end mt-2">
          <div className="text-2xl font-extrabold text-white leading-none">
            <AnimatedCounter value={kpiMetrics.robots} formatFn={formatNumber} />
          </div>
          <Sparkline history={kpiHistory.robots} color="#a855f7" />
        </div>
      </div>

      {/* 4. Average ROI Card */}
      <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between h-[108px]">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wider">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Percent size={14} />
            </div>
            <span>Average ROI</span>
          </div>
          {renderTrend(variances.roi)}
        </div>
        <div className="flex justify-between items-end mt-2">
          <div className="text-2xl font-extrabold text-white leading-none">
            <AnimatedCounter value={kpiMetrics.roi} formatFn={formatPercent} />
          </div>
          <Sparkline history={kpiHistory.roi} color="#f59e0b" />
        </div>
      </div>

      {/* 5. Employee Hours Saved Card */}
      <div className="glass-panel glass-panel-hover rounded-xl p-4 flex flex-col justify-between h-[108px]">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wider">
            <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <Clock size={14} />
            </div>
            <span>Hours Saved</span>
          </div>
          {renderTrend(variances.hours)}
        </div>
        <div className="flex justify-between items-end mt-2">
          <div className="text-2xl font-extrabold text-white leading-none">
            <AnimatedCounter value={kpiMetrics.hours} formatFn={formatNumberCompact} />
          </div>
          <Sparkline history={kpiHistory.hours} color="#ec4899" />
        </div>
      </div>
    </div>
  );
});

export default KpiCards;
