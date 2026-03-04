import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Table } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Plus, Database } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { dataSourcesService } from '../services/dataSourcesService';
import type { DataSource } from '../types';

export function DataSources() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const fetchDataSources = async () => {
      try {
        setLoading(true);
        const data = await dataSourcesService.getDataSources();
        setDataSources(data);
      } catch (error) {
        console.error('Failed to fetch data sources:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDataSources();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  const columns = [
    { key: 'name', header: 'Name', render: (ds: any) => (
      <Link to={`/data-sources/${ds.id}`} className="font-medium text-primary-600 hover:text-primary-700">
        {ds.name}
      </Link>
    )},
    { key: 'type', header: 'Type', render: (ds: any) => (
      <Badge variant="neutral">{ds.type}</Badge>
    )},
    { key: 'status', header: 'Status', render: (ds: any) => (
      <Badge variant={ds.status === 'active' ? 'success' : ds.status === 'error' ? 'danger' : 'warning'}>
        {ds.status}
      </Badge>
    )},
    { key: 'throughput', header: 'Throughput', render: (ds: any) => (
      <span>{ds.throughput.toLocaleString()} events/s</span>
    )},
    { key: 'last_seen', header: 'Last Seen', render: (ds: any) => (
      <span>{formatDistanceToNow(new Date(ds.last_seen), { addSuffix: true })}</span>
    )}
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Data Sources</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage and monitor your data ingestion sources
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Data Source
        </Button>
      </div>

      <Card padding={false}>
        <Table data={dataSources} columns={columns} />
      </Card>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Data Source"
        size="lg"
      >
        <div className="space-y-4">
          <Input label="Name" placeholder="Enter source name" />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Source Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['Agent', 'ELK/Elastic', 'API/Webhook', 'Custom SDK', 'Network/IoT Stream'].map(type => (
                <button
                  key={type}
                  className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-left"
                >
                  <Database className="h-6 w-6 text-gray-600 dark:text-gray-400 mb-2" />
                  <p className="font-medium text-gray-900 dark:text-white">{type}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddModal(false)}>
              Continue
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
