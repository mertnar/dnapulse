import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Monitor, Circle, Search, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Agent, AgentStatus, AgentPlatform } from '../../services/agentsService';
import { useState } from 'react';

interface AgentListPanelProps {
  agents: Agent[];
  selectedAgentId?: string;
  onSelectAgent: (agent: Agent) => void;
  onCreateNew: () => void;
}

const platformIcons: Record<AgentPlatform, string> = {
  windows: '🪟',
  macos: '🍎',
  linux: '🐧',
  docker: '🐳'
};

export function AgentListPanel({ agents, selectedAgentId, onSelectAgent, onCreateNew }: AgentListPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AgentStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<AgentPlatform | 'all'>('all');

  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'offline': return 'text-gray-400';
      case 'error': return 'text-red-500';
    }
  };

  const getStatusVariant = (status: AgentStatus) => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'neutral';
      case 'error': return 'danger';
    }
  };

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
    const matchesPlatform = platformFilter === 'all' || agent.platform === platformFilter;
    return matchesSearch && matchesStatus && matchesPlatform;
  });

  const statusCounts = {
    online: agents.filter(a => a.status === 'online').length,
    offline: agents.filter(a => a.status === 'offline').length,
    error: agents.filter(a => a.status === 'error').length
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Agents</h2>
          <Button onClick={onCreateNew} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {(['all', 'online', 'offline', 'error'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2 py-1.5 text-xs rounded transition-colors ${
                statusFilter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && ` (${statusCounts[status]})`}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['all', 'linux', 'windows', 'macos', 'docker'] as const).map(platform => (
            <button
              key={platform}
              onClick={() => setPlatformFilter(platform)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                platformFilter === platform
                  ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border border-primary-300 dark:border-primary-700'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {platform === 'all' ? '🌐' : platformIcons[platform]} {platform === 'all' ? 'All' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredAgents.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            No agents found
          </div>
        ) : (
          filteredAgents.map(agent => (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedAgentId === agent.id
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl mt-1">{platformIcons[agent.platform]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {agent.name}
                    </span>
                    <Circle className={`h-2 w-2 fill-current ${getStatusColor(agent.status)}`} />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 truncate">
                    {agent.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs">
                    <Badge variant={getStatusVariant(agent.status)} size="sm">
                      {agent.status}
                    </Badge>
                    {agent.status === 'online' && (
                      <span className="text-gray-600 dark:text-gray-400">
                        {agent.throughput} evt/s
                      </span>
                    )}
                    <span className="text-gray-500 dark:text-gray-500">
                      {formatDistanceToNow(new Date(agent.lastHeartbeat), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
