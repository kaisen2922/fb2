import { useMemo, useState, memo } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  CartesianGrid,
  Legend
} from 'recharts';
import { formatCurrencyCompact, formatNumberCompact } from '../../utils/format';
import { TrendingUp, PieChart as PieIcon, BarChart2 } from 'lucide-react';

const COLORS = ['#06b6d4', '#10b981', '#a855f7', '#f59e0b', '#ec4899'];

// Custom tooltip for line charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel p-2.5 rounded-lg border border-gray-800 text-[11px] shadow-2xl">
        <p className="font-mono text-gray-400 font-semibold mb-1">{label}</p>
        {payload.map((pld: any, index: number) => (
          <div key={index} className="flex justify-between gap-4 py-0.5">
            <span style={{ color: pld.color }} className="font-medium">{pld.name}:</span>
            <span className="font-mono font-bold text-white">
              {pld.name.includes('Savings') 
                ? formatCurrencyCompact(pld.value) 
                : pld.name.includes('ROI') 
                  ? `${pld.value.toFixed(1)}%` 
                  : formatNumberCompact(pld.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Sub-component: Savings Trend Line Graphs (Subscribes ONLY to kpiHistory)
const SavingsTrendChart = memo(() => {
  const kpiHistory = useDashboardStore(state => state.kpiHistory);

  // Map sliding window history for trend lines
  const trendData = useMemo(() => {
    const len = kpiHistory.savings.length;
    const data = [];
    for (let i = 0; i < len; i++) {
      data.push({
        tick: `T-${len - 1 - i}`,
        savings: kpiHistory.savings[i],
        roi: kpiHistory.roi[i],
        robots: kpiHistory.robots[i],
      });
    }
    return data;
  }, [kpiHistory]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[180px]">
      {/* 1. Savings Trend */}
      <div className="flex flex-col h-full">
        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">
          Savings Growth Trend
        </span>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid stroke="rgba(255,255,255,0.02)" strokeDasharray="3 3" />
              <XAxis dataKey="tick" hide />
              <YAxis 
                domain={['auto', 'auto']} 
                tickFormatter={formatCurrencyCompact}
                tick={{ fill: '#6b7280', fontSize: 9, fontFamily: 'monospace' }}
                width={38}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="savings" 
                name="Annual Savings" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. ROI Trend */}
      <div className="flex flex-col h-full">
        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">
          Average Return on Investment
        </span>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid stroke="rgba(255,255,255,0.02)" strokeDasharray="3 3" />
              <XAxis dataKey="tick" hide />
              <YAxis 
                domain={['auto', 'auto']} 
                tickFormatter={(val) => `${val.toFixed(0)}%`}
                tick={{ fill: '#6b7280', fontSize: 9, fontFamily: 'monospace' }}
                width={30}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="roi" 
                name="Average ROI" 
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Robot Deployment Trend */}
      <div className="flex flex-col h-full">
        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">
          Robot Fleet Expansion
        </span>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid stroke="rgba(255,255,255,0.02)" strokeDasharray="3 3" />
              <XAxis dataKey="tick" hide />
              <YAxis 
                domain={['auto', 'auto']} 
                tickFormatter={formatNumberCompact}
                tick={{ fill: '#6b7280', fontSize: 9, fontFamily: 'monospace' }}
                width={28}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="robots" 
                name="Active Robots" 
                stroke="#a855f7" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});

// Sub-component: Distributions Charts (Subscribes ONLY to distributions)
const DistributionsCharts = memo(() => {
  const distributions = useDashboardStore(state => state.distributions);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[180px]">
      {/* 1. Department Distribution */}
      <div className="flex flex-col h-full">
        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
          Top Departments
        </span>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distributions.depts} layout="vertical">
              <CartesianGrid stroke="rgba(255,255,255,0.02)" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 8 }} />
              <YAxis 
                dataKey="name" 
                type="category" 
                tick={{ fill: '#d1d5db', fontSize: 8 }}
                width={80}
              />
              <Tooltip formatter={(val) => formatNumberCompact(val as number)} />
              <Bar dataKey="value" name="Projects" radius={[0, 4, 4, 0]}>
                {distributions.depts.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Industry Distribution */}
      <div className="flex flex-col h-full">
        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
          Top Industries
        </span>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={distributions.industries}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
              >
                {distributions.industries.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => formatNumberCompact(val as number)} />
              <Legend 
                iconSize={6} 
                iconType="circle"
                layout="vertical" 
                align="right" 
                verticalAlign="middle"
                wrapperStyle={{ fontSize: 7, color: '#9ca3af' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Country Distribution */}
      <div className="flex flex-col h-full">
        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
          Top Countries
        </span>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distributions.countries}>
              <CartesianGrid stroke="rgba(255,255,255,0.02)" strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#d1d5db', fontSize: 8 }}
              />
              <YAxis tick={{ fill: '#6b7280', fontSize: 8 }} />
              <Tooltip formatter={(val) => formatNumberCompact(val as number)} />
              <Bar dataKey="value" name="Projects" radius={[4, 4, 0, 0]}>
                {distributions.countries.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});

// Main Tab Shell Component
export const AnalyticsCharts = memo(() => {
  const [activeTab, setActiveTab] = useState<'trends' | 'distributions'>('trends');

  return (
    <div className="flex flex-col h-full w-full bg-slate-950/40 border border-gray-800 rounded-lg overflow-hidden">
      {/* Header Tabs */}
      <div className="px-4 py-2 bg-slate-900 border-b border-gray-800 flex justify-between items-center">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
          <BarChart2 size={15} className="text-cyan-400" />
          Business Analytics
        </h4>
        <div className="flex bg-slate-950 p-1 rounded-md border border-gray-800/80">
          <button 
            onClick={() => setActiveTab('trends')}
            className={`px-3 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'trends' 
                ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/20' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <TrendingUp size={12} /> Trends
          </button>
          <button 
            onClick={() => setActiveTab('distributions')}
            className={`px-3 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'distributions' 
                ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/20' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <PieIcon size={12} /> Distributions
          </button>
        </div>
      </div>

      {/* Chart Panel Container */}
      <div className="flex-1 p-4 bg-slate-950/20">
        {activeTab === 'trends' ? (
          <SavingsTrendChart />
        ) : (
          <DistributionsCharts />
        )}
      </div>
    </div>
  );
});

export default AnalyticsCharts;
