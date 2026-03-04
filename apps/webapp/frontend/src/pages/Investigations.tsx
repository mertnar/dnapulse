import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Table } from '../components/ui/Table';
import { Button } from '../components/ui/Button';
import { Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { investigationsService } from '../services/investigationsService';
import type { Investigation } from '../types';

export function Investigations() {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvestigations = async () => {
      try {
        setLoading(true);
        const data = await investigationsService.getInvestigations();
        setInvestigations(data);
      } catch (error) {
        console.error('Failed to fetch investigations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvestigations();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }
  const columns = [
    { key: 'title', header: 'Investigation', render: (inv: any) => (
      <Link to={`/investigations/${inv.id}`} className="font-medium text-primary-600 hover:text-primary-700">
        {inv.title}
      </Link>
    )},
    { key: 'status', header: 'Status', render: (inv: any) => (
      <Badge variant={
        inv.status === 'open' ? 'danger' :
        inv.status === 'investigating' ? 'warning' :
        inv.status === 'resolved' ? 'success' : 'neutral'
      }>
        {inv.status}
      </Badge>
    )},
    { key: 'related_alert_ids', header: 'Related Alerts', render: (inv: any) => (
      <span>{inv.related_alert_ids.length}</span>
    )},
    { key: 'notes_count', header: 'Notes', render: (inv: any) => (
      <span>{inv.notes_count}</span>
    )},
    { key: 'created_at', header: 'Created', render: (inv: any) => (
      <span>{formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}</span>
    )}
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Investigations</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Correlate events and track security investigations
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Investigation
        </Button>
      </div>

      <Card padding={false}>
        <Table data={investigations} columns={columns} />
      </Card>
    </div>
  );
}
