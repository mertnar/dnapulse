import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Eye,
  Edit2,
  Trash2,
  BarChart3,
  Table as TableIcon,
  Search,
  LayoutGrid,
  List,
  TrendingUp,
  PieChart,
  Activity,
  ScatterChart,
  Clock,
  Filter,
  MoreHorizontal,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { detectionService, type SavedView, type VisualizationType } from '../services/detectionService';
import { formatDistanceToNow } from 'date-fns';

type LayoutMode = 'grid' | 'list';
type FilterType = 'all' | VisualizationType;

const VIZ_META: Record<string, { label: string; icon: typeof TableIcon; color: string }> = {
  table:   { label: 'Table',         icon: TableIcon,    color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
  line:    { label: 'Line Chart',    icon: TrendingUp,   color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' },
  bar:     { label: 'Bar Chart',     icon: BarChart3,    color: 'text-violet-500 bg-violet-50 dark:bg-violet-900/20' },
  area:    { label: 'Area Chart',    icon: Activity,     color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/20' },
  pie:     { label: 'Pie Chart',     icon: PieChart,     color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
  scatter: { label: 'Scatter Plot',  icon: ScatterChart, color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' },
  heatmap: { label: 'Heatmap',       icon: BarChart3,    color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' },
};

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'table',   label: 'Tables' },
  { value: 'line',    label: 'Lines' },
  { value: 'bar',     label: 'Bars' },
  { value: 'area',    label: 'Areas' },
  { value: 'pie',     label: 'Pies' },
  { value: 'scatter', label: 'Scatter' },
];

export function Views() {
  const navigate = useNavigate();
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState<LayoutMode>('grid');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    loadViews();
  }, []);

  const loadViews = async () => {
    try {
      setLoading(true);
      const data = await detectionService.getSavedViews();
      setViews(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load views');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (viewId: string) => {
    if (!confirm('Are you sure you want to delete this view?')) return;
    try {
      await detectionService.deleteSavedView(viewId);
      setViews(prev => prev.filter(v => v.id !== viewId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete view');
    }
  };

  const handleDuplicate = async (view: SavedView) => {
    try {
      await detectionService.createSavedView({
        name: `${view.name} (copy)`,
        query: view.query,
        timeRange: view.timeRange,
        columns: view.columns,
        filters: view.filters,
      });
      await loadViews();
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate view');
    }
  };

  const getVizMeta = (view: SavedView) => {
    const type = view.visualization?.type || 'table';
    return VIZ_META[type] || VIZ_META.table;
  };

  const filtered = useMemo(() => {
    let result = views;
    if (filterType !== 'all') {
      result = result.filter(v => (v.visualization?.type || 'table') === filterType);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        v =>
          v.name.toLowerCase().includes(q) ||
          v.query.toLowerCase().includes(q) ||
          (v.description || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [views, filterType, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <div className="h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          Loading views...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Saved Views</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your saved queries and visualizations
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate('/detection')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New View
        </Button>
      </div>

      {/* Toolbar */}
      {views.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search views..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Type filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterType(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  filterType === opt.value
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Layout toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700/60 rounded-lg p-0.5 ml-auto">
            <button
              onClick={() => setLayout('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                layout === 'grid'
                  ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLayout('list')}
              className={`p-1.5 rounded-md transition-colors ${
                layout === 'list'
                  ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {views.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/20 mb-4">
            <BarChart3 className="h-8 w-8 text-primary-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No saved views yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
            Create views from the Detection & Investigation page to save your queries and visualizations.
          </p>
          <Button variant="primary" onClick={() => navigate('/detection')} className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Your First View
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No views match your search</p>
          <p className="text-sm mt-1">Try adjusting your search or filter criteria</p>
        </div>
      ) : layout === 'grid' ? (
        /* ── Grid Layout ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(view => {
            const meta = getVizMeta(view);
            const Icon = meta.icon;

            return (
              <div
                key={view.id}
                onClick={() => navigate(`/views/${view.id}`)}
                className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-200"
              >
                {/* Top row: icon + title + menu */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={`flex-shrink-0 p-2.5 rounded-lg ${meta.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {view.name}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {meta.label}
                    </span>
                  </div>
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === view.id ? null : view.id)}
                      className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                    >
                      <MoreHorizontal className="h-4 w-4 text-gray-400" />
                    </button>
                    {menuOpenId === view.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                        <div className="absolute right-0 top-8 z-20 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1">
                          <button
                            onClick={() => { navigate(`/views/${view.id}`); setMenuOpenId(null); }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Open
                          </button>
                          <button
                            onClick={() => { navigate(`/views/${view.id}/edit`); setMenuOpenId(null); }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Edit2 className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => { handleDuplicate(view); setMenuOpenId(null); }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Copy className="h-3.5 w-3.5" /> Duplicate
                          </button>
                          <hr className="my-1 border-gray-200 dark:border-gray-700" />
                          <button
                            onClick={() => { handleDelete(view.id); setMenuOpenId(null); }}
                            className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Description */}
                {view.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                    {view.description}
                  </p>
                )}

                {/* Query preview */}
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg mb-3">
                  <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
                    {view.query || '*'}
                  </p>
                </div>

                {/* Footer metadata */}
                <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(view.lastRunTime || view.createdAt), { addSuffix: true })}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
                    {view.timeRange}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── List Layout ── */
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {filtered.map(view => {
            const meta = getVizMeta(view);
            const Icon = meta.icon;

            return (
              <div
                key={view.id}
                onClick={() => navigate(`/views/${view.id}`)}
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <div className={`flex-shrink-0 p-2 rounded-lg ${meta.color}`}>
                  <Icon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                      {view.name}
                    </h3>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{meta.label}</span>
                  </div>
                  <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {view.query || '*'}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                  <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-medium">
                    {view.timeRange}
                  </span>
                  <span className="hidden sm:flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(view.lastRunTime || view.createdAt), { addSuffix: true })}
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => navigate(`/views/${view.id}/edit`)}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(view.id)}
                    className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats bar */}
      {views.length > 0 && (
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
          {filtered.length} of {views.length} view{views.length !== 1 ? 's' : ''}
          {filterType !== 'all' && ` (filtered by ${filterType})`}
        </div>
      )}
    </div>
  );
}
