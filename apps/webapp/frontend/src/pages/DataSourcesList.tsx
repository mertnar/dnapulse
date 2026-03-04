import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import {
  Plus,
  Search,
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertTriangle,
  PowerOff,
  Power,
  Trash2,
  PlayCircle,
  Database,
  Eye,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { dataSourcesService } from '../services/dataSourcesService';
import type { DataSource, DataSourceType, DataSourceStatus, DriftStatus } from '../types';
import { AddDataSourceWizard } from '../components/data-sources/AddDataSourceWizard';

export function DataSourcesList() {
  const navigate = useNavigate();
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [filteredSources, setFilteredSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [selectedDrift, setSelectedDrift] = useState<string>('all');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchDataSources();
  }, []);

  useEffect(() => {
    filterSources();
  }, [dataSources, searchQuery, selectedType, selectedStatus, selectedModel, selectedDrift]);

  const fetchDataSources = async () => {
    try {
      setLoading(true);
      const sources = await dataSourcesService.getDataSources();
      setDataSources(sources);
    } catch (error) {
      console.error('Failed to fetch data sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterSources = () => {
    let filtered = [...dataSources];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ds =>
        ds.name.toLowerCase().includes(query) ||
        ds.type.toLowerCase().includes(query)
      );
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(ds => ds.type === selectedType);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(ds => ds.status === selectedStatus);
    }

    if (selectedModel !== 'all') {
      if (selectedModel === 'defined') {
        filtered = filtered.filter(ds => ds.model_id !== null);
      } else {
        filtered = filtered.filter(ds => ds.model_id === null);
      }
    }

    if (selectedDrift !== 'all') {
      filtered = filtered.filter(ds => ds.drift_status === selectedDrift);
    }

    setFilteredSources(filtered);
  };

  const handleRowSelect = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === filteredSources.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredSources.map(ds => ds.id)));
    }
  };

  const handleTestConnection = async (id: string) => {
    const result = await dataSourcesService.testConnection(id);
    alert(result.message);
    setOpenMenuId(null);
  };

  const handleRunDiscovery = async (id: string) => {
    try {
      const model = await dataSourcesService.runDiscovery(id);
      const updatedSource = await dataSourcesService.updateDataSource(id, {
        model_id: model.id,
        status: 'active'
      });
      setDataSources(prev => prev.map(ds => ds.id === id ? updatedSource : ds));
      alert('Schema discovery completed successfully');
    } catch (error) {
      console.error('Failed to run discovery:', error);
    }
    setOpenMenuId(null);
  };

  const handleToggleStatus = async (id: string, currentStatus: DataSourceStatus) => {
    const newStatus = currentStatus === 'disabled' ? 'active' : 'disabled';
    const updated = await dataSourcesService.updateDataSource(id, { status: newStatus });
    setDataSources(prev => prev.map(ds => ds.id === id ? updated : ds));
    setOpenMenuId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this data source?')) {
      await dataSourcesService.deleteDataSource(id);
      setDataSources(prev => prev.filter(ds => ds.id !== id));
    }
    setOpenMenuId(null);
  };

  const handleSimulateDrift = async (id: string) => {
    await dataSourcesService.simulateDrift(id);
    const updated = dataSources.find(ds => ds.id === id);
    if (updated) {
      setDataSources(prev => prev.map(ds => ds.id === id ? { ...ds, drift_status: 'detected' as DriftStatus } : ds));
    }
    setOpenMenuId(null);
  };

  const handleBulkAction = async (action: 'enable' | 'disable' | 'discovery') => {
    for (const id of selectedRows) {
      if (action === 'enable' || action === 'disable') {
        await dataSourcesService.updateDataSource(id, {
          status: action === 'enable' ? 'active' : 'disabled'
        });
      } else if (action === 'discovery') {
        const model = await dataSourcesService.runDiscovery(id);
        await dataSourcesService.updateDataSource(id, { model_id: model.id });
      }
    }
    setSelectedRows(new Set());
    fetchDataSources();
  };

  const getStatusBadgeVariant = (status: DataSourceStatus) => {
    switch (status) {
      case 'active': return 'success';
      case 'degraded': return 'warning';
      case 'error': return 'danger';
      case 'disabled': return 'neutral';
      default: return 'neutral';
    }
  };

  const getStatusIcon = (status: DataSourceStatus) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-3 w-3" />;
      case 'degraded': return <AlertTriangle className="h-3 w-3" />;
      case 'error': return <XCircle className="h-3 w-3" />;
      case 'disabled': return <PowerOff className="h-3 w-3" />;
      default: return null;
    }
  };

  const handleWizardComplete = async (newSource: DataSource) => {
    setDataSources(prev => [...prev, newSource]);
    setIsWizardOpen(false);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setSelectedStatus('all');
    setSelectedModel('all');
    setSelectedDrift('all');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Data Sources</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage and monitor your ingestion sources
          </p>
        </div>
        <Button onClick={() => setIsWizardOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Data Source
        </Button>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name, type, or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="Agent">Agent</option>
              <option value="ELK/Elastic">ELK/Elastic</option>
              <option value="API/Webhook">API/Webhook</option>
              <option value="Custom SDK">Custom SDK</option>
              <option value="Network/IoT Stream">Network/IoT Stream</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="degraded">Degraded</option>
              <option value="error">Error</option>
              <option value="disabled">Disabled</option>
            </select>

            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
            >
              <option value="all">All Models</option>
              <option value="defined">Defined</option>
              <option value="undefined">Undefined</option>
            </select>

            <select
              value={selectedDrift}
              onChange={(e) => setSelectedDrift(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
            >
              <option value="all">Schema Drift</option>
              <option value="detected">Drift Detected</option>
              <option value="none">No Drift</option>
            </select>

            {(searchQuery || selectedType !== 'all' || selectedStatus !== 'all' || selectedModel !== 'all' || selectedDrift !== 'all') && (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>

          {selectedRows.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <span className="text-sm font-medium text-primary-900 dark:text-primary-100">
                {selectedRows.size} selected
              </span>
              <Button size="sm" variant="secondary" onClick={() => handleBulkAction('enable')}>
                Enable
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleBulkAction('disable')}>
                Disable
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleBulkAction('discovery')}>
                Run Discovery
              </Button>
            </div>
          )}
        </div>
      </Card>

      {filteredSources.length === 0 && dataSources.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No Data Sources"
          description="Get started by connecting your first data source"
          action={{
            label: 'Add Data Source',
            onClick: () => setIsWizardOpen(true)
          }}
        />
      ) : filteredSources.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No Results"
          description="No data sources match your filters"
          action={{
            label: 'Clear Filters',
            onClick: clearFilters
          }}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left p-4">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === filteredSources.length && filteredSources.length > 0}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-900 dark:text-white">Name</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-900 dark:text-white">Type</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-900 dark:text-white">Throughput</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-900 dark:text-white">Latency (p95)</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-900 dark:text-white">Last Seen</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-900 dark:text-white">Data Model</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-900 dark:text-white">Drift</th>
                  <th className="text-left p-4 text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSources.map((source) => (
                  <tr
                    key={source.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(source.id)}
                        onChange={() => handleRowSelect(source.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => navigate(`/data-sources/${source.id}`)}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                      >
                        {source.name}
                      </button>
                    </td>
                    <td className="p-4">
                      <Badge variant="info">{source.type}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={getStatusBadgeVariant(source.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(source.status)}
                          {source.status}
                        </span>
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-gray-900 dark:text-white">
                      {source.throughput > 0 ? `${source.throughput.toLocaleString()}/s` : '-'}
                    </td>
                    <td className="p-4 text-sm text-gray-900 dark:text-white">
                      {source.latencyP95 > 0 ? `${source.latencyP95}ms` : '-'}
                    </td>
                    <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(source.last_seen), { addSuffix: true })}
                    </td>
                    <td className="p-4">
                      {source.model_id ? (
                        <span className="text-sm text-gray-900 dark:text-white">Defined</span>
                      ) : (
                        <Badge variant="warning">Undefined</Badge>
                      )}
                    </td>
                    <td className="p-4">
                      {source.drift_status === 'detected' ? (
                        <Badge variant="warning">Drift</Badge>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">None</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === source.id ? null : source.id)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                          <MoreVertical className="h-4 w-4 text-gray-500" />
                        </button>
                        {openMenuId === source.id && (
                          <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                            <div className="py-1">
                              <button
                                onClick={() => navigate(`/data-sources/${source.id}`)}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                View Details
                              </button>
                              <button
                                onClick={() => handleTestConnection(source.id)}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              >
                                <PlayCircle className="h-4 w-4" />
                                Test Connection
                              </button>
                              <button
                                onClick={() => handleRunDiscovery(source.id)}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              >
                                <RefreshCw className="h-4 w-4" />
                                Run Discovery
                              </button>
                              <button
                                onClick={() => handleSimulateDrift(source.id)}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              >
                                <AlertTriangle className="h-4 w-4" />
                                Simulate Drift
                              </button>
                              <button
                                onClick={() => handleToggleStatus(source.id, source.status)}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              >
                                {source.status === 'disabled' ? (
                                  <>
                                    <Power className="h-4 w-4" />
                                    Enable
                                  </>
                                ) : (
                                  <>
                                    <PowerOff className="h-4 w-4" />
                                    Disable
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleDelete(source.id)}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AddDataSourceWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onComplete={handleWizardComplete}
      />
    </div>
  );
}
