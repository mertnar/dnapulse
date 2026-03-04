import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { detectionService, type Investigation, type Alert } from '../../services/detectionService';

interface InvestigateModalProps {
  alert: Alert;
  isOpen: boolean;
  onClose: () => void;
  onInvestigationCreated: (investigation: Investigation) => void;
}

export function InvestigateModal({ alert, isOpen, onClose, onInvestigationCreated }: InvestigateModalProps) {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && mode === 'existing') {
      loadInvestigations();
    }
  }, [isOpen, mode]);

  const loadInvestigations = async () => {
    try {
      const data = await detectionService.getInvestigations();
      // Filter to open/in_progress investigations
      setInvestigations(data.filter(inv => inv.status === 'open' || inv.status === 'in_progress'));
    } catch (err: any) {
      console.error('Failed to load investigations:', err);
      setError(err.message);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const investigation = await detectionService.investigateAlert(
        alert.id,
        mode === 'existing' ? selectedInvestigationId : undefined
      );

      onInvestigationCreated(investigation);
      onClose();
    } catch (err: any) {
      console.error('Failed to create investigation:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Investigate Alert
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Alert: <span className="font-medium text-gray-900 dark:text-white">{alert.title}</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Severity: <span className={`font-medium ${
              alert.severity === 'critical' ? 'text-red-600' :
              alert.severity === 'high' ? 'text-orange-600' :
              alert.severity === 'medium' ? 'text-yellow-600' :
              'text-blue-600'
            }`}>{alert.severity}</span>
          </p>
        </div>

        <div className="mb-6">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setMode('new')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                mode === 'new'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Create New Investigation
            </button>
            <button
              onClick={() => setMode('existing')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                mode === 'existing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Add to Existing
            </button>
          </div>

          {mode === 'new' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                A new investigation will be created with this alert and its related events.
              </p>
            </div>
          )}

          {mode === 'existing' && (
            <div>
              {investigations.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    No open investigations found. Create a new one instead.
                  </p>
                </div>
              ) : (
                <select
                  value={selectedInvestigationId}
                  onChange={(e) => setSelectedInvestigationId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select an investigation...</option>
                  {investigations.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.title} ({inv.status})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || (mode === 'existing' && !selectedInvestigationId)}
          >
            {loading ? 'Processing...' : mode === 'new' ? 'Create Investigation' : 'Add to Investigation'}
          </Button>
        </div>
      </div>
    </div>
  );
}
