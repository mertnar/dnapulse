import { Clock, Link, MoreVertical, Play, Copy, Trash2, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { SavedView } from '../../services/detectionService';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface SavedViewsPanelProps {
  views: SavedView[];
  onSelectView: (view: SavedView) => void;
  onCreateRule: (view: SavedView) => void;
  onDelete: (viewId: string) => void;
  selectedViewId?: string;
}

export function SavedViewsPanel({ views, onSelectView, onCreateRule, onDelete, selectedViewId }: SavedViewsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
    <div className="space-y-2">
      {views.map(view => (
        <div
          key={view.id}
          className={`relative p-3 rounded-lg border transition-all ${
            selectedViewId === view.id
              ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-start gap-2">
            <button
              onClick={() => onSelectView(view)}
              className="flex-1 text-left"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {view.name}
                </span>
                {view.linkedRulesCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400">
                    <Link className="h-3 w-3" />
                    {view.linkedRulesCount}
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate mb-2">
                {view.query}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(view.lastRunTime), { addSuffix: true })}
                </span>
                <span>{view.timeRange}</span>
              </div>
            </button>

            <div className="relative">
              <button
                onClick={() => setExpandedId(expandedId === view.id ? null : view.id)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <MoreVertical className="h-4 w-4 text-gray-400" />
              </button>

              {expandedId === view.id && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setExpandedId(null)}
                  />
                  <div className="absolute right-0 top-8 z-20 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
                    <button
                      onClick={() => {
                        onSelectView(view);
                        setExpandedId(null);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Play className="h-3 w-3" />
                      Open View
                    </button>
                    <button
                      onClick={() => {
                        navigate(`/views/${view.id}`);
                        setExpandedId(null);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open in Views Page
                    </button>
                    <button
                      onClick={() => {
                        onCreateRule(view);
                        setExpandedId(null);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Link className="h-3 w-3" />
                      Create Rule
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(view.query);
                        setExpandedId(null);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Copy className="h-3 w-3" />
                      Copy Query
                    </button>
                    <hr className="my-1 border-gray-200 dark:border-gray-700" />
                    <button
                      onClick={() => {
                        onDelete(view.id);
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
      ))}
    </div>
  );
}
