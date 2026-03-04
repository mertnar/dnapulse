import { AlertCircle, MoreVertical, Power, Edit, Trash2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import type { DetectionRule } from '../../services/detectionService';
import { useState } from 'react';

interface RulesPanelProps {
  rules: DetectionRule[];
  onToggleRule: (ruleId: string, enabled: boolean) => void;
  onEditRule: (rule: DetectionRule) => void;
  onDeleteRule: (ruleId: string) => void;
}

export function RulesPanel({ rules, onToggleRule, onEditRule, onDeleteRule }: RulesPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'neutral';
    }
  };

  return (
    <div className="space-y-2">
      {rules.map(rule => (
        <div
          key={rule.id}
          className={`relative p-3 rounded-lg border transition-all ${
            rule.enabled
              ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60'
          }`}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {rule.name}
                </span>
                <Badge variant={getSeverityVariant(rule.severity)} size="sm">
                  {rule.severity}
                </Badge>
                {!rule.enabled && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">Disabled</span>
                )}
              </div>

              <p className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate mb-2">
                {rule.query}
              </p>

              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {rule.triggeredCount} alerts
                </span>
                {rule.lastTriggered && (
                  <span>
                    Last: {formatDistanceToNow(new Date(rule.lastTriggered), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onToggleRule(rule.id, !rule.enabled)}
                className={`p-1 rounded transition-colors ${
                  rule.enabled
                    ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title={rule.enabled ? 'Disable rule' : 'Enable rule'}
              >
                <Power className="h-4 w-4" />
              </button>

              <div className="relative">
                <button
                  onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <MoreVertical className="h-4 w-4 text-gray-400" />
                </button>

                {expandedId === rule.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setExpandedId(null)}
                    />
                    <div className="absolute right-0 top-8 z-20 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
                      <button
                        onClick={() => {
                          onEditRule(rule);
                          setExpandedId(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <Edit className="h-3 w-3" />
                        Edit Rule
                      </button>
                      <hr className="my-1 border-gray-200 dark:border-gray-700" />
                      <button
                        onClick={() => {
                          onDeleteRule(rule.id);
                          setExpandedId(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
