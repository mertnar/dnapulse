import { useState } from 'react';
import {
  GitBranch,
  FileText,
  Users,
  Activity,
  Clock,
  AlertTriangle,
  ExternalLink,
  MessageSquare,
  ArrowRight,
  Workflow
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Tabs } from '../ui/Tabs';
import { formatDistanceToNow } from 'date-fns';
import type {
  ModelLineage,
  ModelNote,
  ModelUsage,
  ModelContributor,
  ModelVersion,
  DataModelType,
  ModelAttribute
} from '../../types';

interface ModelContextProps {
  lineage: ModelLineage;
  notes: ModelNote[];
  usage: ModelUsage;
  contributors: ModelContributor[];
  versions: ModelVersion[];
  pipeline?: { id: string; version: number; status: string; pipeline: { steps: any[] } } | null;
  modelId?: string;
  modelType?: DataModelType;
  modelAttributes?: ModelAttribute[];
  onAddNote: (content: string, attributeName?: string) => void;
  onNavigate: (type: string, id: string) => void;
  onOpenPipelineBuilder?: () => void;
}

export function ModelContext({
  lineage,
  notes,
  usage,
  contributors,
  versions,
  pipeline,
  modelId,
  modelType,
  modelAttributes = [],
  onAddNote,
  onNavigate,
  onOpenPipelineBuilder
}: ModelContextProps) {
  const [activeTab, setActiveTab] = useState('lineage');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteAttributeName, setNoteAttributeName] = useState('');

  const showPipelineTab = (modelType === 'derived' || modelType === 'vector') && Boolean(onOpenPipelineBuilder);
  const tabs = [
    { id: 'lineage', label: 'Lineage', icon: <GitBranch className="h-4 w-4" /> },
    ...(showPipelineTab ? [{ id: 'pipeline', label: 'Pipeline', icon: <Workflow className="h-4 w-4" /> }] : []),
    { id: 'notes', label: 'Notes', icon: <FileText className="h-4 w-4" /> },
    { id: 'collaboration', label: 'Team', icon: <Users className="h-4 w-4" /> },
    { id: 'usage', label: 'Usage', icon: <Activity className="h-4 w-4" /> },
    { id: 'versions', label: 'Versions', icon: <Clock className="h-4 w-4" /> }
  ];

  const handleAddNote = () => {
    if (newNoteContent.trim()) {
      onAddNote(newNoteContent, noteAttributeName || undefined);
      setNewNoteContent('');
      setNoteAttributeName('');
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
      <div className="border-b border-gray-200 dark:border-gray-800">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="underline"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'lineage' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <ArrowRight className="h-4 w-4 rotate-180" />
                Sources ({lineage.sources.length})
              </h3>
              {lineage.sources.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No upstream sources
                </p>
              ) : (
                <div className="space-y-2">
                  {lineage.sources.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => onNavigate(node.type, node.id)}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            node.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                          }`} />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {node.name}
                          </span>
                        </div>
                        <ExternalLink className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="mt-1">
                        <Badge variant="default" className="text-xs">
                          {node.type}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Consumers ({lineage.consumers.length})
              </h3>
              {lineage.consumers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No downstream consumers
                </p>
              ) : (
                <div className="space-y-2">
                  {lineage.consumers.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => onNavigate(node.type, node.id)}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            node.status === 'active' || node.status === 'enabled' ? 'bg-green-500' : 'bg-yellow-500'
                          }`} />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {node.name}
                          </span>
                        </div>
                        <ExternalLink className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="mt-1">
                        <Badge variant="default" className="text-xs">
                          {node.type}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                This lineage graph shows the data flow from agents and sources through this model to downstream consumers like rules, alerts, and ML pipelines.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'pipeline' && showPipelineTab && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Workflow className="h-4 w-4" />
                Pipeline
              </h3>
              <Button variant="primary" size="sm" onClick={onOpenPipelineBuilder}>
                {pipeline ? 'Edit pipeline' : 'Create pipeline'}
              </Button>
            </div>
            {pipeline ? (
              <>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Badge variant={pipeline.status === 'active' ? 'success' : 'neutral'}>
                    {pipeline.status}
                  </Badge>
                  <span>Version {pipeline.version}</span>
                </div>
                <div className="space-y-2">
                  {pipeline.pipeline?.steps?.length > 0 ? (
                    pipeline.pipeline.steps.map((step: any, index: number) => (
                      <div
                        key={step.id || index}
                        className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center gap-2"
                      >
                        <span className="text-xs font-medium text-gray-500">{index + 1}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                          {step.type}
                        </span>
                        {step.operation && (
                          <span className="text-xs text-gray-500">({step.operation})</span>
                        )}
                        <span className="text-xs text-gray-500 truncate">
                          → {step.outputs?.[0]?.path ?? '—'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No steps. Edit pipeline to add steps.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No pipeline configured. Create a pipeline to define transformation steps for this model.
              </p>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="mb-3">
                <input
                  type="text"
                  value={noteAttributeName}
                  onChange={(e) => setNoteAttributeName(e.target.value)}
                  placeholder="Attribute name (optional)"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
                />
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Add a note or annotation..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <button
                onClick={handleAddNote}
                disabled={!newNoteContent.trim()}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded transition-colors"
              >
                Add Note
              </button>
            </div>

            {notes.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No notes yet. Add the first note to document this model.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    {note.attribute_name && (
                      <div className="mb-2">
                        <Badge variant="info" className="text-xs">
                          {note.attribute_name}
                        </Badge>
                      </div>
                    )}
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                      {note.content}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{note.author}</span>
                      <span>
                        {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'collaboration' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Contributors ({contributors.length})
              </h3>
              {contributors.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No contributors yet
                </p>
              ) : (
                <div className="space-y-2">
                  {contributors.map((contributor) => (
                    <div
                      key={contributor.user_id}
                      className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            {contributor.user_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900 dark:text-white">
                            {contributor.user_name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {contributor.contributions} contributions
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(contributor.last_contribution), {
                            addSuffix: true
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Rules Using This Model ({usage.rules.length})
              </h3>
              {usage.rules.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No rules using this model
                </p>
              ) : (
                <div className="space-y-2">
                  {usage.rules.map((rule) => (
                    <button
                      key={rule.id}
                      onClick={() => onNavigate('rule', rule.id)}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {rule.name}
                        </span>
                        <ExternalLink className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {rule.usage_count.toLocaleString()} matches
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Alerts Triggered
              </h3>
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="text-3xl font-bold text-orange-700 dark:text-orange-300 mb-1">
                  {usage.alerts_triggered.toLocaleString()}
                </div>
                <div className="text-sm text-orange-600 dark:text-orange-400">
                  Total alerts from this model
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Investigations ({usage.investigations.length})
              </h3>
              {usage.investigations.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No investigations
                </p>
              ) : (
                <div className="space-y-2">
                  {usage.investigations.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => onNavigate('investigation', inv.id)}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {inv.title}
                        </span>
                        <ExternalLink className="h-4 w-4 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                ML Pipelines ({usage.ml_pipelines.length})
              </h3>
              {usage.ml_pipelines.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No ML pipelines
                </p>
              ) : (
                <div className="space-y-2">
                  {usage.ml_pipelines.map((pipeline) => (
                    <button
                      key={pipeline.id}
                      onClick={() => onNavigate('ml-pipeline', pipeline.id)}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {pipeline.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={pipeline.status === 'ready' ? 'success' : 'warning'}
                            className="text-xs"
                          >
                            {pipeline.status}
                          </Badge>
                          <ExternalLink className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(usage.rules.length > 0 || usage.ml_pipelines.length > 0) && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-700 dark:text-yellow-300">
                  <strong>Breaking Change Warning:</strong> Modifying this model may impact {usage.rules.length} rules and {usage.ml_pipelines.length} ML pipelines. Review dependencies before making changes.
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'versions' && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Track changes and compare versions. Rollback to previous versions if needed.
              </p>
            </div>

            {versions.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No version history available
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((version, idx) => (
                  <div
                    key={version.version}
                    className={`p-4 border rounded-lg ${
                      idx === 0
                        ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          Version {version.version}
                        </span>
                        {idx === 0 && (
                          <Badge variant="info" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      by {version.created_by}
                    </div>

                    <div className="space-y-1 mb-3">
                      {version.changes.map((change, changeIdx) => (
                        <div
                          key={changeIdx}
                          className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"
                        >
                          <span className="text-blue-600 dark:text-blue-400">•</span>
                          {change}
                        </div>
                      ))}
                    </div>

                    {version.schema_diff && (
                      <div className="text-xs space-y-1">
                        {version.schema_diff.added.length > 0 && (
                          <div className="text-green-700 dark:text-green-300">
                            + Added: {version.schema_diff.added.join(', ')}
                          </div>
                        )}
                        {version.schema_diff.removed.length > 0 && (
                          <div className="text-red-700 dark:text-red-300">
                            - Removed: {version.schema_diff.removed.join(', ')}
                          </div>
                        )}
                        {version.schema_diff.modified.length > 0 && (
                          <div className="text-orange-700 dark:text-orange-300">
                            ~ Modified: {version.schema_diff.modified.map(m => m.field).join(', ')}
                          </div>
                        )}
                      </div>
                    )}

                    {idx !== 0 && (
                      <button className="mt-3 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">
                        Rollback to this version
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
