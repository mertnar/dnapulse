import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Table } from '../components/ui/Table';
import { formatDistanceToNow } from 'date-fns';
import { auditLogsService } from '../services/auditLogsService';
import { authorizationService } from '../services/authorizationService';
import type { AuditLog, User } from '../types';

export function AuditLogs() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [logsData, usersData] = await Promise.all([
          auditLogsService.getAuditLogs(),
          authorizationService.getUsers()
        ]);
        setAuditLogs(logsData);
        setUsers(usersData);
      } catch (error) {
        console.error('Failed to fetch audit logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }
  const columns = [
    { key: 'user_id', header: 'User', render: (log: any) => {
      const user = users.find(u => u.id === log.user_id);
      return <span>{user?.full_name || 'System'}</span>;
    }},
    { key: 'action', header: 'Action', render: (log: any) => (
      <Badge variant={
        log.action === 'delete' ? 'danger' :
        log.action === 'create' ? 'success' :
        log.action === 'update' ? 'warning' : 'neutral'
      }>
        {log.action}
      </Badge>
    )},
    { key: 'resource_type', header: 'Resource Type' },
    { key: 'ip_address', header: 'IP Address' },
    { key: 'created_at', header: 'Timestamp', render: (log: any) => (
      <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
    )}
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Audit Logs</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Track all user actions and system changes
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Create', count: auditLogs.filter(l => l.action === 'create').length },
          { label: 'Update', count: auditLogs.filter(l => l.action === 'update').length },
          { label: 'Delete', count: auditLogs.filter(l => l.action === 'delete').length },
          { label: 'View', count: auditLogs.filter(l => l.action === 'view').length }
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
        <Table data={auditLogs} columns={columns} />
      </Card>
    </div>
  );
}
