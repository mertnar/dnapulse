import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import type { Event } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Search } from 'lucide-react';

interface EventDrawerProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateRule: (event: Event) => void;
  onAddToInvestigation: (event: Event) => void;
}

export function EventDrawer({ event, isOpen, onClose, onCreateRule, onAddToInvestigation }: EventDrawerProps) {
  if (!event) return null;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Event Details">
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <Badge variant={
              event.severity === 'critical' ? 'danger' :
              event.severity === 'high' ? 'warning' :
              event.severity === 'medium' ? 'info' : 'neutral'
            }>
              {event.severity}
            </Badge>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Event Type</label>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{event.event_type}</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Source ID</label>
              <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">{event.source_id}</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tenant</label>
              <p className="text-sm text-gray-900 dark:text-white mt-1">{event.tenant}</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tags</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(event.tags || []).map(tag => (
                  <span key={tag} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Raw Payload</h3>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono">
{JSON.stringify(event.payload, null, 2)}
          </pre>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={() => onCreateRule(event)} className="flex-1">
            <Search className="h-4 w-4 mr-2" />
            Create Rule from Event
          </Button>
          <Button onClick={() => onAddToInvestigation(event)} variant="secondary" className="flex-1">
            <Plus className="h-4 w-4 mr-2" />
            Add to Investigation
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
