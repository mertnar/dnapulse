import { useState } from 'react';
import { Search, Filter, Database, AlertCircle, TrendingUp, ChevronDown } from 'lucide-react';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import type { DataModelExtended, DataModelType, ModelStatus } from '../../types';

interface ModelListProps {
  models: DataModelExtended[];
  selectedModelId: string | null;
  onSelectModel: (modelId: string) => void;
  onCreateModel?: () => void;
  onOpenCreateDerived?: () => void;
  onOpenCreateVector?: () => void;
}

const typeIcons: Record<DataModelType, React.ReactNode> = {
  'auto-discovered': <Database className="h-4 w-4" />,
  'derived': <TrendingUp className="h-4 w-4" />,
  'composite': <Database className="h-4 w-4" />,
  'vector': <Database className="h-4 w-4" />
};

const statusVariants: Record<ModelStatus, 'success' | 'warning' | 'error' | 'default'> = {
  'active': 'success',
  'undefined-fields': 'warning',
  'drift-detected': 'error',
  'deprecated': 'default'
};

export function ModelList({
  models,
  selectedModelId,
  onSelectModel,
  onCreateModel,
  onOpenCreateDerived,
  onOpenCreateVector
}: ModelListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<DataModelType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ModelStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const hasCreateMenu = Boolean(onOpenCreateDerived && onOpenCreateVector);

  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (model.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (model.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === 'all' || model.type === filterType;
    const matchesStatus = filterStatus === 'all' || model.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Data Models
          </h2>
          {hasCreateMenu ? (
            <div className="relative">
              <button
                onClick={() => setShowCreateMenu((v) => !v)}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1"
              >
                Create
                <ChevronDown className="h-4 w-4" />
              </button>
              {showCreateMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowCreateMenu(false)}
                    aria-hidden
                  />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 py-1">
                    <button
                      onClick={() => {
                        onOpenCreateDerived?.();
                        setShowCreateMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <TrendingUp className="h-4 w-4" />
                      Derived Model
                    </button>
                    <button
                      onClick={() => {
                        onOpenCreateVector?.();
                        setShowCreateMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Database className="h-4 w-4" />
                      Vector Model
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={onCreateModel}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Create
            </button>
          )}
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search models..."
            className="pl-10"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <Filter className="h-4 w-4" />
          Filters
          {(filterType !== 'all' || filterStatus !== 'all') && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded">
              {[filterType !== 'all', filterStatus !== 'all'].filter(Boolean).length}
            </span>
          )}
        </button>

        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as DataModelType | 'all')}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Types</option>
                <option value="auto-discovered">Auto-discovered</option>
                <option value="derived">Derived</option>
                <option value="composite">Composite</option>
                <option value="vector">Vector</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as ModelStatus | 'all')}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="undefined-fields">Undefined Fields</option>
                <option value="drift-detected">Drift Detected</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </div>

            {(filterType !== 'all' || filterStatus !== 'all') && (
              <button
                onClick={() => {
                  setFilterType('all');
                  setFilterStatus('all');
                }}
                className="w-full text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredModels.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No models found
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredModels.map((model) => (
              <button
                key={model.id}
                onClick={() => onSelectModel(model.id)}
                className={`w-full p-4 text-left transition-colors ${
                  selectedModelId === model.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="text-gray-400">{typeIcons[model.type]}</div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {model.name}
                    </span>
                  </div>
                  <Badge variant={statusVariants[model.status]}>
                    {model.status === 'undefined-fields' && <AlertCircle className="h-3 w-3" />}
                    {model.status === 'drift-detected' && <AlertCircle className="h-3 w-3" />}
                  </Badge>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                  {model.description}
                </p>

                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="capitalize">{model.type}</span>
                  <span>v{model.version}</span>
                  <span>{(model.attributes || []).length} attrs</span>
                </div>

                {(model.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(model.tags || []).slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{(model.source_count || 0).toLocaleString()} sources</span>
                  <span>{model.agent_count} agents</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
