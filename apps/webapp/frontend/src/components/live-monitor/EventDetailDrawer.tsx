import { Drawer } from '../ui/Drawer';
import { Tabs } from '../ui/Tabs';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Copy, AlertCircle, FileSearch } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { LiveEvent } from '../../services/liveMonitorService';

interface EventDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  event: LiveEvent | null;
  onCreateRule?: (event: LiveEvent) => void;
  onAddToInvestigation?: (event: LiveEvent) => void;
}

export function EventDetailDrawer({
  isOpen,
  onClose,
  event,
  onCreateRule,
  onAddToInvestigation
}: EventDetailDrawerProps) {
  if (!event) return null;

  // Helper function to safely parse timestamp from event
  const parseEventTimestamp = (event: LiveEvent): Date => {
    const eventAny = event as any;

    // Try payload.@ts first
    if (eventAny.payload?.['@ts']) {
      const ts = new Date(eventAny.payload['@ts']);
      if (!isNaN(ts.getTime())) return ts;
    }

    // Fallback to created_at
    if (eventAny.created_at) {
      const ts = new Date(eventAny.created_at);
      if (!isNaN(ts.getTime())) return ts;
    }

    // Fallback to ingested_at
    if (eventAny.ingested_at) {
      const ts = new Date(eventAny.ingested_at);
      if (!isNaN(ts.getTime())) return ts;
    }

    // Last resort: current time
    return new Date();
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'neutral';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  // Extract fields from payload or event
  const eventAny = event as any;
  const eventTimestamp = parseEventTimestamp(event);
  const severity = eventAny.payload?.severity || event.severity || 'info';
  const eventType = eventAny.payload?.event_type || event.event_type || 'unknown';
  const host = eventAny.payload?.host || event.host;
  const user = eventAny.payload?.user || event.user;
  const service = eventAny.payload?.service || event.service;
  const ipAddress = eventAny.payload?.ip_address || event.ip_address;
  const processName = eventAny.payload?.process_name || event.process_name;
  const filePath = eventAny.payload?.file_path || event.file_path;
  const networkProtocol = eventAny.payload?.network_protocol || event.network_protocol;
  const port = eventAny.payload?.port || event.port;
  const eventId = event.id || eventAny._id || eventAny.event_id || 'unknown';
  const sourceId = eventAny.source || eventAny.agent_id || eventAny.source_id || 'unknown';

  const summaryTab = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Event ID</label>
          <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">{eventId}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Timestamp</label>
          <p className="text-sm text-gray-900 dark:text-white mt-1">
            {eventTimestamp.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatDistanceToNow(eventTimestamp, { addSuffix: true })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Severity</label>
          <div className="mt-1">
            <Badge variant={getSeverityVariant(severity)}>{severity}</Badge>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Event Type</label>
          <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">{eventType}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Source</label>
          <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">{sourceId}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Host</label>
          <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">{host || '-'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</label>
          <p className="text-sm text-gray-900 dark:text-white mt-1">{user || '-'}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Service</label>
          <p className="text-sm text-gray-900 dark:text-white mt-1">{service || '-'}</p>
        </div>
      </div>

      {ipAddress && (
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">IP Address</label>
          <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">{ipAddress}</p>
        </div>
      )}

      {processName && (
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Process</label>
          <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">{processName}</p>
        </div>
      )}

      {filePath && (
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">File Path</label>
          <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">{filePath}</p>
        </div>
      )}

      {networkProtocol && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Protocol</label>
            <p className="text-sm text-gray-900 dark:text-white mt-1">{networkProtocol}</p>
          </div>
          {port && (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Port</label>
              <p className="text-sm text-gray-900 dark:text-white mt-1">{port}</p>
            </div>
          )}
        </div>
      )}

      {((event as any).tags && (event as any).tags.length > 0) && (
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tags</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {(event as any).tags.map((tag: string, idx: number) => (
              <Badge key={idx} variant="neutral">{tag}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const parsedTab = (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Parsed Event</h4>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => copyToClipboard(JSON.stringify((event as any).payload || event, null, 2))}
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
      </div>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
        {JSON.stringify((event as any).payload || event, null, 2)}
      </pre>
    </div>
  );

  const rawTab = (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Raw Event</h4>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => copyToClipboard(JSON.stringify(event, null, 2))}
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
      </div>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
        {JSON.stringify(event, null, 2)}
      </pre>
    </div>
  );

  const metadataTab = (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Organization ID</label>
        <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">{event.organization_id}</p>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tenant</label>
        <p className="text-sm text-gray-900 dark:text-white mt-1">{event.tenant || 'default'}</p>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ingestion Time</label>
        <p className="text-sm text-gray-900 dark:text-white mt-1">
          {eventTimestamp.toISOString()}
        </p>
      </div>
    </div>
  );

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Event Details">
      <div className="space-y-6">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onCreateRule?.(event)}
            className="flex-1"
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            Create Rule
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAddToInvestigation?.(event)}
            className="flex-1"
          >
            <FileSearch className="h-3 w-3 mr-1" />
            Add to Investigation
          </Button>
        </div>

        <Tabs
          tabs={[
            { id: 'summary', label: 'Summary', content: summaryTab },
            { id: 'parsed', label: 'Parsed Event', content: parsedTab },
            { id: 'raw', label: 'Raw Event', content: rawTab },
            { id: 'metadata', label: 'Metadata', content: metadataTab }
          ]}
        />
      </div>
    </Drawer>
  );
}
