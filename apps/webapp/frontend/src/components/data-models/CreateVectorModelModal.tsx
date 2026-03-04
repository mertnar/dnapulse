import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Zap } from 'lucide-react';
import type { DataModelExtended } from '../../types';

interface CreateVectorModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceModel: DataModelExtended | null;
  models: DataModelExtended[];
  onCreate: (params: {
    name: string;
    source_model_id: string;
    text_field: string;
    embedding_model?: string;
    dimensions?: number;
  }) => Promise<void>;
}

export function CreateVectorModelModal({
  isOpen,
  onClose,
  sourceModel,
  models,
  onCreate
}: CreateVectorModelModalProps) {
  const [name, setName] = useState('');
  const [sourceModelId, setSourceModelId] = useState<string>(sourceModel?.id ?? models[0]?.id ?? '');
  const [textField, setTextField] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small');
  const [dimensions, setDimensions] = useState(1536);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedModel = models.find((m) => m.id === sourceModelId) ?? sourceModel;
  const stringAttributes =
    (selectedModel?.attributes || []).filter((a) => a.type === 'string').map((a) => a.name || a.path || '');

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Model name is required');
      return;
    }
    if (!sourceModelId) {
      setError('Source model is required');
      return;
    }
    const field = textField.trim() || stringAttributes[0];
    if (!field) {
      setError('Select a text field to vectorize');
      return;
    }
    try {
      setSaving(true);
      await onCreate({
        name: name.trim(),
        source_model_id: sourceModelId,
        text_field: field,
        embedding_model: embeddingModel,
        dimensions: dimensions
      });
      onClose();
      setName('');
      setTextField('');
    } catch (e: any) {
      setError(e?.message || 'Failed to create vector model');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create vector model" size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Create a new data model that adds a vector embedding of a text field from a source model.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Vector model name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Events Vector"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Source model
          </label>
          <select
            value={sourceModelId}
            onChange={(e) => {
              setSourceModelId(e.target.value);
              setTextField('');
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">Select model</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Text field to vectorize
          </label>
          <select
            value={textField}
            onChange={(e) => setTextField(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">Select field</option>
            {stringAttributes.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
            {stringAttributes.length === 0 && selectedModel && (
              <option value="" disabled>
                No string attributes in this model
              </option>
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Embedding model
          </label>
          <Input
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            placeholder="text-embedding-3-small"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Dimensions
          </label>
          <Input
            type="number"
            value={dimensions}
            onChange={(e) => setDimensions(Number(e.target.value) || 1536)}
            min={1}
            max={4096}
            className="w-full"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={saving}>
            <Zap className="h-4 w-4 mr-2" />
            {saving ? 'Creating...' : 'Create vector model'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
