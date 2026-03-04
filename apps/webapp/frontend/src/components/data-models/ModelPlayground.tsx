import { useState } from 'react';
import {
  Save,
  Eye,
  GitBranch,
  Zap,
  Edit2,
  Tag,
  User,
  ChevronDown,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Check,
  X
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type {
  DataModelExtended,
  ModelAttribute,
  AttributeStatus,
  DataSampleRecord
} from '../../types';

interface ModelPlaygroundProps {
  model: DataModelExtended;
  sampleData: DataSampleRecord[];
  onUpdateModel: (updates: Partial<DataModelExtended>) => void;
  onUpdateAttribute: (attributeId: string, updates: Partial<ModelAttribute>) => void;
  onOpenAddAttributeModal: () => void;
  onSaveVersion: () => void;
  onViewLiveData: () => void;
  onCreateDerived: () => void;
  onVectorize: () => void;
}

export function ModelPlayground({
  model,
  sampleData,
  onUpdateModel,
  onUpdateAttribute,
  onOpenAddAttributeModal,
  onSaveVersion,
  onViewLiveData,
  onCreateDerived,
  onVectorize
}: ModelPlaygroundProps) {
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [editingAttribute, setEditingAttribute] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [viewMode, setViewMode] = useState<'base' | 'derived' | 'composite'>('base');
  const [showSampleData, setShowSampleData] = useState(false);

  const statusColors: Record<AttributeStatus, string> = {
    normal: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    undefined: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    derived: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    deprecated: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  };

  const handleSelectAttribute = (attrId: string) => {
    setSelectedAttributes(prev =>
      prev.includes(attrId)
        ? prev.filter(id => id !== attrId)
        : [...prev, attrId]
    );
  };

  const handleSelectAll = () => {
    const attributes = model.attributes || [];
    if (selectedAttributes.length === attributes.length) {
      setSelectedAttributes([]);
    } else {
      setSelectedAttributes(attributes.map(a => a.id));
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  defaultValue={model.name}
                  onBlur={(e) => {
                    onUpdateModel({ name: e.target.value });
                    setEditingName(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onUpdateModel({ name: e.currentTarget.value });
                      setEditingName(false);
                    }
                  }}
                  autoFocus
                  className="text-2xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-600 focus:outline-none"
                />
                <button
                  onClick={() => setEditingName(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {model.name}
                </h1>
                <button
                  onClick={() => setEditingName(true)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
            )}

            {editingDescription ? (
              <div className="mt-2">
                <textarea
                  defaultValue={model.description}
                  onBlur={(e) => {
                    onUpdateModel({ description: e.target.value });
                    setEditingDescription(false);
                  }}
                  autoFocus
                  rows={2}
                  className="w-full text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 group mt-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {model.description}
                </p>
                <button
                  onClick={() => setEditingDescription(true)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Tag className="h-4 w-4" />
                <div className="flex gap-1">
                  {(model.tags || []).map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <User className="h-4 w-4" />
                {model.owner}
              </div>

              <Badge variant="default">v{model.version}</Badge>

              <Badge variant={model.status === 'active' ? 'success' : 'warning'}>
                {model.status}
              </Badge>

              {model.ml_ready && (
                <Badge variant="info">ML Ready</Badge>
              )}

              {model.rule_ready && (
                <Badge variant="success">Rule Ready</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onViewLiveData}>
              <Eye className="h-4 w-4 mr-2" />
              Live Data
            </Button>
            <Button variant="outline" size="sm" onClick={onSaveVersion}>
              <Save className="h-4 w-4 mr-2" />
              Save Version
            </Button>
            <div className="relative group">
              <Button variant="primary" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  onClick={onCreateDerived}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <GitBranch className="h-4 w-4" />
                  Derived Model
                </button>
                <button
                  onClick={onVectorize}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Vectorize Model
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Schema ({(model.attributes || []).length} attributes)
            </h2>
            <div className="flex items-center gap-2">
              {selectedAttributes.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {selectedAttributes.length} selected
                  </span>
                  <button
                    onClick={onOpenAddAttributeModal}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Create Derived
                  </button>
                  <button
                    onClick={() => setSelectedAttributes([])}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={onOpenAddAttributeModal}>
                <Plus className="h-4 w-4 mr-2" />
                Add Attribute
              </Button>
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedAttributes.length === (model.attributes || []).length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Source</th>
                  <th className="text-left px-4 py-3">Example</th>
                  <th className="text-center px-4 py-3">Index</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="w-20 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {(model.attributes || []).map((attr) => (
                  <tr
                    key={attr.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      selectedAttributes.includes(attr.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedAttributes.includes(attr.id)}
                        onChange={() => handleSelectAttribute(attr.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {editingAttribute === attr.id ? (
                          <input
                            type="text"
                            defaultValue={attr.name}
                            onBlur={(e) => {
                              onUpdateAttribute(attr.id, { name: e.target.value });
                              setEditingAttribute(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onUpdateAttribute(attr.id, { name: e.currentTarget.value });
                                setEditingAttribute(null);
                              }
                            }}
                            autoFocus
                            className="text-sm font-mono border-b border-blue-600 focus:outline-none bg-transparent"
                          />
                        ) : (
                          <span className="text-sm font-mono text-gray-900 dark:text-white">
                            {attr.name}
                          </span>
                        )}
                        {attr.required && (
                          <span className="text-xs text-red-500">*</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {attr.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {attr.source_model ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {attr.source_model}
                        </span>
                      ) : attr.derivation ? (
                        <span className="text-xs text-blue-600 dark:text-blue-400 italic">
                          derived
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {typeof attr.example_value === 'object'
                          ? JSON.stringify(attr.example_value).slice(0, 30) + '...'
                          : String(attr.example_value).slice(0, 30)}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onUpdateAttribute(attr.id, { indexed: !attr.indexed })}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {attr.indexed ? (
                          <Lock className="h-4 w-4 text-green-600" />
                        ) : (
                          <Unlock className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                        {attr.description}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded ${statusColors[attr.status]}`}>
                        {attr.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingAttribute(attr.id)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onUpdateAttribute(attr.id, { status: 'deprecated' })}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Data Preview
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSampleData(!showSampleData)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {showSampleData ? 'Hide' : 'Show'} Sample Data
              </button>
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('base')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    viewMode === 'base'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Base
                </button>
                <button
                  onClick={() => setViewMode('derived')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    viewMode === 'derived'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Derived
                </button>
                <button
                  onClick={() => setViewMode('composite')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    viewMode === 'composite'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Composite
                </button>
              </div>
            </div>
          </div>

          {showSampleData && sampleData.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300">
                        Timestamp
                      </th>
                      {Object.keys(sampleData[0].processed).map((key) => (
                        <th
                          key={key}
                          className="text-left px-4 py-2 font-medium text-gray-700 dark:text-gray-300"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {sampleData.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                          {new Date(record.timestamp).toLocaleString()}
                        </td>
                        {Object.entries(record.processed).map(([key, value]) => (
                          <td key={key} className="px-4 py-2 text-xs text-gray-900 dark:text-white">
                            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </code>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
