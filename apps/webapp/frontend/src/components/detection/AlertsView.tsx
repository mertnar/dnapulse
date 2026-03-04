import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AlertCircle, User, CheckCircle, PlayCircle, FileSearch } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Alert, AlertStatus } from '../../services/detectionService';

interface AlertsViewProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
  onAssign: (alertId: string, user: string) => void;
  onResolve: (alertId: string) => void;
  onStartInvestigation: (alertId: string) => void;
  onViewDetails: (alert: Alert) => void;
}

export function AlertsView({
  alerts,
  onAcknowledge,
  onAssign,
  onResolve,
  onStartInvestigation,
  onViewDetails
}: AlertsViewProps) {
  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'neutral';
    }
  };

  const getStatusIcon = (status: AlertStatus) => {
    switch (status) {
      case 'triggered': return AlertCircle;
      case 'acknowledged': return CheckCircle;
      case 'in_progress': return PlayCircle;
      case 'resolved': return CheckCircle;
    }
  };

  const getStatusColor = (status: AlertStatus) => {
    switch (status) {
      case 'triggered': return 'text-red-600 dark:text-red-400';
      case 'acknowledged': return 'text-yellow-600 dark:text-yellow-400';
      case 'in_progress': return 'text-blue-600 dark:text-blue-400';
      case 'resolved': return 'text-green-600 dark:text-green-400';
    }
  };

  const getStatusLabel = (status: AlertStatus) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const statuses: AlertStatus[] = ['triggered', 'acknowledged', 'in_progress', 'resolved'];

  const groupedAlerts = statuses.reduce((acc, status) => {
    acc[status] = alerts.filter(a => a.status === status);
    return acc;
  }, {} as Record<AlertStatus, Alert[]>);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {statuses.map(status => {
          const Icon = getStatusIcon(status);
          const count = groupedAlerts[status].length;

          return (
            <div key={status} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className={`h-5 w-5 ${getStatusColor(status)}`} />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{count}</span>
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {getStatusLabel(status)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {statuses.map(status => {
          const alerts = groupedAlerts[status];
          if (alerts.length === 0) return null;

          const Icon = getStatusIcon(status);

          return (
            <div key={status}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Icon className={`h-5 w-5 ${getStatusColor(status)}`} />
                {getStatusLabel(status)}
              </h3>
              <div className="space-y-3">
                {alerts.map(alert => (
                  <div
                    key={alert.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => onViewDetails(alert)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={getSeverityVariant(alert.severity)} size="sm">
                          {alert.severity}
                        </Badge>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {alert.ruleName}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 mb-3">
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {alert.triggerCount} events
                      </span>
                      {alert.assignedTo && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {alert.assignedTo}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {status === 'triggered' && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onAcknowledge(alert.id)}
                          >
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onStartInvestigation(alert.id)}
                          >
                            <FileSearch className="h-3 w-3 mr-1" />
                            Investigate
                          </Button>
                        </>
                      )}
                      {status === 'acknowledged' && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onStartInvestigation(alert.id)}
                          >
                            <FileSearch className="h-3 w-3 mr-1" />
                            Investigate
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onResolve(alert.id)}
                          >
                            Resolve
                          </Button>
                        </>
                      )}
                      {status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onResolve(alert.id)}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
