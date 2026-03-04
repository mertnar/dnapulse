import { useState, useEffect } from 'react';
import { EmptyState } from '../components/ui/EmptyState';
import { AgentListPanel } from '../components/agents/AgentListPanel';
import { AgentBuilder } from '../components/agents/AgentBuilder';
import { AgentDetails } from '../components/agents/AgentDetails';
import { Bot, Package } from 'lucide-react';
import { agentsService, type Agent } from '../services/agentsService';

type ViewMode = 'empty' | 'builder' | 'details';

export function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('empty');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await agentsService.getAgents();
      setAgents(data);
      if (data.length > 0 && !selectedAgent) {
        setViewMode('empty');
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedAgent(null);
    setViewMode('builder');
  };

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setViewMode('details');
  };

  const handleSaveAgent = async (agentData: any) => {
    try {
      await agentsService.createAgent(agentData);
      await loadAgents();
      setViewMode('empty');
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  };

  const handleCancelBuilder = () => {
    setViewMode('empty');
  };

  const handleRegenerateToken = async (agentId: string) => {
    try {
      const newToken = await agentsService.regenerateToken(agentId);
      if (selectedAgent && selectedAgent.id === agentId) {
        setSelectedAgent({ ...selectedAgent, authToken: newToken });
      }
      await loadAgents();
    } catch (error) {
      console.error('Failed to regenerate token:', error);
    }
  };

  const handleToggleStatus = async (agentId: string, enabled: boolean) => {
    try {
      const newStatus = enabled ? 'offline' : 'online';
      await agentsService.updateAgent(agentId, { status: newStatus });
      if (selectedAgent && selectedAgent.id === agentId) {
        setSelectedAgent({ ...selectedAgent, status: newStatus });
      }
      await loadAgents();
    } catch (error) {
      console.error('Failed to toggle agent status:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <div className="w-96 flex-shrink-0 border-r border-gray-200 dark:border-gray-700">
        <AgentListPanel
          agents={agents}
          selectedAgentId={selectedAgent?.id}
          onSelectAgent={handleSelectAgent}
          onCreateNew={handleCreateNew}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {viewMode === 'empty' && (
          <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <EmptyState
              icon={Bot}
              title="Select or Create an Agent"
              description="Choose an agent from the list to view details, or create a new agent to start collecting data"
              action={{
                label: 'Create New Agent',
                onClick: handleCreateNew
              }}
            />
          </div>
        )}

        {viewMode === 'builder' && (
          <AgentBuilder onSave={handleSaveAgent} onCancel={handleCancelBuilder} />
        )}

        {viewMode === 'details' && selectedAgent && (
          <AgentDetails
            agent={selectedAgent}
            onRegenerateToken={handleRegenerateToken}
            onToggleStatus={handleToggleStatus}
          />
        )}
      </div>
    </div>
  );
}
