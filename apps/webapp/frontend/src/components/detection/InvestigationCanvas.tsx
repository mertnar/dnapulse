import { useState, useRef, useEffect } from 'react';
import {
  AlertCircle,
  Activity,
  Server,
  User,
  Globe,
  Plus,
  X,
  Trash2,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Edit3,
  Check,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type {
  Investigation,
  InvestigationStatus,
  InvestigationNote,
  Alert,
} from '../../services/detectionService';
import type { EventSeverity } from '../../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface InvestigationCanvasProps {
  investigation: Investigation;
  alerts: Alert[];
  onAddNote: (text: string) => void;
  onUpdateStatus: (status: InvestigationStatus) => void;
  onUpdateTitle: (title: string) => void;
  onUpdateSeverity: (severity: EventSeverity) => void;
  onAddEntity: (type: 'hosts' | 'users' | 'ips', value: string) => void;
  onRemoveEntity: (type: 'hosts' | 'users' | 'ips', value: string) => void;
  onClose: () => void;
  onDelete: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, { dot: string; badge: string }> = {
  critical: {
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  high: {
    dot: 'bg-orange-500',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  medium: {
    dot: 'bg-yellow-500',
    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  low: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  info: {
    dot: 'bg-gray-400',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
};

const STATUS_CONFIG: Record<
  InvestigationStatus,
  { icon: typeof CheckCircle; label: string; cls: string }
> = {
  open: {
    icon: AlertCircle,
    label: 'Open',
    cls: 'text-blue-600 dark:text-blue-400',
  },
  in_progress: {
    icon: Clock,
    label: 'In Progress',
    cls: 'text-yellow-600 dark:text-yellow-400',
  },
  resolved: {
    icon: CheckCircle,
    label: 'Resolved',
    cls: 'text-green-600 dark:text-green-400',
  },
  closed: {
    icon: XCircle,
    label: 'Closed',
    cls: 'text-gray-500 dark:text-gray-400',
  },
};

type TimelineItem =
  | { kind: 'note'; ts: Date; note: InvestigationNote }
  | { kind: 'alert'; ts: Date; alert: Alert };

function buildTimeline(notes: InvestigationNote[], linkedAlerts: Alert[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...notes.map((n) => ({
      kind: 'note' as const,
      ts: new Date(n.created_at as unknown as string),
      note: n,
    })),
    ...linkedAlerts.map((a) => ({
      kind: 'alert' as const,
      ts: new Date(a.created_at),
      alert: a,
    })),
  ];
  return items.sort((a, b) => b.ts.getTime() - a.ts.getTime());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EntityList({
  title,
  icon: Icon,
  items,
  type,
  onAdd,
  onRemove,
}: {
  title: string;
  icon: typeof Server;
  items: string[];
  type: 'hosts' | 'users' | 'ips';
  onAdd: (type: 'hosts' | 'users' | 'ips', value: string) => void;
  onRemove: (type: 'hosts' | 'users' | 'ips', value: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(type, value.trim());
      setValue('');
      setAdding(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5 uppercase tracking-wide">
          <Icon className="h-3.5 w-3.5" />
          {title}
          <span className="font-normal normal-case text-gray-400">({items.length})</span>
        </h4>
        <button
          onClick={() => setAdding(true)}
          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {adding && (
        <div className="flex gap-1 mb-1.5">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setAdding(false); setValue(''); }
            }}
            placeholder={
              type === 'hosts' ? 'hostname or IP' : type === 'users' ? 'username' : 'IP address'
            }
            className="text-xs h-7"
          />
          <button
            onClick={handleAdd}
            className="p-1 text-primary-600 dark:text-primary-400 hover:text-primary-700"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setAdding(false); setValue(''); }}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {items.length === 0 && !adding ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">None</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item}
              className="group flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 rounded px-2 py-1"
            >
              <span className="text-xs font-mono text-gray-800 dark:text-gray-200 truncate">
                {item}
              </span>
              <button
                onClick={() => onRemove(type, item)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all ml-1 flex-shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function InvestigationCanvas({
  investigation,
  alerts,
  onAddNote,
  onUpdateStatus,
  onUpdateTitle,
  onUpdateSeverity,
  onAddEntity,
  onRemoveEntity,
  onClose,
  onDelete,
}: InvestigationCanvasProps) {
  const [noteText, setNoteText] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(investigation.title);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showSeverityMenu, setShowSeverityMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Sync title draft when investigation changes
  useEffect(() => {
    setTitleDraft(investigation.title);
  }, [investigation.title]);

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  const linkedAlerts = (investigation.alert_ids || [])
    .map((id) => alerts.find((a) => a.id === id))
    .filter(Boolean) as Alert[];

  const timeline = buildTimeline(investigation.notes || [], linkedAlerts);

  const entities = investigation.entities || { hosts: [], users: [], ips: [] };

  const handleAddNote = () => {
    if (noteText.trim()) {
      onAddNote(noteText.trim());
      setNoteText('');
    }
  };

  const handleSaveTitle = () => {
    if (titleDraft.trim() && titleDraft !== investigation.title) {
      onUpdateTitle(titleDraft.trim());
    }
    setEditingTitle(false);
  };

  const severityInfo = SEVERITY_COLORS[investigation.severity] || SEVERITY_COLORS['info'];
  const statusCfg = STATUS_CONFIG[investigation.status];
  const StatusIcon = statusCfg.icon;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 min-h-0">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        {/* Title row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  ref={titleRef}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(investigation.title); }
                  }}
                  className="text-lg font-bold h-9"
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1.5 text-green-600 hover:text-green-700 dark:text-green-400"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { setEditingTitle(false); setTitleDraft(investigation.title); }}
                  className="p-1.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="group flex items-center gap-2 text-left"
              >
                <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                  {investigation.title}
                </h1>
                <Edit3 className="h-4 w-4 text-gray-300 group-hover:text-gray-500 dark:group-hover:text-gray-400 flex-shrink-0 transition-colors" />
              </button>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {investigation.created_at &&
                `Created ${formatDistanceToNow(new Date(investigation.created_at as unknown as string), { addSuffix: true })}`}
              {investigation.assigned_to && ` · Assigned to ${investigation.assigned_to}`}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Severity */}
            <div className="relative">
              <button
                onClick={() => { setShowSeverityMenu(!showSeverityMenu); setShowStatusMenu(false); }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${severityInfo.badge} border-transparent`}
              >
                <span className={`h-2 w-2 rounded-full ${severityInfo.dot}`} />
                {investigation.severity}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
              {showSeverityMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSeverityMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
                    {(['critical', 'high', 'medium', 'low'] as EventSeverity[]).map((s) => {
                      const sc = SEVERITY_COLORS[s];
                      return (
                        <button
                          key={s}
                          onClick={() => { onUpdateSeverity(s); setShowSeverityMenu(false); }}
                          className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                            investigation.severity === s ? 'font-semibold' : ''
                          } text-gray-700 dark:text-gray-300`}
                        >
                          <span className={`h-2 w-2 rounded-full ${sc.dot}`} />
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Status */}
            <div className="relative">
              <button
                onClick={() => { setShowStatusMenu(!showStatusMenu); setShowSeverityMenu(false); }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${statusCfg.cls} transition-colors`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {statusCfg.label}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
              {showStatusMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
                    {(Object.entries(STATUS_CONFIG) as [InvestigationStatus, typeof STATUS_CONFIG[InvestigationStatus]][]).map(([s, cfg]) => {
                      const SIcon = cfg.icon;
                      return (
                        <button
                          key={s}
                          onClick={() => { onUpdateStatus(s); setShowStatusMenu(false); }}
                          className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${cfg.cls} ${
                            investigation.status === s ? 'font-semibold' : ''
                          }`}
                        >
                          <SIcon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Delete */}
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-red-600 dark:text-red-400">Delete?</span>
                <button
                  onClick={() => { onDelete(); setConfirmDelete(false); }}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete investigation"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              icon: AlertCircle,
              label: 'Alerts',
              value: investigation.alert_ids?.length || 0,
              color: 'text-red-500',
            },
            {
              icon: Activity,
              label: 'Events',
              value: investigation.event_refs?.length || 0,
              color: 'text-blue-500',
            },
            {
              icon: Server,
              label: 'Hosts',
              value: entities.hosts?.length || 0,
              color: 'text-purple-500',
            },
            {
              icon: User,
              label: 'Users',
              value: entities.users?.length || 0,
              color: 'text-green-500',
            },
          ].map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 flex items-center gap-2.5"
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${color}`} />
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                  {value}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden flex min-h-0">
        {/* Timeline & Notes (left 2/3) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 border-r border-gray-100 dark:border-gray-800 space-y-4 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            Timeline & Notes
          </h3>

          {/* Note input */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
                placeholder="Add a note… (Enter to submit, Shift+Enter for new line)"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddNote}
              disabled={!noteText.trim()}
              className="self-end"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Timeline */}
          {timeline.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-gray-500">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No activity yet. Add a note to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map((item, idx) => {
                if (item.kind === 'note') {
                  const note = item.note;
                  return (
                    <div key={`note-${note.id || idx}`} className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <FileText className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-gray-900 dark:text-white">
                            {note.author_email || 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500" title={format(item.ts, 'PPpp')}>
                            {formatDistanceToNow(item.ts, { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {note.text}
                        </p>
                      </div>
                    </div>
                  );
                }

                // alert timeline item
                const alert = item.alert;
                const sc = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS['info'];
                return (
                  <div key={`alert-${alert.id}`} className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Zap className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/40 rounded-xl px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${sc.badge}`}
                          >
                            {alert.severity.toUpperCase()}
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {alert.title}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0" title={format(item.ts, 'PPpp')}>
                          {formatDistanceToNow(item.ts, { addSuffix: true })}
                        </span>
                      </div>
                      {alert.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                          {alert.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel — Entities & Context (1/3) */}
        <div className="w-72 flex-shrink-0 overflow-y-auto px-4 py-4 space-y-5">
          {/* Entities */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Globe className="h-4 w-4 text-gray-400" />
              Entities
            </h3>
            <EntityList
              title="Hosts"
              icon={Server}
              items={entities.hosts || []}
              type="hosts"
              onAdd={onAddEntity}
              onRemove={onRemoveEntity}
            />
            <EntityList
              title="Users"
              icon={User}
              items={entities.users || []}
              type="users"
              onAdd={onAddEntity}
              onRemove={onRemoveEntity}
            />
            <EntityList
              title="IP Addresses"
              icon={Globe}
              items={entities.ips || []}
              type="ips"
              onAdd={onAddEntity}
              onRemove={onRemoveEntity}
            />
          </div>

          <hr className="border-gray-100 dark:border-gray-800" />

          {/* Linked Alerts */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-gray-400" />
              Linked Alerts
              <span className="text-xs font-normal text-gray-400">
                ({linkedAlerts.length})
              </span>
            </h3>
            {linkedAlerts.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                No linked alerts
              </p>
            ) : (
              <div className="space-y-1.5">
                {linkedAlerts.map((alert) => {
                  const sc = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS['info'];
                  return (
                    <div
                      key={alert.id}
                      className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800"
                    >
                      <span
                        className={`flex-shrink-0 mt-0.5 h-2 w-2 rounded-full ${sc.dot}`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                          {alert.title}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">{alert.status}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <hr className="border-gray-100 dark:border-gray-800" />

          {/* Related Events */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-gray-400" />
              Related Events
              <span className="text-xs font-normal text-gray-400">
                ({investigation.event_refs?.length || 0})
              </span>
            </h3>
            {!investigation.event_refs || investigation.event_refs.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                No related events
              </p>
            ) : (
              <div className="space-y-1">
                {investigation.event_refs.map((ref) => (
                  <div
                    key={ref.event_id}
                    className="px-2 py-1.5 rounded bg-gray-50 dark:bg-gray-800"
                  >
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
                      {ref.event_id}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
