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
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { detectionService, type SavedView, type VisualizationType } from '../services/detectionService';
import { liveMonitorService } from '../services/liveMonitorService';
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
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('15m');
  const [customTimeRange, setCustomTimeRange] = useState<{ from: Date; to: Date } | null>(null);
  const [activeViz, setActiveViz] = useState<VisualizationType>('table');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefreshSec, setAutoRefreshSec] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (id) loadView();
  }, [id]);

  useEffect(() => {
    if (view) loadData();
  }, [view, timeRange, customTimeRange]);

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
      setTimeRange(found.timeRange);
      setActiveViz(found.visualization?.type || 'table');
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
        const minutes: Record<string, number> = { '15m': 15, '1h': 60, '24h': 1440, '7d': 10080 };
        from = new Date(Date.now() - (minutes[timeRange] || 15) * 60 * 1000);
      }

      // Resolve index: try pinned_filters.index first, then datasourceScope
      const index = view.filters?.index
        || (view.datasourceScope && view.datasourceScope.length > 0 ? view.datasourceScope[0] : undefined);

      const result = await liveMonitorService.searchEvents({
        query: view.query,
        time_range: { from: from.toISOString(), to: to.toISOString() },
        limit: 1000,
        index,
      });

      setData(result.events || []);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setRefreshing(false);
    }
  }, [view, timeRange, customTimeRange]);

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

      {/* Time Range + Viz Switcher */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex-1">
          <TimeRangeSelector
            value={timeRange}
            customRange={customTimeRange}
            onChange={(r, c) => { setTimeRange(r); setCustomTimeRange(c || null); }}
          />
        </div>

        {/* Visualization type switcher */}
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

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded">
            {view.query || '*'}
          </span>
          <span className="font-medium">
            {data.length.toLocaleString()} result{data.length !== 1 ? 's' : ''}
          </span>
        </div>
        {lastRefresh && (
          <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last refreshed: {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Visualization Area */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {refreshing && data.length === 0 ? (
          <div className="flex items-center justify-center h-72">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
              <div className="h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              Loading data...
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-gray-400 dark:text-gray-500">
            <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
            <p className="font-medium">No data found</p>
            <p className="text-sm mt-1">Try adjusting your time range or query</p>
          </div>
        ) : activeViz === 'table' ? (
          <ViewTable data={data} columns={view.columns} />
        ) : (
          <div className="p-6">
            <ViewChart data={data} config={vizConfig as any} />
          </div>
        )}

        {/* Loading overlay when refreshing with existing data */}
        {refreshing && data.length > 0 && (
          <div className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 flex items-center justify-center">
            <div className="h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
