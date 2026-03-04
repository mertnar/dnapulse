import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import {
  dataModelsService,
  type PipelineStepBackend,
  type AvailableOperation
} from '../../services/dataModelsService';
import type { ModelAttribute } from '../../types';

const OPERATION_TO_RULE: Record<string, string> = {
  math: 'derive_math',
  concat: 'derive_concat',
  conditional: 'derive_conditional',
  vectorize: 'vectorize_openai',
  extract_regex: 'extract_regex',
  normalize: 'normalize'
};

interface PipelineBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelId: string;
  modelName: string;
  pipeline: { id: string; pipeline: { steps: PipelineStepBackend[] } } | null;
  attributes: ModelAttribute[];
  onSave: () => void;
}

export function PipelineBuilderModal({
  isOpen,
  onClose,
  modelId,
  modelName,
  pipeline,
  attributes,
  onSave
}: PipelineBuilderModalProps) {
  const [steps, setSteps] = useState<PipelineStepBackend[]>([]);
  const [operations, setOperations] = useState<AvailableOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addStepOp, setAddStepOp] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSteps(pipeline?.pipeline?.steps?.slice() ?? []);
      dataModelsService.getAvailableOperations().then(setOperations).catch(() => setOperations([]));
    }
  }, [isOpen, pipeline]);

  const handleAddStep = (opId: string) => {
    const op = operations.find((o) => o.id === opId);
    if (!op) return;
    const ruleType = OPERATION_TO_RULE[opId] || opId;
    const inputPath = attributes[0]?.name ?? 'field';
    const outputPath = op.outputs[0]?.type === 'vector' ? `${inputPath}_vector` : `derived_${opId}_${steps.length}`;
    const newStep: PipelineStepBackend = {
      id: `step_${Date.now()}`,
      type: opId,
      operation: ruleType,
      inputs: [{ path: inputPath }],
      params: {},
      outputs: [{ path: outputPath, type: op.outputs[0]?.type ?? 'string' }]
    };
    setSteps((prev) => [...prev, newStep]);
    setAddStepOp(null);
  };

  const handleRemoveStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, field: string, value: any) => {
    setSteps((prev) => {
      const next = [...prev];
      const step = { ...next[index] };
      if (field === 'inputs') step.inputs = value;
      else if (field === 'outputs') step.outputs = value;
      else if (field === 'params') step.params = value;
      next[index] = step;
      return next;
    });
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      if (pipeline?.id) {
        await dataModelsService.updatePipeline(modelId, pipeline.id, {
          pipeline: { steps }
        });
      } else {
        await dataModelsService.createPipeline(modelId, {
          pipeline: { steps },
          status: 'draft'
        });
      }
      onSave();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to save pipeline');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pipeline" size="xl">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Model: <span className="font-medium text-gray-900 dark:text-white">{modelName}</span>
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Add step:</span>
          {operations.map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => setAddStepOp(addStepOp === op.id ? null : op.id)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                addStepOp === op.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {op.name}
            </button>
          ))}
          {loading && <span className="text-sm text-gray-500">Loading operations...</span>}
        </div>

        {addStepOp && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Add as new step?</span>
            <Button variant="primary" size="sm" onClick={() => handleAddStep(addStepOp)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAddStepOp(null)}>
              Cancel
            </Button>
          </div>
        )}

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
          {steps.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No steps. Add a step above to build the pipeline.
            </div>
          ) : (
            steps.map((step, index) => (
              <div
                key={step.id}
                className="p-4 flex items-start gap-3 bg-white dark:bg-gray-900"
              >
                <div className="flex items-center gap-1 text-gray-400">
                  <GripVertical className="h-4 w-4" />
                  <span className="text-xs font-medium text-gray-500">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {step.type}
                    </span>
                    {step.operation && (
                      <span className="text-xs text-gray-500">({step.operation})</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Inputs: </span>
                      <input
                        type="text"
                        value={step.inputs?.map((i) => i.path ?? i.field).join(', ') ?? ''}
                        onChange={(e) =>
                          handleStepChange(
                            index,
                            'inputs',
                            e.target.value
                              .split(',')
                              .map((p) => p.trim())
                              .filter(Boolean)
                              .map((path) => ({ path }))
                          )
                        }
                        placeholder="field1, field2"
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <span className="text-gray-500">Output: </span>
                      <input
                        type="text"
                        value={step.outputs?.[0]?.path ?? ''}
                        onChange={(e) =>
                          handleStepChange(index, 'outputs', [
                            { path: e.target.value, type: step.outputs?.[0]?.type ?? 'string' }
                          ])
                        }
                        placeholder="output_field"
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveStep(index)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  title="Remove step"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save pipeline'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
