import { useMemo, useState, useEffect, useRef, memo } from 'react';
import { useDashboardStore, projectRegistry } from '../../store/useDashboardStore';
import { 
  Search, 
  ChevronDown, 
  Pause, 
  Play, 
  X, 
  Check, 
  RefreshCw
} from 'lucide-react';

interface DropdownState {
  department: boolean;
  industry: boolean;
  type: boolean;
}

export const FiltersPanel = memo(() => {
  const filters = useDashboardStore(state => state.filters);
  const searchQuery = useDashboardStore(state => state.searchQuery);
  const isStreamPaused = useDashboardStore(state => state.isStreamPaused);
  
  const setFilters = useDashboardStore(state => state.setFilters);
  const setSearchQuery = useDashboardStore(state => state.setSearchQuery);
  const setStreamPaused = useDashboardStore(state => state.setStreamPaused);
  const resetFilters = useDashboardStore(state => state.resetFilters);

  const [dropdownOpen, setDropdownOpen] = useState<DropdownState>({
    department: false,
    industry: false,
    type: false,
  });

  const [deptSearch, setDeptSearch] = useState('');
  const [indSearch, setIndSearch] = useState('');
  const [typeSearch, setTypeSearch] = useState('');

  const deptRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (deptRef.current && !deptRef.current.contains(e.target as Node)) {
        setDropdownOpen(prev => ({ ...prev, department: false }));
      }
      if (indRef.current && !indRef.current.contains(e.target as Node)) {
        setDropdownOpen(prev => ({ ...prev, industry: false }));
      }
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) {
        setDropdownOpen(prev => ({ ...prev, type: false }));
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Compute unique options once when baseline data loads (projects count changes)
  const uniqueOptions = useMemo(() => {
    const depts = new Set<string>();
    const inds = new Set<string>();
    const typs = new Set<string>();

    projectRegistry.forEach(p => {
      if (p.department) depts.add(p.department);
      if (p.industry) inds.add(p.industry);
      if (p.automation_type) typs.add(p.automation_type);
    });

    return {
      departments: Array.from(depts).sort(),
      industries: Array.from(inds).sort(),
      automationTypes: Array.from(typs).sort(),
    };
  }, [projectRegistry.size]); // depends on size only to avoid re-evaluating on value updates!

  // Toggle selection helper
  const handleSelectOption = (category: 'departments' | 'industries' | 'automationTypes', option: string) => {
    const current = filters[category];
    const updated = current.includes(option)
      ? current.filter(x => x !== option)
      : [...current, option];
    setFilters({ [category]: updated });
  };

  const clearCategory = (e: React.MouseEvent, category: 'departments' | 'industries' | 'automationTypes') => {
    e.stopPropagation();
    setFilters({ [category]: [] });
  };

  // Filter options based on typed filter search
  const filteredDepts = uniqueOptions.departments.filter(d => d.toLowerCase().includes(deptSearch.toLowerCase()));
  const filteredInds = uniqueOptions.industries.filter(i => i.toLowerCase().includes(indSearch.toLowerCase()));
  const filteredTypes = uniqueOptions.automationTypes.filter(t => t.toLowerCase().includes(typeSearch.toLowerCase()));

  const hasActiveFilters = filters.departments.length > 0 || filters.industries.length > 0 || filters.automationTypes.length > 0 || searchQuery !== '';

  return (
    <div className="w-full flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/40 border border-gray-800/80 rounded-xl p-4 glass-panel">
      {/* 1. SEARCH BAR & GLOBAL ICON */}
      <div className="relative w-full md:max-w-xs flex items-center">
        <Search size={16} className="absolute left-3 text-gray-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Fuzzy search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2 bg-slate-950/80 border border-gray-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500/50 transition-colors placeholder-gray-500"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-3 text-gray-500 hover:text-white cursor-pointer"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* 2. FILTER DROPDOWNS */}
      <div className="flex flex-wrap md:flex-nowrap gap-3 items-center w-full md:w-auto">
        {/* Department Filter */}
        <div className="relative" ref={deptRef}>
          <button
            onClick={() => setDropdownOpen(prev => ({ ...prev, department: !prev.department }))}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer select-none min-w-[130px] ${
              filters.departments.length > 0 
                ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300' 
                : 'bg-slate-950/60 border-gray-800 text-gray-300 hover:border-gray-700'
            }`}
          >
            <span className="truncate">
              {filters.departments.length > 0 
                ? `Dept (${filters.departments.length})` 
                : 'Department'}
            </span>
            <div className="flex items-center gap-1">
              {filters.departments.length > 0 && (
                <X 
                  size={11} 
                  className="hover:text-red-400 cursor-pointer" 
                  onClick={(e) => clearCategory(e, 'departments')}
                />
              )}
              <ChevronDown size={12} className="opacity-60" />
            </div>
          </button>

          {dropdownOpen.department && (
            <div className="absolute left-0 mt-1.5 w-56 bg-slate-900 border border-gray-800 rounded-xl shadow-2xl p-2 z-40 animate-in fade-in slide-in-from-top-1 duration-100">
              <input
                type="text"
                placeholder="Search..."
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                className="w-full px-2 py-1 bg-slate-950 border border-gray-800 rounded text-[11px] focus:outline-none mb-1.5 placeholder-gray-600"
              />
              <div className="max-h-40 overflow-y-auto space-y-0.5 scrollbar-thin">
                {filteredDepts.map(opt => {
                  const isChecked = filters.departments.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => handleSelectOption('departments', opt)}
                      className={`w-full flex items-center justify-between px-2 py-1 text-[11px] rounded transition-colors cursor-pointer text-left ${
                        isChecked ? 'bg-cyan-950/30 text-cyan-300' : 'text-gray-400 hover:bg-slate-800'
                      }`}
                    >
                      <span>{opt}</span>
                      {isChecked && <Check size={11} className="text-cyan-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Industry Filter */}
        <div className="relative" ref={indRef}>
          <button
            onClick={() => setDropdownOpen(prev => ({ ...prev, industry: !prev.industry }))}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer select-none min-w-[130px] ${
              filters.industries.length > 0 
                ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300' 
                : 'bg-slate-950/60 border-gray-800 text-gray-300 hover:border-gray-700'
            }`}
          >
            <span className="truncate">
              {filters.industries.length > 0 
                ? `Ind (${filters.industries.length})` 
                : 'Industry'}
            </span>
            <div className="flex items-center gap-1">
              {filters.industries.length > 0 && (
                <X 
                  size={11} 
                  className="hover:text-red-400 cursor-pointer" 
                  onClick={(e) => clearCategory(e, 'industries')}
                />
              )}
              <ChevronDown size={12} className="opacity-60" />
            </div>
          </button>

          {dropdownOpen.industry && (
            <div className="absolute left-0 mt-1.5 w-56 bg-slate-900 border border-gray-800 rounded-xl shadow-2xl p-2 z-40 animate-in fade-in slide-in-from-top-1 duration-100">
              <input
                type="text"
                placeholder="Search..."
                value={indSearch}
                onChange={(e) => setIndSearch(e.target.value)}
                className="w-full px-2 py-1 bg-slate-950 border border-gray-800 rounded text-[11px] focus:outline-none mb-1.5 placeholder-gray-600"
              />
              <div className="max-h-40 overflow-y-auto space-y-0.5 scrollbar-thin">
                {filteredInds.map(opt => {
                  const isChecked = filters.industries.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => handleSelectOption('industries', opt)}
                      className={`w-full flex items-center justify-between px-2 py-1 text-[11px] rounded transition-colors cursor-pointer text-left ${
                        isChecked ? 'bg-cyan-950/30 text-cyan-300' : 'text-gray-400 hover:bg-slate-800'
                      }`}
                    >
                      <span>{opt}</span>
                      {isChecked && <Check size={11} className="text-cyan-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Automation Type Filter */}
        <div className="relative" ref={typeRef}>
          <button
            onClick={() => setDropdownOpen(prev => ({ ...prev, type: !prev.type }))}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer select-none min-w-[140px] ${
              filters.automationTypes.length > 0 
                ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300' 
                : 'bg-slate-950/60 border-gray-800 text-gray-300 hover:border-gray-700'
            }`}
          >
            <span className="truncate">
              {filters.automationTypes.length > 0 
                ? `Type (${filters.automationTypes.length})` 
                : 'Automation Type'}
            </span>
            <div className="flex items-center gap-1">
              {filters.automationTypes.length > 0 && (
                <X 
                  size={11} 
                  className="hover:text-red-400 cursor-pointer" 
                  onClick={(e) => clearCategory(e, 'automationTypes')}
                />
              )}
              <ChevronDown size={12} className="opacity-60" />
            </div>
          </button>

          {dropdownOpen.type && (
            <div className="absolute left-0 mt-1.5 w-56 bg-slate-900 border border-gray-800 rounded-xl shadow-2xl p-2 z-40 animate-in fade-in slide-in-from-top-1 duration-100">
              <input
                type="text"
                placeholder="Search..."
                value={typeSearch}
                onChange={(e) => setTypeSearch(e.target.value)}
                className="w-full px-2 py-1 bg-slate-950 border border-gray-800 rounded text-[11px] focus:outline-none mb-1.5 placeholder-gray-600"
              />
              <div className="max-h-40 overflow-y-auto space-y-0.5 scrollbar-thin">
                {filteredTypes.map(opt => {
                  const isChecked = filters.automationTypes.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => handleSelectOption('automationTypes', opt)}
                      className={`w-full flex items-center justify-between px-2 py-1 text-[11px] rounded transition-colors cursor-pointer text-left ${
                        isChecked ? 'bg-cyan-950/30 text-cyan-300' : 'text-gray-400 hover:bg-slate-800'
                      }`}
                    >
                      <span>{opt}</span>
                      {isChecked && <Check size={11} className="text-cyan-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Clear Filters Reset Button */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-slate-850 flex items-center gap-1 text-xs font-medium cursor-pointer transition-colors"
            title="Reset Filters"
          >
            <RefreshCw size={13} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}
      </div>

      {/* 3. STREAM CONTROLS (Pause/Resume Stream) */}
      <div className="flex gap-2 w-full md:w-auto justify-end">
        <button
          onClick={() => setStreamPaused(true)}
          disabled={isStreamPaused}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            isStreamPaused
              ? 'bg-slate-900 border border-gray-850 text-gray-500 cursor-not-allowed opacity-50'
              : 'bg-amber-600/10 border border-amber-600/30 text-amber-400 hover:bg-amber-600/20'
          }`}
        >
          <Pause size={13} />
          Pause Stream
        </button>

        <button
          onClick={() => setStreamPaused(false)}
          disabled={!isStreamPaused}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            !isStreamPaused
              ? 'bg-slate-900 border border-gray-850 text-gray-500 cursor-not-allowed opacity-50'
              : 'bg-emerald-600/10 border border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/20'
          }`}
        >
          <Play size={13} />
          Resume Stream
        </button>
      </div>
    </div>
  );
});
export default FiltersPanel;
