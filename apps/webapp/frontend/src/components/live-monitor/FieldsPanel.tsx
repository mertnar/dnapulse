import { useState, useEffect } from 'react';
import { Search, Plus, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Input } from '../ui/Input';
import type { FieldInfo } from '../../services/liveMonitorService';

interface FieldsPanelProps {
  fields: FieldInfo[];
  onAddFilter: (fieldName: string, value: string) => void;
  onLoadTopValues?: (fieldName: string) => Promise<{ value: string; count: number }[]>;
}

export function FieldsPanel({ fields, onAddFilter, onLoadTopValues }: FieldsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['common', 'system', 'payload', 'metadata'])
  );
  const [fieldTopValues, setFieldTopValues] = useState<Map<string, { value: string; count: number }[]>>(new Map());
  const [loadingFields, setLoadingFields] = useState<Set<string>>(new Set());

  const toggleField = async (fieldName: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(fieldName)) {
      newExpanded.delete(fieldName);
    } else {
      newExpanded.add(fieldName);
      // Load top values if not already loaded
      if (!fieldTopValues.has(fieldName) && onLoadTopValues) {
        setLoadingFields(new Set(loadingFields).add(fieldName));
        try {
          const topValues = await onLoadTopValues(fieldName);
          setFieldTopValues(new Map(fieldTopValues).set(fieldName, topValues));
        } catch (error) {
          console.error(`Failed to load top values for ${fieldName}:`, error);
        } finally {
          const newLoading = new Set(loadingFields);
          newLoading.delete(fieldName);
          setLoadingFields(newLoading);
        }
      }
    }
    setExpandedFields(newExpanded);
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const filteredFields = fields.filter(field =>
    field && field.name && field.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = ['common', 'system', 'payload', 'metadata'];
  const categoryLabels = {
    common: 'Common Fields',
    system: 'System',
    payload: 'Payload',
    metadata: 'Metadata'
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Fields</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
          <Input
            type="text"
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
            size="sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {categories.map(category => {
          const categoryFields = filteredFields.filter(f => f.category === category);
          if (categoryFields.length === 0) return null;

          return (
            <div key={category} className="mb-2">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                {expandedCategories.has(category) ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {categoryLabels[category as keyof typeof categoryLabels]}
                <span className="ml-auto text-gray-500 dark:text-gray-400">
                  {categoryFields.length}
                </span>
              </button>

              {expandedCategories.has(category) && (
                <div className="ml-2 mt-1 space-y-1">
                  {categoryFields.map(field => {
                    if (!field || !field.name) return null;
                    return (
                    <div key={field.name} className="space-y-1">
                      <div className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded group">
                        <button
                          onClick={() => toggleField(field.name)}
                          className="flex-1 flex items-center gap-2 text-left"
                        >
                          {expandedFields.has(field.name) ? (
                            <ChevronDown className="h-3 w-3 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-gray-400" />
                          )}
                          <span className="text-xs font-mono text-gray-900 dark:text-white">
                            {field.name}
                          </span>
                          {loadingFields.has(field.name) && (
                            <Loader2 className="h-3 w-3 text-blue-500 animate-spin ml-1" />
                          )}
                        </button>
                        <button
                          onClick={() => onAddFilter(field.name, String(field.example))}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-opacity"
                          title="Add filter"
                        >
                          <Plus className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                        </button>
                      </div>

                      {expandedFields.has(field.name) && fieldTopValues.has(field.name) && (
                        <div className="ml-8 space-y-0.5">
                          {fieldTopValues.get(field.name)!.map((topValue, idx) => (
                            <button
                              key={idx}
                              onClick={() => onAddFilter(field.name, topValue.value)}
                              className="w-full flex items-center justify-between px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-left group"
                            >
                              <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">
                                {topValue.value}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                {topValue.count}
                              </span>
                              <Plus className="h-3 w-3 text-gray-400 ml-2 opacity-0 group-hover:opacity-100" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
