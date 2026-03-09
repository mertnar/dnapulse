import { useState } from 'react';
import {
  FileSearch,
  MoreVertical,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Investigation, InvestigationStatus } from '../../services/detectionService';

type StatusFilter = 'all' | InvestigationStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  info: 'bg-gray-400',
};

const STATUS_CONFIG: Record<
  InvestigationStatus,
  { icon: typeof CheckCircle; label: string; cls: string }
> = {
  open: {
    icon: AlertCircle,
    label: 'Open',
    cls: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  },
  in_progress: {
    icon: Clock,
    label: 'In Progress',
    cls: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
  },
  resolved: {
    icon: CheckCircle,
    label: 'Resolved',
    cls: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  },
  closed: {
    icon: XCircle,
    label: 'Closed',
    cls: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
  },
};

interface InvestigationsPanelProps {
  investigations: Investigation[];
  selectedInvestigationId?: string;
  onSelectInvestigation: (inv: Investigation) => void;
  onDeleteInvestigation: (id: string) => void;
  onUpdateStatus: (id: string, status: InvestigationStatus) => void;
  onCreateNew: () => void;
}

export function InvestigationsPanel({
  investigations,
  selectedInvestigationId,
  onSelectInvestigation,
  onDeleteInvestigation,
  onUpdateStatus,
  onCreateNew,
}: InvestigationsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered =
    statusFilter === 'all'
      ? investigations
      : investigations.filter((i) => i.status === statusFilter);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Investigations
        </span>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-2 py-0.5 text-xs rounded-full transition-all ${
              statusFilter === opt.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {opt.label}
            {opt.value !== 'all' && (
              <span className="ml-1 opacity-70">
                {investigations.filter((i) => i.status === opt.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
          <FileSearch className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-xs text-center">No investigations yet</p>
          <button
            onClick={onCreateNew}
            className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            Create one
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((inv) => {
            const statusCfg = STATUS_CONFIG[inv.status];
            const StatusIcon = statusCfg.icon;
            const isSelected = selectedInvestigationId === inv.id;

            return (
              <div
                key={inv.id}
                className={`relative rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <button
                  onClick={() => onSelectInvestigation(inv)}
                  className="w-full text-left p-2.5 pr-8"
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span
                      className={`mt-0.5 flex-shrink-0 h-2 w-2 rounded-full ${SEVERITY_COLORS[inv.severity] || 'bg-gray-400'}`}
                    />
                    <span className="text-xs font-medium text-gray-900 dark:text-white leading-tight line-clamp-2">
                      {inv.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-4">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${statusCfg.cls}`}
                    >
                      <StatusIcon className="h-2.5 w-2.5" />
                      {statusCfg.label}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {inv.alert_ids?.length || 0} alert{inv.alert_ids?.length !== 1 ? 's' : ''}
                    </span>
                    <ChevronRight className="h-3 w-3 text-gray-300 dark:text-gray-600 ml-auto" />
                  </div>
                  {inv.updated_at && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 pl-4 mt-0.5">
                      {formatDistanceToNow(new Date(inv.updated_at), { addSuffix: true })}
                    </p>
                  )}
                </button>

                {/* Context menu */}
                <div className="absolute right-1.5 top-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(expandedId === inv.id ? null : inv.id!);
                    }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    <MoreVertical className="h-3.5 w-3.5 text-gray-400" />
                  </button>

                  {expandedId === inv.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setExpandedId(null)}
                      />
                      <div className="absolute right-0 top-7 z-20 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1">
                        <p className="px-3 py-1 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                          Set Status
                        </p>
                        {(['open', 'in_progress', 'resolved', 'closed'] as InvestigationStatus[]).map(
                          (s) => {
                            const cfg = STATUS_CONFIG[s];
                            const SIcon = cfg.icon;
                            return (
                              <button
                                key={s}
                                onClick={() => {
                                  onUpdateStatus(inv.id!, s);
                                  setExpandedId(null);
                                }}
                                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${
                                  inv.status === s
                                    ? 'text-primary-600 dark:text-primary-400 font-medium'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <SIcon className="h-3 w-3" />
                                {cfg.label}
                              </button>
                            );
                          }
                        )}
                        <hr className="my-1 border-gray-100 dark:border-gray-700" />
                        <button
                          onClick={() => {
                            onDeleteInvestigation(inv.id!);
                            setExpandedId(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
