import { useState, useEffect } from 'react';
import { Drawer } from '../ui/Drawer';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { X } from 'lucide-react';
import type { DetectionRule, SavedView } from '../../services/detectionService';
import type { EventSeverity } from '../../types';
import type { LiveEvent } from '../../services/liveMonitorService';

interface RuleBuilderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: Partial<DetectionRule>) => void;
  initialData?: {
    query?: string;
    sourceViewId?: string;
    event?: LiveEvent;
    existingRule?: DetectionRule;
  };
}

export function RuleBuilderDrawer({ isOpen, onClose, onSave, initialData }: RuleBuilderDrawerProps) {
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [conditionType, setConditionType] = useState<'count' | 'unique' | 'rate'>('count');
  const [conditionField, setConditionField] = useState('');
  const [threshold, setThreshold] = useState(10);
  const [timeWindow, setTimeWindow] = useState(5);
  const [severity, setSeverity] = useState<EventSeverity>('medium');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (isOpen) {
      if (initialData?.existingRule) {
        const rule = initialData.existingRule;
        setName(rule.name);
        setQuery(rule.query);
        setConditionType(rule.conditionType);
        setConditionField(rule.conditionField || '');
        setThreshold(rule.threshold);
        setTimeWindow(rule.timeWindow);
        setSeverity(rule.severity);
        setTags(rule.tags);
        setEnabled(rule.enabled);
      } else {
        setName('');
        setQuery(initialData?.query || '');
        setConditionType('count');
        setConditionField('');
        setThreshold(10);
        setTimeWindow(5);
        setSeverity(initialData?.event?.severity || 'medium');
        setTags([]);
        setEnabled(true);
      }
    }
  }, [isOpen, initialData]);

  const handleSave = () => {
    const rule: Partial<DetectionRule> = {
      name,
      query,
      conditionType,
      conditionField: conditionType === 'unique' ? conditionField : undefined,
      threshold,
      timeWindow,
      severity,
      tags,
      enabled,
      sourceViewId: initialData?.sourceViewId
    };

    if (initialData?.existingRule) {
      onSave({ ...rule, id: initialData.existingRule.id });
    } else {
      onSave(rule);
    }

    onClose();
  };

  const addTag = () => {
    if (tagInput && !tags.includes(tagInput)) {
      setTags([...tags, tagInput]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={initialData?.existingRule ? 'Edit Rule' : 'Create Detection Rule'}
      size="lg"
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Rule Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Multiple Failed Logins"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Query (KQL)
          </label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="severity:critical AND source:agent-*"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Condition Type
            </label>
            <select
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="count">Count</option>
              <option value="unique">Unique</option>
              <option value="rate">Rate</option>
            </select>
          </div>

          {conditionType === 'unique' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Field
              </label>
              <Input
                value={conditionField}
                onChange={(e) => setConditionField(e.target.value)}
                placeholder="e.g., user"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Threshold
            </label>
            <Input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              min={1}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time Window (minutes)
            </label>
            <Input
              type="number"
              value={timeWindow}
              onChange={(e) => setTimeWindow(Number(e.target.value))}
              min={1}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Severity
          </label>
          <div className="flex gap-2">
            {(['critical', 'high', 'medium', 'low', 'info'] as EventSeverity[]).map(sev => (
              <button
                key={sev}
                onClick={() => setSeverity(sev)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  severity === sev
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tags
          </label>
          <div className="flex gap-2 mb-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
              placeholder="Add tag..."
            />
            <Button onClick={addTag} variant="secondary">Add</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <Badge key={tag} variant="neutral">
                {tag}
                <button onClick={() => removeTag(tag)} className="ml-1">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
          />
          <label htmlFor="enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable rule immediately
          </label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={handleSave} disabled={!name || !query}>
            {initialData?.existingRule ? 'Update Rule' : 'Create Rule'}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
