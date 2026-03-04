import { useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  AlertCircle,
  Activity,
  FileText,
  Server,
  User,
  Globe,
  Plus,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Investigation, InvestigationStatus } from '../../services/detectionService';

interface InvestigationCanvasProps {
  investigation: Investigation;
  onAddNote: (content: string) => void;
  onUpdateStatus: (status: InvestigationStatus) => void;
  onClose: () => void;
}

export function InvestigationCanvas({
  investigation,
  onAddNote,
  onUpdateStatus,
  onClose
}: InvestigationCanvasProps) {
  const [noteContent, setNoteContent] = useState('');

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'neutral';
    }
  };

  const getStatusColor = (status: InvestigationStatus) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'closed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    }
  };

  const handleAddNote = () => {
    if (noteContent.trim()) {
      onAddNote(noteContent);
      setNoteContent('');
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {investigation.name}
              </h1>
              <Badge variant={getSeverityVariant(investigation.severity)}>
                {investigation.severity}
              </Badge>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(investigation.status)}`}>
                {investigation.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Created {formatDistanceToNow(new Date(investigation.createdAt), { addSuffix: true })}
              {investigation.assignedTo && ` • Assigned to ${investigation.assignedTo}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={investigation.status}
              onChange={(e) => onUpdateStatus(e.target.value as InvestigationStatus)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="closed">Closed</option>
            </select>
            <Button variant="secondary" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-medium">Alerts</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {investigation.alertIds.length}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs font-medium">Events</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {investigation.eventIds.length}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
              <Server className="h-4 w-4" />
              <span className="text-xs font-medium">Hosts</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {investigation.relatedHosts.length}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
              <User className="h-4 w-4" />
              <span className="text-xs font-medium">Users</span>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {investigation.relatedUsers.length}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Timeline & Notes
              </h3>

              <div className="mb-4">
                <div className="flex gap-2">
                  <Input
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
                    placeholder="Add a note..."
                    className="flex-1"
                  />
                  <Button onClick={handleAddNote}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Note
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {investigation.notes.map(note => (
                  <div
                    key={note.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {note.author}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{note.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Server className="h-4 w-4" />
                Related Hosts
              </h3>
              <div className="space-y-2">
                {investigation.relatedHosts.map(host => (
                  <div
                    key={host}
                    className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2 text-sm font-mono text-gray-900 dark:text-white"
                  >
                    {host}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Related Users
              </h3>
              <div className="space-y-2">
                {investigation.relatedUsers.map(user => (
                  <div
                    key={user}
                    className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2 text-sm text-gray-900 dark:text-white"
                  >
                    {user}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Related IPs
              </h3>
              <div className="space-y-2">
                {investigation.relatedIPs.map(ip => (
                  <div
                    key={ip}
                    className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-2 text-sm font-mono text-gray-900 dark:text-white"
                  >
                    {ip}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
