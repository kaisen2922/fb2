import { useRef, useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useDashboardStore, DEFAULT_COLUMNS, projectRegistry } from '../../store/useDashboardStore';
import { getVirtualScrollInfo } from '../../engine/virtualization';
import { highlightMatch } from '../../engine/searchEngine';
import { formatCurrency, formatPercent, formatNumber } from '../../utils/format';
import { rowEmitter } from '../../engine/rowEmitter';
import { 
  ChevronUp, 
  ChevronDown, 
  Download, 
  CheckSquare, 
  Square,
  MinusSquare,
  AlertTriangle
} from 'lucide-react';
import type { AutomationProject } from '../../types';

const ROW_HEIGHT = 42; // Fixed row height in pixels

// Status badge helper
const renderStatus = (status: string) => {
  let classes = '';
  if (status === 'Active') {
    classes = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
  } else if (status === 'Completed') {
    classes = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  } else if (status === 'Failed') {
    classes = 'bg-red-500/10 text-red-400 border-red-500/20 pulse-indicator';
  }
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${classes}`}>
      {status}
    </span>
  );
};

// Text highlighting helper for fuzzy search queries
const renderHighlightedCell = (text: string, colId: string, searchQuery: string) => {
  if (!searchQuery) return <span>{text}</span>;
  
  const isSearchableColumn = [
    'project_name', 'company_id', 'country', 'implementation_partner',
    'industry', 'department', 'automation_type', 'project_id'
  ].includes(colId);

  if (!isSearchableColumn) return <span>{text}</span>;

  const parts = highlightMatch(text, searchQuery);
  return (
    <span>
      {parts.map((part, i) => 
        typeof part === 'object' ? (
          <mark key={i} className="fuzzy-highlight">{part.text}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

// Cell formatter helper
const renderCellContent = (project: AutomationProject, colId: keyof AutomationProject, searchQuery: string) => {
  const value = project[colId];
  if (value === undefined || value === null) return '-';

  switch (colId) {
    case 'project_status':
      return renderStatus(value as string);
    case 'budget_usd':
    case 'annual_savings_usd':
      return renderHighlightedCell(formatCurrency(value as number), colId, searchQuery);
    case 'roi_percent':
      return <span className={project.roi_percent < 0 ? 'text-red-400 font-medium' : ''}>{formatPercent(value as number)}</span>;
    case 'robots_deployed':
    case 'employee_hours_saved':
      return renderHighlightedCell(formatNumber(value as number), colId, searchQuery);
    case 'ai_enabled':
    case 'cloud_deployment':
      return (
        <span className={`px-1.5 py-0.5 text-[10px] uppercase font-bold rounded ${
          value === 'Yes' 
            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20' 
            : 'bg-gray-800 text-gray-400 border border-gray-700/50'
        }`}>
          {value as string}
        </span>
      );
    default:
      return renderHighlightedCell(String(value), colId as string, searchQuery);
  }
};

// Memoized Table Row Component (Subscribes to rowEmitter for selective updates)
const VirtualTableRow = memo(({
  uid,
  index,
  isSelected,
  columnWidths,
  columnVisibility,
  totalTableWidth,
  searchQuery,
  toggleSelectProject
}: {
  uid: string;
  index: number;
  isSelected: boolean;
  columnWidths: Record<string, number>;
  columnVisibility: Record<string, boolean>;
  totalTableWidth: number;
  searchQuery: string;
  toggleSelectProject: (uid: string) => void;
}) => {
  // Read direct reference from registry
  const project = projectRegistry.get(uid)!;
  // Trigger state updates using a simple primitive version number (Step 10)
  const [, setVersion] = useState(0);

  // Subscribe to row level changes via pub/sub emitter
  useEffect(() => {
    const handleUpdate = () => {
      setVersion(v => v + 1);
    };
    rowEmitter.on(uid, handleUpdate);
    return () => rowEmitter.off(uid, handleUpdate);
  }, [uid]);

  if (!project) return null;

  const isFailed = project.project_status === 'Failed';
  const isNegativeRoi = project.roi_percent < 0;

  // Determine row background color
  let rowColorClass = 'hover:bg-slate-900/60 ';
  if (isSelected) {
    rowColorClass += 'bg-cyan-500/10 border-l-2 border-l-cyan-500 ';
  } else if (isFailed) {
    rowColorClass += 'bg-red-500/5 hover:bg-red-500/10 border-l-2 border-l-red-500/50 ';
  } else if (isNegativeRoi) {
    rowColorClass += 'bg-amber-500/5 hover:bg-amber-500/10 ';
  } else {
    rowColorClass += index % 2 === 0 ? 'bg-slate-950/40 ' : 'bg-slate-900/25 ';
  }

  // Pre-calculate column style sizes
  const colStyles = DEFAULT_COLUMNS.map(col => {
    const isVisible = columnVisibility[col.id] !== false;
    const width = columnWidths[col.id] || col.width;
    return { id: col.id, isVisible, style: { width: `${width}px`, minWidth: `${width}px` } };
  });

  return (
    <div 
      className={`absolute left-0 w-full border-b border-gray-800/40 flex items-center transition-colors duration-150 text-[13px] ${rowColorClass}`}
      style={{ 
        top: `${index * ROW_HEIGHT}px`, 
        height: `${ROW_HEIGHT}px`,
        width: `${totalTableWidth}px` 
      }}
    >
      {/* Checkbox Cell */}
      <div className="w-[50px] min-w-[50px] h-full flex items-center justify-center border-r border-gray-800/30">
        <button 
          onClick={() => toggleSelectProject(project.internal_uid)}
          className="text-gray-500 hover:text-cyan-400 focus:outline-none cursor-pointer"
        >
          {isSelected ? (
            <CheckSquare size={16} className="text-cyan-400 fill-cyan-950/40" />
          ) : (
            <Square size={16} className="text-gray-600" />
          )}
        </button>
      </div>

      {/* Data Cells */}
      {colStyles.map(col => {
        if (!col.isVisible) return null;
        return (
          <div 
            key={col.id} 
            className="px-3 overflow-hidden text-ellipsis whitespace-nowrap flex items-center h-full border-r border-gray-800/20 text-gray-300"
            style={col.style}
          >
            {renderCellContent(project, col.id as keyof AutomationProject, searchQuery)}
          </div>
        );
      })}
    </div>
  );
});

// Main Virtual Table Container Component
export const VirtualTable = memo(() => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(500);

  // Zustand Store hooks (Subscribed ONLY to configuration and filter UIDs)
  const filteredUids = useDashboardStore(state => state.filteredUids);
  const selectedProjectIds = useDashboardStore(state => state.selectedProjectIds);
  const sortConfigs = useDashboardStore(state => state.sortConfigs);
  const columnWidths = useDashboardStore(state => state.columnWidths);
  const columnVisibility = useDashboardStore(state => state.columnVisibility);
  const searchQuery = useDashboardStore(state => state.searchQuery);

  const toggleSelectProject = useDashboardStore(state => state.toggleSelectProject);
  const selectAllProjects = useDashboardStore(state => state.selectAllProjects);
  const clearSelection = useDashboardStore(state => state.clearSelection);
  const toggleColumnSort = useDashboardStore(state => state.toggleColumnSort);
  const updateColumnWidth = useDashboardStore(state => state.updateColumnWidth);
  const updatePerformanceMetrics = useDashboardStore(state => state.updatePerformanceMetrics);

  // ResizeObserver to measure table container height
  useEffect(() => {
    if (!containerRef.current) return;
    
    setViewportHeight(containerRef.current.clientHeight);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, []);

  // Update scroll top state
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Run virtualization offset coordinate calculation
  const virtualInfo = useMemo(() => {
    return getVirtualScrollInfo(
      scrollTop,
      viewportHeight,
      filteredUids.length,
      ROW_HEIGHT,
      0 // buffer size (Step 11: no hidden rows render)
    );
  }, [scrollTop, viewportHeight, filteredUids.length]);

  // BUGFIX: Previously called updatePerformanceMetrics on every scroll tick because
  // virtualInfo.startIndex/endIndex changes with every scroll event, triggering a
  // Zustand set() and cascading re-renders. Now we skip the write when the count is unchanged.
  const prevRenderedRowsRef = useRef(-1);
  useEffect(() => {
    const renderedCount = Math.max(0, virtualInfo.endIndex - virtualInfo.startIndex + 1);
    if (renderedCount !== prevRenderedRowsRef.current) {
      prevRenderedRowsRef.current = renderedCount;
      updatePerformanceMetrics({ renderedRows: renderedCount });
    }
  }, [virtualInfo.startIndex, virtualInfo.endIndex, updatePerformanceMetrics]);

  // Compute total width of the table
  const totalTableWidth = useMemo(() => {
    return DEFAULT_COLUMNS.reduce((sum, col) => {
      if (columnVisibility[col.id] === false) return sum;
      return sum + (columnWidths[col.id] || col.width);
    }, 0) + 50; // extra space for checkbox column
  }, [columnWidths, columnVisibility]);

  // Handle column resizing (mouse event tracker)
  const [resizingColId, setResizingColId] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  const startResize = useCallback((e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColId(colId);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[colId] || DEFAULT_COLUMNS.find(c => c.id === colId)!.width;
  }, [columnWidths]);

  useEffect(() => {
    if (!resizingColId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartX.current;
      const newWidth = Math.max(50, resizeStartWidth.current + deltaX);
      updateColumnWidth(resizingColId, newWidth);
    };

    const handleMouseUp = () => {
      setResizingColId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColId, updateColumnWidth]);

  // O(1) Checkbox state for select all (completely avoids 50k item loops!)
  const selectionState = useMemo(() => {
    if (filteredUids.length === 0) return 'none';
    if (selectedProjectIds.size === 0) return 'none';
    if (selectedProjectIds.size === filteredUids.length) return 'all';
    return 'some';
  }, [filteredUids.length, selectedProjectIds.size]);

  const handleSelectAllClick = () => {
    if (selectionState === 'all') {
      clearSelection();
    } else {
      selectAllProjects(true); // Select visible only
    }
  };

  // Export visible/selected items to CSV
  const exportCsv = () => {
    const exportList = selectedProjectIds.size > 0 
      ? Array.from(selectedProjectIds).map(uid => projectRegistry.get(uid)!).filter(Boolean)
      : filteredUids.map(uid => projectRegistry.get(uid)!).filter(Boolean);

    if (exportList.length === 0) return;

    const visibleCols = DEFAULT_COLUMNS.filter(c => columnVisibility[c.id] !== false);
    const headersStr = visibleCols.map(c => c.label).join(',');
    const rowsStr = exportList.map(row => 
      visibleCols.map(c => {
        let val = row[c.id as keyof AutomationProject];
        if (typeof val === 'string') {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val !== undefined ? val : '';
      }).join(',')
    );

    const blob = new Blob([[headersStr, ...rowsStr].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rpa_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate row components inside viewport
  const visibleRows = useMemo(() => {
    const rows = [];
    const { startIndex, endIndex } = virtualInfo;

    for (let i = startIndex; i <= endIndex; i++) {
      const uid = filteredUids[i];
      if (!uid) continue;

      const isSelected = selectedProjectIds.has(uid);

      rows.push(
        <VirtualTableRow
          key={uid}
          uid={uid}
          index={i}
          isSelected={isSelected}
          columnWidths={columnWidths}
          columnVisibility={columnVisibility}
          totalTableWidth={totalTableWidth}
          searchQuery={searchQuery}
          toggleSelectProject={toggleSelectProject}
        />
      );
    }
    return rows;
  }, [virtualInfo, filteredUids, selectedProjectIds, columnWidths, columnVisibility, totalTableWidth, toggleSelectProject, searchQuery]);

  // Helper to get sort indicator
  const getSortIcon = (colId: keyof AutomationProject) => {
    const cfg = sortConfigs.find(c => c.key === colId);
    if (!cfg) return null;
    return cfg.direction === 'asc' ? <ChevronUp size={13} className="ml-1 text-cyan-400" /> : <ChevronDown size={13} className="ml-1 text-cyan-400" />;
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      {/* Table Scroll Area Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 w-full overflow-auto relative border border-gray-800/80 rounded-lg bg-slate-950/40 table-container"
      >
        {/* Sticky Header */}
        <div 
          className="sticky top-0 z-20 flex bg-slate-900 border-b border-gray-800 text-[11px] font-semibold text-gray-400 tracking-wider uppercase"
          style={{ width: `${totalTableWidth}px` }}
        >
          {/* Header Checkbox */}
          <div className="w-[50px] min-w-[50px] h-[40px] flex items-center justify-center border-r border-gray-800">
            <button 
              onClick={handleSelectAllClick} 
              className="text-gray-500 hover:text-cyan-400 focus:outline-none cursor-pointer"
            >
              {selectionState === 'all' && <CheckSquare size={16} className="text-cyan-400" />}
              {selectionState === 'some' && <MinusSquare size={16} className="text-cyan-500" />}
              {selectionState === 'none' && <Square size={16} className="text-gray-600" />}
            </button>
          </div>

          {/* Header Column Cells */}
          {DEFAULT_COLUMNS.map(col => {
            if (columnVisibility[col.id] === false) return null;
            const width = columnWidths[col.id] || col.width;
            
            return (
              <div 
                key={col.id}
                className="relative px-3 h-[40px] flex items-center border-r border-gray-800 select-none group text-left"
                style={{ width: `${width}px`, minWidth: `${width}px` }}
              >
                {/* Clickable Header for Sorting */}
                <button
                  onClick={(e) => toggleColumnSort(col.id as keyof AutomationProject, e.shiftKey)}
                  className="flex items-center w-full font-semibold uppercase hover:text-white cursor-pointer focus:outline-none text-left"
                >
                  <span className="truncate">{col.label}</span>
                  {getSortIcon(col.id as keyof AutomationProject)}
                </button>

                {/* Resize Handle */}
                <div
                  onMouseDown={(e) => startResize(e, col.id)}
                  className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-cyan-500/40 transition-colors z-30 ${resizingColId === col.id ? 'bg-cyan-500' : ''}`}
                />
              </div>
            );
          })}
        </div>

        {/* Scrollable Spacer Container (Positions scrollbar correctly) */}
        <div 
          className="w-full relative" 
          style={{ 
            height: `${virtualInfo.totalHeight}px`,
            width: `${totalTableWidth}px`
          }}
        >
          {/* Absolute Visible Rows Container */}
          {visibleRows}
        </div>

        {/* Empty State */}
        {filteredUids.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-slate-950/70 z-10">
            <AlertTriangle size={36} className="text-amber-500 mb-2" />
            <h4 className="text-sm font-semibold text-gray-300">No Matching Projects Found</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-[280px] text-center">
              No processes match the current search query or active filter settings. Reset the filters to view all entries.
            </p>
          </div>
        )}
      </div>

      {/* Floating Action Menu for Selections */}
      {selectedProjectIds.size > 0 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900 border border-cyan-500/30 text-white px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-4 z-40 backdrop-blur-md">
          <span className="text-xs font-semibold text-cyan-400">
            {selectedProjectIds.size} projects selected
          </span>
          <div className="h-4 w-[1px] bg-gray-800" />
          <div className="flex gap-2">
            <button 
              onClick={exportCsv}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Download size={13} />
              Export CSV
            </button>
            <button 
              onClick={clearSelection}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-full text-xs font-medium transition-colors cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default VirtualTable;
