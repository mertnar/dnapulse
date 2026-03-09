import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Table as TableIcon,
  TrendingUp,
  BarChart3,
  Activity,
  PieChart,
  ScatterChart,
  Check,
  Database,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
  detectionService,
  type SavedView,
  type VisualizationType,
  type ChartConfig,
} from '../services/detectionService';
import { liveMonitorService } from '../services/liveMonitorService';
import { dataModelsService, type DataModelIndex } from '../services/dataModelsService';

const VIZ_TYPES: { value: VisualizationType; label: string; desc: string; icon: typeof TableIcon }[] = [
  { value: 'table',   label: 'Table',        desc: 'Rows & columns',      icon: TableIcon },
  { value: 'line',    label: 'Line Chart',   desc: 'Trends over time',    icon: TrendingUp },
  { value: 'bar',     label: 'Bar Chart',    desc: 'Compare categories',  icon: BarChart3 },
  { value: 'area',    label: 'Area Chart',   desc: 'Volume over time',    icon: Activity },
  { value: 'pie',     label: 'Pie Chart',    desc: 'Part of a whole',     icon: PieChart },
  { value: 'scatter', label: 'Scatter Plot', desc: 'Correlation',         icon: ScatterChart },
];

const AGG_OPTIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sum',   label: 'Sum' },
  { value: 'avg',   label: 'Average' },
  { value: 'min',   label: 'Minimum' },
  { value: 'max',   label: 'Maximum' },
];

export function ViewEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [view, setView] = useState<SavedView | null>(null);
  const [dataModels, setDataModels] = useState<DataModelIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIndex, setSelectedIndex] = useState('');
  const [vizType, setVizType] = useState<VisualizationType>('table');
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');
  const [aggregation, setAggregation] = useState<'count' | 'sum' | 'avg' | 'min' | 'max'>('count');
  const [showLegend, setShowLegend] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [stacked, setStacked] = useState(false);

  useEffect(() => {
    if (id) {
      loadView();
      dataModelsService.getDataModels().then(models =>
        setDataModels(models.filter(m => m.index_name && m.status === 'active'))
      );
    }
  }, [id]);

  const loadView = async () => {
    try {
      setLoading(true);
      const views = await detectionService.getSavedViews();
      const found = views.find(v => v.id === id);
      if (!found) { setError('View not found'); return; }

      setView(found);
      setName(found.name);
      setDescription(found.description || '');
      // Restore saved index
      const savedIndex = found.filters?.index
        || (found.datasourceScope && found.datasourceScope.length > 0 ? found.datasourceScope[0] : '');
      setSelectedIndex(savedIndex);

      if (found.visualization) {
        setVizType(found.visualization.type);
        setXAxis(found.visualization.xAxis || '');
        setYAxis(
          Array.isArray(found.visualization.yAxis)
            ? found.visualization.yAxis[0] || ''
            : found.visualization.yAxis || ''
        );
        setAggregation(found.visualization.aggregation || 'count');
        setShowLegend(found.visualization.showLegend !== false);
        setShowGrid(found.visualization.showGrid !== false);
        setStacked(found.visualization.stacked || false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load view');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!view || !name.trim()) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const visualization: ChartConfig | undefined =
        vizType === 'table'
          ? undefined
          : {
              type: vizType,
              xAxis: xAxis || undefined,
              yAxis: yAxis || undefined,
              aggregation,
              showLegend,
              showGrid,
              stacked: vizType === 'bar' || vizType === 'area' ? stacked : undefined,
            };

      // Merge selectedIndex back into pinned_filters so ViewDetail can pick it up
      const pinned_filters = {
        ...(view.filters || {}),
        index: selectedIndex || undefined,
      };

      await liveMonitorService.updateSavedView(view.id, {
        name,
        description,
        visualization,
        pinned_filters,
      });
      setSuccess(true);
      setTimeout(() => navigate(`/views/${view.id}`), 600);
    } catch (err: any) {
      setError(err.message || 'Failed to save view');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <div className="h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          Loading...
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/views/${id}`)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Edit View</h1>
        </div>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-2"
        >
          {success ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : success ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* General Section */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">General</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Basic view information</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My dashboard view"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Description
            </label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional short description"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Database className="h-4 w-4" />
              Index
            </span>
          </label>
          <select
            value={selectedIndex}
            onChange={e => setSelectedIndex(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="">All indices (auto)</option>
            {dataModels.map(m => (
              <option key={m.id} value={m.index_name}>
                {m.name} ({m.index_name})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1.5">
            Select the Elasticsearch index to query. Leave empty to search all org indices.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Query
          </label>
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
            <code className="text-sm text-gray-600 dark:text-gray-400 font-mono">
              {view.query || '*'}
            </code>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Queries can be edited from the Detection & Investigation page
          </p>
        </div>
      </section>

      {/* Visualization Section */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
            Visualization
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose how to display your data
          </p>
        </div>

        {/* Viz type cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {VIZ_TYPES.map(vt => {
            const Icon = vt.icon;
            const isActive = vizType === vt.value;
            return (
              <button
                key={vt.value}
                onClick={() => setVizType(vt.value)}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  isActive
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                {isActive && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
                <Icon className={`h-6 w-6 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                <div className="text-center">
                  <p className={`text-sm font-medium ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>
                    {vt.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{vt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Chart configuration (only when not table) */}
        {vizType !== 'table' && (
          <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Chart Configuration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  X-Axis Field
                </label>
                <Input
                  value={xAxis}
                  onChange={e => setXAxis(e.target.value)}
                  placeholder="e.g. timestamp, payload.hostname"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Y-Axis Field
                </label>
                <Input
                  value={yAxis}
                  onChange={e => setYAxis(e.target.value)}
                  placeholder="e.g. payload.cpu_usage"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Aggregation
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {AGG_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setAggregation(opt.value as any)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      aggregation === opt.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={e => setShowLegend(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show legend</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={e => setShowGrid(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show grid</span>
              </label>

              {(vizType === 'bar' || vizType === 'area') && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stacked}
                    onChange={e => setStacked(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Stacked</span>
                </label>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
