import { useState } from 'react';
import { AlertTriangle, FileSearch } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { Alert } from '../../services/detectionService';
import type { EventSeverity } from '../../types';

interface CreateInvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    severity: EventSeverity;
    description: string;
    alert_ids: string[];
  }) => Promise<void>;
  availableAlerts?: Alert[];
  prefillAlertId?: string;
}

const SEVERITY_OPTIONS: { value: EventSeverity; label: string; cls: string }[] = [
  { value: 'critical', label: 'Critical', cls: 'text-red-600 dark:text-red-400' },
  { value: 'high', label: 'High', cls: 'text-orange-600 dark:text-orange-400' },
  { value: 'medium', label: 'Medium', cls: 'text-yellow-600 dark:text-yellow-400' },
  { value: 'low', label: 'Low', cls: 'text-blue-600 dark:text-blue-400' },
];

export function CreateInvestigationModal({
  isOpen,
  onClose,
  onSubmit,
  availableAlerts = [],
  prefillAlertId,
}: CreateInvestigationModalProps) {
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<EventSeverity>('medium');
  const [description, setDescription] = useState('');
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(
    new Set(prefillAlertId ? [prefillAlertId] : [])
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleAlert = (alertId: string) => {
    const next = new Set(selectedAlertIds);
    if (next.has(alertId)) {
      next.delete(alertId);
    } else {
      next.add(alertId);
    }
    setSelectedAlertIds(next);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSubmit({
        title: title.trim(),
        severity,
        description: description.trim(),
        alert_ids: Array.from(selectedAlertIds),
      });
      // reset
      setTitle('');
      setSeverity('medium');
      setDescription('');
      setSelectedAlertIds(new Set());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create investigation');
    } finally {
      setSaving(false);
    }
  };

  const triggeredAlerts = availableAlerts.filter(
    (a) => a.status === 'triggered' || a.status === 'acknowledged' || a.status === 'in_progress'
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Investigation">
      <div className="space-y-5">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Suspicious login from unknown IP"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
        </div>

        {/* Severity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Severity
          </label>
          <div className="flex gap-2 flex-wrap">
            {SEVERITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSeverity(opt.value)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                  severity === opt.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 font-medium ' +
                      opt.cls
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description / initial note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Initial Note
            <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what triggered this investigation..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
          />
        </div>

        {/* Link Alerts */}
        {triggeredAlerts.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Link Alerts
              <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {triggeredAlerts.map((alert) => (
                <label
                  key={alert.id}
                  className="flex items-start gap-2.5 p-2 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedAlertIds.has(alert.id)}
                    onChange={() => handleToggleAlert(alert.id)}
                    className="mt-0.5 h-3.5 w-3.5 accent-primary-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {alert.title}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">{alert.severity}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Empty state icon */}
        {triggeredAlerts.length === 0 && availableAlerts.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
            <FileSearch className="h-4 w-4" />
            This investigation will start with no linked alerts. You can add them later.
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
          >
            {saving ? 'Creating...' : 'Create Investigation'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
