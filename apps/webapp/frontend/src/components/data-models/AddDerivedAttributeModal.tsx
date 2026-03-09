import { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { ModelAttribute } from '../../types';

export type DeriveOperation =
  | 'derive_math'
  | 'derive_concat'
  | 'derive_conditional'
  | 'vectorize_openai'
  | 'extract_regex'
  | 'normalize';

interface AddDerivedAttributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelName: string;
  existingAttributes: ModelAttribute[];
  nextOrder: number;
  onSave: (attribute: Omit<ModelAttribute, 'id'>) => Promise<void>;
}

const OPERATION_LABELS: Record<DeriveOperation, string> = {
  derive_math: 'Math',
  derive_concat: 'Concat',
  derive_conditional: 'Conditional',
  vectorize_openai: 'Vectorize (OpenAI)',
  extract_regex: 'Extract (Regex)',
  normalize: 'Normalize'
};

const OPERATION_OUTPUT_TYPES: Record<DeriveOperation, ModelAttribute['type']> = {
  derive_math: 'number',
  derive_concat: 'string',
  derive_conditional: 'string',
  vectorize_openai: 'vector',
  extract_regex: 'string',
  normalize: 'string'
};

export function AddDerivedAttributeModal({
  isOpen,
  onClose,
  modelName,
  existingAttributes,
  nextOrder,
  onSave
}: AddDerivedAttributeModalProps) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [operation, setOperation] = useState<DeriveOperation>('derive_math');
  const [sourceAttributeIds, setSourceAttributeIds] = useState<string[]>([]);
  const [expression, setExpression] = useState('');
  const [advancedExpression, setAdvancedExpression] = useState('');
  const [advancedSourcePaths, setAdvancedSourcePaths] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceAttrs = useMemo(
    () => existingAttributes.filter((a) => sourceAttributeIds.includes(a.id)),
    [existingAttributes, sourceAttributeIds]
  );
  const sourcePaths = sourceAttrs.map((a) => a.path || a.name);

  const expressionPreview = useMemo(() => {
    if (mode === 'advanced') return advancedExpression || '(enter expression)';
    switch (operation) {
      case 'derive_math':
        return expression || 'e.g. {{a}} + {{b}}';
      case 'derive_concat':
        return sourcePaths.length ? sourcePaths.join(" + ' ' + ") : '(select attributes)';
      case 'derive_conditional':
        return expression || 'e.g. {{a}} > 0 ? "yes" : "no"';
      case 'vectorize_openai':
        return sourcePaths.length ? `vectorize(${sourcePaths[0]})` : '(select text attribute)';
      case 'extract_regex':
        return expression ? `regex({{attr}}, "${expression}")` : '(pattern)';
      case 'normalize':
        return sourcePaths.length ? `normalize(${sourcePaths[0]})` : '(select attribute)';
      default:
        return '';
    }
  }, [mode, operation, expression, sourcePaths, advancedExpression]);

  const toggleSource = (id: string) => {
    setSourceAttributeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    setError(null);
    const attrName = (name || 'derived_attr').trim().replace(/\s+/g, '_');
    if (!attrName) {
      setError('Attribute name is required');
      return;
    }

    let derivation: { operation: string; expression?: string; source_attributes: string[]; params?: Record<string, unknown> };
    if (mode === 'advanced') {
      const paths = advancedSourcePaths.split(/[\s,]+/).filter(Boolean);
      if (!paths.length) {
        setError('At least one source attribute path is required');
        return;
      }
      derivation = {
        operation: 'expression',
        expression: advancedExpression || '{{' + paths[0] + '}}',
        source_attributes: paths
      };
    } else {
      if (operation !== 'derive_math' && operation !== 'derive_conditional' && operation !== 'extract_regex' && sourcePaths.length === 0) {
        setError('Select at least one source attribute');
        return;
      }
      if ((operation === 'derive_math' || operation === 'derive_conditional') && !expression.trim()) {
        setError('Expression is required for this operation');
        return;
      }
      derivation = {
        operation,
        expression: ['derive_math', 'derive_conditional', 'extract_regex'].includes(operation) ? expression : undefined,
        source_attributes: sourcePaths
      };
      if (operation === 'extract_regex' && expression) {
        derivation.params = { pattern: expression };
      }
      if (operation === 'vectorize_openai') {
        derivation.params = { model: 'text-embedding-3-small', dimensions: 1536 };
      }
    }

    const outputType = mode === 'advanced' ? 'string' : (OPERATION_OUTPUT_TYPES[operation] || 'string');
    const payload: Omit<ModelAttribute, 'id'> = {
      path: attrName,
      name: attrName,
      type: outputType,
      example_value: null,
      indexed: false,
      description: description.trim() || `Derived: ${OPERATION_LABELS[operation]}`,
      status: 'derived',
      required: false,
      order: nextOrder,
      derivation
    };

    try {
      setSaving(true);
      await onSave(payload);
      onClose();
      setName('');
      setDescription('');
      setExpression('');
      setSourceAttributeIds([]);
      setAdvancedExpression('');
      setAdvancedSourcePaths('');
    } catch (e: any) {
      setError(e?.message || 'Failed to create attribute');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add derived attribute" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Model: <span className="font-medium text-gray-900 dark:text-white">{modelName}</span>
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('simple')}
            className={`px-3 py-1.5 text-sm rounded-lg ${mode === 'simple' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setMode('advanced')}
            className={`px-3 py-1.5 text-sm rounded-lg ${mode === 'advanced' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            Advanced
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Attribute name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. full_name"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description (optional)
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            className="w-full"
          />
        </div>

        {mode === 'simple' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Operation
              </label>
              <select
                value={operation}
                onChange={(e) => setOperation(e.target.value as DeriveOperation)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {Object.entries(OPERATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Source attributes
              </label>
              <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
                {existingAttributes.map((attr) => (
                  <label key={attr.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sourceAttributeIds.includes(attr.id)}
                      onChange={() => toggleSource(attr.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-mono text-gray-900 dark:text-white">{attr.path || attr.name}</span>
                    <span className="text-xs text-gray-500">({attr.type})</span>
                  </label>
                ))}
                {existingAttributes.length === 0 && (
                  <p className="text-sm text-gray-500">No attributes in this model</p>
                )}
              </div>
            </div>

            {['derive_math', 'derive_conditional'].includes(operation) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expression (use {'{{attr_name}}'} for source fields)
                </label>
                <Input
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder={operation === 'derive_math' ? '{{a}} + {{b}}' : '{{x}} > 0 ? "yes" : "no"'}
                  className="w-full font-mono"
                />
              </div>
            )}

            {operation === 'extract_regex' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Regex pattern
                </label>
                <Input
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  placeholder="e.g. ([A-Z]+)"
                  className="w-full font-mono"
                />
              </div>
            )}
          </>
        )}

        {mode === 'advanced' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Source attribute paths (comma or space separated)
              </label>
              <Input
                value={advancedSourcePaths}
                onChange={(e) => setAdvancedSourcePaths(e.target.value)}
                placeholder="e.g. first_name, last_name"
                className="w-full font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expression
              </label>
              <Input
                value={advancedExpression}
                onChange={(e) => setAdvancedExpression(e.target.value)}
                placeholder="e.g. {{first_name}} + ' ' + {{last_name}}"
                className="w-full font-mono"
              />
            </div>
          </>
        )}

        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Preview: </span>
          <code className="text-sm text-gray-900 dark:text-white break-all">{expressionPreview}</code>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Add attribute'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
