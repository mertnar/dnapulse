import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Plus, HardDrive } from 'lucide-react';
import { storageService } from '../services/storageService';
import type { LifecyclePolicy } from '../types';

export function Storage() {
  const [policies, setPolicies] = useState<LifecyclePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        setLoading(true);
        const data = await storageService.getLifecyclePolicies();
        setPolicies(data);
      } catch (error) {
        console.error('Failed to fetch lifecycle policies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPolicies();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }
  const columns = [
    { key: 'name', header: 'Policy Name' },
    { key: 'hot_retention_days', header: 'Hot Tier', render: (policy: any) => (
      <span>{policy.hot_retention_days} days</span>
    )},
    { key: 'medium_retention_days', header: 'Medium Tier', render: (policy: any) => (
      <span>{policy.medium_retention_days} days</span>
    )},
    { key: 'cold_retention_days', header: 'Cold Tier', render: (policy: any) => (
      <span>{policy.cold_retention_days} days</span>
    )},
    { key: 'data_type', header: 'Data Type', render: (policy: any) => (
      <span>{policy.data_type || 'All'}</span>
    )}
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Storage & Lifecycle</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage data retention and storage lifecycle policies
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Hot Storage</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">12.3 TB</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">85% capacity</p>
            </div>
            <HardDrive className="h-8 w-8 text-red-600" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Medium Storage</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">28.7 TB</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">62% capacity</p>
            </div>
            <HardDrive className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Cold Storage</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">127.5 TB</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">41% capacity</p>
            </div>
            <HardDrive className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lifecycle Policies</h2>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Policy
          </Button>
        </div>
        <Table data={policies} columns={columns} />
      </Card>
    </div>
  );
}
