import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Tabs } from '../ui/Tabs';
import { useNavigate } from 'react-router-dom';
import {
  Circle,
  RefreshCw,
  Power,
  Key,
  ExternalLink,
  Copy,
  Download,
  Terminal,
  AlertCircle,
  Activity,
  Database,
  Box
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Agent, AgentLog, AgentEvent } from '../../services/agentsService';
import { agentsService } from '../../services/agentsService';

interface AgentDetailsProps {
  agent: Agent;
  onRegenerateToken: (agentId: string) => void;
  onToggleStatus: (agentId: string, enabled: boolean) => void;
}

const platformIcons: Record<string, string> = {
  windows: '🪟',
  macos: '🍎',
  linux: '🐧',
  docker: '🐳'
};

export function AgentDetails({ agent, onRegenerateToken, onToggleStatus }: AgentDetailsProps) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [agent.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [logsData, eventsData] = await Promise.all([
        agentsService.getAgentLogs(agent.id),
        agentsService.getRecentEvents(agent.id)
      ]);
      setLogs(logsData);
      setEvents(eventsData);
    } catch (error) {
      console.error('Failed to load agent data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'offline': return 'text-gray-400';
      case 'error': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'neutral';
      case 'error': return 'danger';
      default: return 'neutral';
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      case 'info': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Circle className={`h-4 w-4 fill-current ${getStatusColor(agent.status)}`} />
                <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
              </div>
              <Badge variant={getStatusVariant(agent.status)}>{agent.status}</Badge>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Platform</div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{platformIcons[agent.platform]}</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                  {agent.platform}
                </span>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Version</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{agent.version}</div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Config Hash</div>
              <div className="text-lg font-mono font-semibold text-gray-900 dark:text-white">
                {agent.configHash}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Throughput</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {agent.throughput} events/sec
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Last Heartbeat</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDistanceToNow(new Date(agent.lastHeartbeat), { addSuffix: true })}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Integrations</h3>
            <div className="space-y-2">
              <button
                onClick={() => navigate(`/data-sources/${agent.dataSourceId}`)}
                className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-primary-600" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Data Source</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">ID: {agent.dataSourceId}</div>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </button>

              {agent.dataModelId && (
                <button
                  onClick={() => navigate(`/data-models/${agent.dataModelId}`)}
                  className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Box className="h-5 w-5 text-primary-600" />
                    <div className="text-left">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Data Model</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">ID: {agent.dataModelId}</div>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </button>
              )}

              <button
                onClick={() => navigate(`/live-monitor?agent=${agent.id}`)}
                className="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-primary-600" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Live Monitor</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">View real-time events</div>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h3>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" />
                Restart Agent
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onToggleStatus(agent.id, agent.status === 'online')}
              >
                <Power className="h-4 w-4 mr-1" />
                {agent.status === 'online' ? 'Disable' : 'Enable'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRegenerateToken(agent.id)}
              >
                <Key className="h-4 w-4 mr-1" />
                Regenerate Token
              </Button>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'data',
      label: 'Data & Stream',
      content: (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Events</h3>
              <Button size="sm" onClick={() => navigate(`/live-monitor?agent=${agent.id}`)}>
                <Activity className="h-4 w-4 mr-1" />
                View Live Data
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
            ) : events.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">No recent events</div>
            ) : (
              <div className="space-y-2">
                {events.map(event => (
                  <div
                    key={event.id}
                    className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="neutral" size="sm">{event.eventType}</Badge>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Collected Attributes</h3>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(agent.config)
                .filter(c => c.enabled && 'attributes' in c && Array.isArray(c.attributes))
                .flatMap(c => c.attributes as string[])
                .map(attr => (
                  <Badge key={attr} variant="neutral" size="sm">
                    {attr}
                  </Badge>
                ))}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'config',
      label: 'Configuration',
      content: (
        <div className="space-y-6">
          <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 overflow-x-auto">
            <pre className="text-xs text-gray-100">
              {JSON.stringify(agent.config, null, 2)}
            </pre>
          </div>
        </div>
      )
    },
    {
      id: 'deployment',
      label: 'Deployment',
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Authentication</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">API Token</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={agent.authToken}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm"
                  />
                  <Button variant="secondary" onClick={() => copyToClipboard(agent.authToken)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Ingestion Endpoint</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={agent.ingestionEndpoint}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm"
                  />
                  <Button variant="secondary" onClick={() => copyToClipboard(agent.ingestionEndpoint)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Download & Install</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🐧</span>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">Linux</h4>
                </div>
                <Button variant="secondary" size="sm" className="w-full mb-2">
                  <Download className="h-4 w-4 mr-1" />
                  Download Binary
                </Button>
                <div className="bg-gray-900 dark:bg-gray-950 rounded p-2 mt-2">
                  <code className="text-xs text-gray-100">
                    curl -O https://download.dnapulse.io/agent/linux
                  </code>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🪟</span>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">Windows</h4>
                </div>
                <Button variant="secondary" size="sm" className="w-full mb-2">
                  <Download className="h-4 w-4 mr-1" />
                  Download Installer
                </Button>
                <div className="bg-gray-900 dark:bg-gray-950 rounded p-2 mt-2">
                  <code className="text-xs text-gray-100">
                    dnapulse-agent-setup.exe
                  </code>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🍎</span>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">macOS</h4>
                </div>
                <Button variant="secondary" size="sm" className="w-full mb-2">
                  <Download className="h-4 w-4 mr-1" />
                  Download Package
                </Button>
                <div className="bg-gray-900 dark:bg-gray-950 rounded p-2 mt-2">
                  <code className="text-xs text-gray-100">
                    brew install dnapulse-agent
                  </code>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🐳</span>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">Docker</h4>
                </div>
                <Button variant="secondary" size="sm" className="w-full mb-2" onClick={() => copyToClipboard(`docker run -d dnapulse/agent:latest -t ${agent.authToken}`)}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy Command
                </Button>
                <div className="bg-gray-900 dark:bg-gray-950 rounded p-2 mt-2">
                  <code className="text-xs text-gray-100">
                    docker run -d dnapulse/agent:latest
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'logs',
      label: 'Logs & Health',
      content: (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Agent Logs</h3>
            {loading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">No logs available</div>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div
                    key={log.id}
                    className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className={`h-4 w-4 mt-0.5 ${getLogLevelColor(log.level)}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={log.level === 'error' ? 'danger' : log.level === 'warning' ? 'warning' : 'info'}
                            size="sm"
                          >
                            {log.level}
                          </Badge>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white">{log.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Health Timeline</h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 h-8">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-full rounded ${
                      i < 20 ? 'bg-green-500' : i < 22 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    title={`${24 - i} hours ago`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>24h ago</span>
                <span>Now</span>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-4">
          <div className="text-4xl">{platformIcons[agent.platform]}</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{agent.name}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{agent.description}</p>
            <div className="flex items-center gap-3">
              <Badge variant={getStatusVariant(agent.status)}>{agent.status}</Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400">v{agent.version}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Created {formatDistanceToNow(new Date(agent.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs tabs={tabs} />
      </div>
    </div>
  );
}
