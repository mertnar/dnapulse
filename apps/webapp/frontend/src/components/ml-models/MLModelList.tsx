import { useState } from 'react';
import { Search, Filter, Brain, Activity, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import type { MLModelExtended, MLModelType, MLModelStatus, DeploymentStatus } from '../../types';
import { formatDistanceToNow } from 'date-fns';

interface MLModelListProps {
  models: MLModelExtended[];
  selectedModelId: string | null;
  onSelectModel: (modelId: string) => void;
}

const typeColors: Record<MLModelType, string> = {
  'anomaly': 'text-orange-600 dark:text-orange-400',
  'classification': 'text-blue-600 dark:text-blue-400',
  'nlp': 'text-green-600 dark:text-green-400',
  'vector': 'text-purple-600 dark:text-purple-400'
};

const statusVariants: Record<MLModelStatus, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  'research': 'default',
  'trained': 'info',
  'validated': 'warning',
  'deployed': 'success',
  'deprecated': 'error'
};

const deploymentIcons: Record<DeploymentStatus, React.ReactNode> = {
  'running': <Activity className="h-3 w-3 text-green-600" />,
  'stopped': <XCircle className="h-3 w-3 text-gray-400" />,
  'error': <AlertCircle className="h-3 w-3 text-red-600" />
};

export function MLModelList({ models, selectedModelId, onSelectModel }: MLModelListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<MLModelType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<MLModelStatus | 'all'>('all');
  const [filterDeployment, setFilterDeployment] = useState<DeploymentStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (model.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === 'all' || model.type === filterType;
    const matchesStatus = filterStatus === 'all' || model.status === filterStatus;
    const matchesDeployment = filterDeployment === 'all' || model.deployment_status === filterDeployment;
    return matchesSearch && matchesType && matchesStatus && matchesDeployment;
  });

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          ML Models Registry
        </h2>

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
          {(filterType !== 'all' || filterStatus !== 'all' || filterDeployment !== 'all') && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded">
              {[filterType !== 'all', filterStatus !== 'all', filterDeployment !== 'all'].filter(Boolean).length}
            </span>
          )}
        </button>

        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Model Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as MLModelType | 'all')}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Types</option>
                <option value="anomaly">Anomaly Detection</option>
                <option value="classification">Classification</option>
                <option value="nlp">NLP</option>
                <option value="vector">Vector/Embedding</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as MLModelStatus | 'all')}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="research">Research</option>
                <option value="trained">Trained</option>
                <option value="validated">Validated</option>
                <option value="deployed">Deployed</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Deployment
              </label>
              <select
                value={filterDeployment}
                onChange={(e) => setFilterDeployment(e.target.value as DeploymentStatus | 'all')}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All States</option>
                <option value="running">Running</option>
                <option value="stopped">Stopped</option>
                <option value="error">Error</option>
              </select>
            </div>

            {(filterType !== 'all' || filterStatus !== 'all' || filterDeployment !== 'all') && (
              <button
                onClick={() => {
                  setFilterType('all');
                  setFilterStatus('all');
                  setFilterDeployment('all');
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
                    <Brain className={`h-4 w-4 ${typeColors[model.type]}`} />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {model.name}
                    </span>
                  </div>
                  {deploymentIcons[model.deployment_status]}
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                  {model.description}
                </p>

                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={statusVariants[model.status]} className="text-xs">
                    {model.status}
                  </Badge>
                  <span className="text-xs text-gray-500">v{model.version}</span>
                  <span className="text-xs text-gray-500 capitalize">{model.type}</span>
                </div>

                {model.last_trained && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="h-3 w-3" />
                    Trained {formatDistanceToNow(new Date(model.last_trained), { addSuffix: true })}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
