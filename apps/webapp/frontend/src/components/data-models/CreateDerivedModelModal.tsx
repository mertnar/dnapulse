import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ChevronLeft, ChevronRight, Database } from 'lucide-react';
import { dataModelsService } from '../../services/dataModelsService';
import type { DataModelExtended, ModelAttribute } from '../../types';

interface CreateDerivedModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: DataModelExtended[];
  defaultSourceModelId?: string | null;
  onCreate: (params: {
    name: string;
    source_model_ids: string[];
    attributes?: Array<{ path: string; type: string }>;
    pipeline?: { steps: any[] };
  }) => Promise<void>;
}

const STEPS = [
  { number: 1, title: 'Name & source models' },
  { number: 2, title: 'Attributes' },
  { number: 3, title: 'Review & create' }
];

export function CreateDerivedModelModal({
  isOpen,
  onClose,
  models,
  defaultSourceModelId,
  onCreate
}: CreateDerivedModelModalProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [sourceModelIds, setSourceModelIds] = useState<string[]>(
    defaultSourceModelId ? [defaultSourceModelId] : []
  );
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceModelsWithAttributes, setSourceModelsWithAttributes] = useState<DataModelExtended[] | null>(null);
  const [loadingAttributes, setLoadingAttributes] = useState(false);

  const sourceModels = models.filter((m) => sourceModelIds.includes(m.id));

  // When on step 2, fetch full model details (with attributes from ES) for selected source models.
  // We keep the fetched models so that step 3 can still display the selected attributes.
  useEffect(() => {
    if (step !== 2 || sourceModelIds.length === 0) {
      return;
    }
    let cancelled = false;
    setLoadingAttributes(true);
    Promise.all(sourceModelIds.map((id) => dataModelsService.getDataModelById(id)))
      .then((results) => {
        if (cancelled) return;
        const fullModels = results.filter((m): m is DataModelExtended => m != null);
        setSourceModelsWithAttributes(fullModels);
      })
      .catch(() => {
        if (!cancelled) setSourceModelsWithAttributes([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAttributes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, sourceModelIds.join(',')]);

  const modelsForAttributes = sourceModelsWithAttributes && sourceModelsWithAttributes.length > 0
    ? sourceModelsWithAttributes
    : sourceModels;

  const allAttributes: { modelId: string; modelName: string; attr: ModelAttribute }[] = modelsForAttributes.flatMap((m) =>
    (m.attributes || []).map((attr) => {
      const attrWithId = {
        ...attr,
        id: attr.id || (attr as any).path || attr.name || '',
        name: attr.name || (attr as any).path || ''
      } as ModelAttribute;
      return { modelId: m.id, modelName: m.name, attr: attrWithId };
    })
  );
  const selectedAttrs = allAttributes.filter((a) =>
    selectedAttributeIds.includes(`${a.modelId}:${a.attr.id}`)
  );

  const toggleSourceModel = (id: string) => {
    setSourceModelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setSelectedAttributeIds([]);
  };

  const toggleAttribute = (key: string) => {
    setSelectedAttributeIds((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!name.trim()) {
        setError('Model name is required');
        return;
      }
      if (sourceModelIds.length === 0) {
        setError('Select at least one source model');
        return;
      }
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleCreate = async () => {
    setError(null);
    try {
      setSaving(true);
      const attributes =
        selectedAttrs.length > 0
          ? selectedAttrs.map(({ attr }) => ({ path: attr.name, type: attr.type }))
          : undefined;
      await onCreate({
        name: name.trim(),
        source_model_ids: sourceModelIds,
        attributes,
        pipeline: { steps: [] }
      });
      onClose();
      setName('');
      setSourceModelIds(defaultSourceModelId ? [defaultSourceModelId] : []);
      setSelectedAttributeIds([]);
      setStep(1);
    } catch (e: any) {
      setError(e?.message || 'Failed to create derived model');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onClose();
    setStep(1);
    setError(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create derived model" size="lg">
      <div className="space-y-6">
        <div className="flex gap-2">
          {STEPS.map((s) => (
            <div
              key={s.number}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
                step === s.number
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              <span>{s.number}</span>
              <span>{s.title}</span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Model name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Security Events Derived"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Source models
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
                {models.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sourceModelIds.includes(m.id)}
                      onChange={() => toggleSourceModel(m.id)}
                      className="rounded border-gray-300"
                    />
                    <Database className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-900 dark:text-white">{m.name}</span>
                    <span className="text-xs text-gray-500">({m.type})</span>
                  </label>
                ))}
                {models.length === 0 && (
                  <p className="text-sm text-gray-500">No models available</p>
                )}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Attributes to include (optional – leave empty to copy all later via pipeline)
            </label>
            <div className="max-h-56 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
              {loadingAttributes && (
                <p className="text-sm text-gray-500">Loading attributes…</p>
              )}
              {!loadingAttributes && allAttributes.map(({ modelId, modelName, attr }) => {
                const key = `${modelId}:${attr.id}`;
                return (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAttributeIds.includes(key)}
                      onChange={() => toggleAttribute(key)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-mono text-gray-900 dark:text-white">
                      {attr.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {modelName} · {attr.type}
                    </span>
                  </label>
                );
              })}
              {!loadingAttributes && allAttributes.length === 0 && (
                <p className="text-sm text-gray-500">Select source models in step 1 first, or this model has no attributes yet.</p>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 space-y-2">
            <p>
              <span className="text-sm text-gray-500">Name:</span>{' '}
              <span className="font-medium text-gray-900 dark:text-white">{name || '—'}</span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Source models:</span>{' '}
              <span className="text-gray-900 dark:text-white">
                {sourceModels.map((m) => m.name).join(', ') || '—'}
              </span>
            </p>
            <p>
              <span className="text-sm text-gray-500">Attributes:</span>{' '}
              <span className="text-gray-900 dark:text-white">
                {selectedAttrs.length > 0
                  ? selectedAttrs.map((a) => a.attr.name).join(', ')
                  : 'All (or configure in pipeline later)'}
              </span>
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-between pt-2">
          <div>
            {step > 1 ? (
              <Button variant="secondary" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            ) : (
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
            )}
          </div>
          <div>
            {step < 3 ? (
              <Button variant="primary" onClick={handleNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button variant="primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating...' : 'Create derived model'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
