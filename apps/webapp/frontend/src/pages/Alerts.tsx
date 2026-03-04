import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Table } from '../components/ui/Table';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { alertsService } from '../services/alertsService';
import type { Alert } from '../types';

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        const data = await alertsService.getAlerts();
        setAlerts(data);
      } catch (error) {
        console.error('Failed to fetch alerts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }
  const columns = [
    { key: 'title', header: 'Alert', render: (alert: any) => (
      <Link to={`/alerts/${alert.id}`} className="font-medium text-primary-600 hover:text-primary-700">
        {alert.title}
      </Link>
    )},
    { key: 'severity', header: 'Severity', render: (alert: any) => (
      <Badge variant={
        alert.severity === 'critical' ? 'danger' :
        alert.severity === 'high' ? 'warning' : 'info'
      }>
        {alert.severity}
      </Badge>
    )},
    { key: 'status', header: 'Status', render: (alert: any) => (
      <Badge variant={
        alert.status === 'new' ? 'danger' :
        alert.status === 'acknowledged' ? 'warning' :
        alert.status === 'resolved' ? 'success' : 'neutral'
      }>
        {alert.status}
      </Badge>
    )},
    { key: 'created_at', header: 'Created', render: (alert: any) => (
      <span>{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}</span>
    )}
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Alerts</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Monitor and manage security and operational alerts
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'New', count: 5, variant: 'danger' as const },
          { label: 'Acknowledged', count: 8, variant: 'warning' as const },
          { label: 'Investigating', count: 3, variant: 'info' as const },
          { label: 'Resolved', count: 12, variant: 'success' as const }
        ].map(stat => (
          <Card key={stat.label}>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.count}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card padding={false}>
        <Table data={alerts} columns={columns} />
      </Card>
    </div>
  );
}
