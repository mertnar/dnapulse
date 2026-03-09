import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Settings,
  Maximize2,
  Minimize2,
  Download,
  Table as TableIcon,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  ScatterChart,
  Clock,
  Database,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { detectionService, type SavedView, type VisualizationType } from '../services/detectionService';
import { liveMonitorService } from '../services/liveMonitorService';
import { dataModelsService, type DataModelIndex } from '../services/dataModelsService';
import { ViewTable } from '../components/views/ViewTable';
import { ViewChart } from '../components/views/ViewChart';
import { TimeRangeSelector } from '../components/views/TimeRangeSelector';

const VIZ_OPTIONS: { value: VisualizationType; label: string; icon: typeof TableIcon }[] = [
  { value: 'table',   label: 'Table',   icon: TableIcon },
  { value: 'line',    label: 'Line',    icon: TrendingUp },
  { value: 'bar',     label: 'Bar',     icon: BarChart3 },
  { value: 'area',    label: 'Area',    icon: Activity },
  { value: 'pie',     label: 'Pie',     icon: PieChart },
  { value: 'scatter', label: 'Scatter', icon: ScatterChart },
];

const AUTO_REFRESH_OPTIONS = [
  { value: 0,  label: 'Off' },
  { value: 10, label: '10s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
];

export function ViewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [view, setView] = useState<SavedView | null>(null);
  const [dataModels, setDataModels] = useState<DataModelIndex[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<string>('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [customTimeRange, setCustomTimeRange] = useState<{ from: Date; to: Date } | null>(null);
  const [activeViz, setActiveViz] = useState<VisualizationType>('table');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefreshSec, setAutoRefreshSec] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showIndexPicker, setShowIndexPicker] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (id) {
      loadView();
      dataModelsService.getDataModels().then(models => {
        const active = models.filter(m => m.index_name && m.status === 'active');
        setDataModels(active);
      });
    }
  }, [id]);

  // Auto-select first available index when view has no index and data models are loaded
  useEffect(() => {
    if (view && !selectedIndex && dataModels.length > 0) {
      // Check again: view might have a saved index we haven't set yet
      const savedIndex = view.filters?.index
        || (view.datasourceScope && view.datasourceScope.length > 0 ? view.datasourceScope[0] : '');
      if (!savedIndex) {
        // Auto-select the first active data model's index
        setSelectedIndex(dataModels[0].index_name);
      }
    }
  }, [dataModels, view]);

  useEffect(() => {
    if (view) loadData();
  }, [view, timeRange, customTimeRange, selectedIndex]);

  // Auto-refresh
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefreshSec > 0 && view) {
      intervalRef.current = setInterval(() => loadData(), autoRefreshSec * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefreshSec, view, timeRange, customTimeRange]);

  const loadView = async () => {
    try {
      setLoading(true);
      const views = await detectionService.getSavedViews();
      const found = views.find(v => v.id === id);
      if (!found) { setError('View not found'); return; }
      setView(found);
      // Always use at least 30d on open so older data is visible; user can narrow it
      setTimeRange('30d');
      setActiveViz(found.visualization?.type || 'table');
      // Resolve index from saved view
      const savedIndex = found.filters?.index
        || (found.datasourceScope && found.datasourceScope.length > 0 ? found.datasourceScope[0] : '');
      setSelectedIndex(savedIndex);
    } catch (err: any) {
      setError(err.message || 'Failed to load view');
    } finally {
      setLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    if (!view) return;
    try {
      setRefreshing(true);
      setError(null);

      let from: Date;
      let to: Date = new Date();
      if (customTimeRange) {
        from = customTimeRange.from;
        to = customTimeRange.to;
      } else {
        const minutes: Record<string, number> = { '15m': 15, '1h': 60, '6h': 360, '24h': 1440, '7d': 10080, '30d': 43200 };
        from = new Date(Date.now() - (minutes[timeRange] || 10080) * 60 * 1000);
      }

      const result = await liveMonitorService.searchEvents({
        query: view.query || '',
        time_range: { from: from.toISOString(), to: to.toISOString() },
        limit: 1000,
        // pass undefined when empty so backend uses org-scoped wildcard
        index: selectedIndex || undefined,
      });

      setData(result.events || []);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setRefreshing(false);
    }
  }, [view, timeRange, customTimeRange, selectedIndex]);

  const handleExportCSV = () => {
    if (data.length === 0) return;
    const columns = view?.columns?.length ? view.columns : Object.keys(data[0]);
    const header = columns.join(',');
    const rows = data.map(row =>
      columns.map(col => {
        const val = col.split('.').reduce((o: any, k) => o?.[k], row);
        const str = val == null ? '' : String(val);
        return str.includes(',') ? `"${str}"` : str;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${view?.name || 'view'}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <div className="h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          Loading view...
        </div>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 dark:text-gray-400 mb-4">View not found</p>
        <Button variant="primary" onClick={() => navigate('/views')}>Back to Views</Button>
      </div>
    );
  }

  const vizConfig = activeViz !== 'table'
    ? { ...(view.visualization || {}), type: activeViz }
    : undefined;

  return (
    <div className={`space-y-5 ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 p-6 overflow-auto' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/views')}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
              {view.name}
            </h1>
            {view.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{view.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Auto-refresh dropdown */}
          <div className="relative">
            <select
              value={autoRefreshSec}
              onChange={e => setAutoRefreshSec(Number(e.target.value))}
              className="appearance-none pl-7 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500 focus:outline-none cursor-pointer"
            >
              {AUTO_REFRESH_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.value === 0 ? 'Auto-refresh: Off' : `Auto: ${o.label}`}
                </option>
              ))}
            </select>
            <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadData()}
            disabled={refreshing}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="ghost" size="sm" onClick={handleExportCSV} className="flex items-center gap-1.5">
            <Download className="h-4 w-4" />
            Export
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/views/${id}/edit`)}
            className="flex items-center gap-1.5"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Index + Time Range + Viz Switcher toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        {/* Index Picker */}
        <div className="flex items-center gap-3">
          <Database className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <div className="relative flex-1">
            <button
              onClick={() => setShowIndexPicker(!showIndexPicker)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              <span className={`font-mono truncate ${!selectedIndex ? 'text-gray-400' : ''}`}>
                {selectedIndex || 'All indices (auto)'}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
            </button>
            {showIndexPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowIndexPicker(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 w-full min-w-[320px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 max-h-64 overflow-auto">
                  <button
                    onClick={() => { setSelectedIndex(''); setShowIndexPicker(false); }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${!selectedIndex ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    <Database className="h-3.5 w-3.5 text-gray-400" />
                    All indices (auto)
                  </button>
                  {dataModels.length > 0 && (
                    <hr className="my-1 border-gray-100 dark:border-gray-700" />
                  )}
                  {dataModels.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedIndex(m.index_name); setShowIndexPicker(false); }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedIndex === m.index_name ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs font-mono text-gray-400 truncate">{m.index_name}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Time Range */}
        <TimeRangeSelector
          value={timeRange}
          customRange={customTimeRange}
          onChange={(r, c) => { setTimeRange(r); setCustomTimeRange(c || null); }}
        />

        {/* Viz switcher */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-mono bg-gray-100 dark:bg-gray-900/40 px-2 py-1 rounded">
              {view.query || '*'}
            </span>
            {!refreshing && (
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {data.length.toLocaleString()} result{data.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center bg-gray-100 dark:bg-gray-700/60 rounded-lg p-0.5">
            {VIZ_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const isActive = activeViz === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setActiveViz(opt.value)}
                  title={opt.label}
                  className={`p-2 rounded-md transition-all ${
                    isActive
                      ? 'bg-white dark:bg-gray-600 shadow-sm text-primary-600 dark:text-primary-400'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Error loading data</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => loadData()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Last refresh */}
      {lastRefresh && (
        <div className="text-right">
          <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center justify-end gap-1">
            <Clock className="h-3 w-3" />
            Last refreshed: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Visualization Area */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {refreshing && data.length === 0 ? (
          <div className="flex items-center justify-center h-72">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
              <div className="h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              Loading data...
            </div>
          </div>
        ) : !refreshing && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-gray-400 dark:text-gray-500">
            <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
            <p className="font-medium">No data found</p>
            <p className="text-sm mt-1 text-center max-w-xs">
              Try selecting a different index or adjusting your time range.
              {!selectedIndex && ' No index selected — searching all indices.'}
            </p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => setShowIndexPicker(true)}>
              <Database className="h-4 w-4 mr-1" />
              Select Index
            </Button>
          </div>
        ) : activeViz === 'table' ? (
          <ViewTable data={data} columns={view.columns} />
        ) : (
          <div className="p-6">
            <ViewChart data={data} config={vizConfig as any} />
          </div>
        )}

        {/* Subtle loading overlay when refreshing with existing data */}
        {refreshing && data.length > 0 && (
          <div className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 flex items-center justify-center rounded-xl">
            <div className="h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
