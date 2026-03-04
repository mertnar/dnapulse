import { useState, useEffect } from 'react';
import { EmptyState } from '../components/ui/EmptyState';
import { Bot, Save } from 'lucide-react';
import { agentTypesService, type AgentType, type AgentInstance } from '../services/agentTypesService';
import { AgentTypeCard } from '../components/agents/AgentTypeCard';
import { AgentDownloadModal } from '../components/agents/AgentDownloadModal';

export function AgentsNew() {
  const [agentTypes, setAgentTypes] = useState<AgentType[]>([]);
  const [selectedType, setSelectedType] = useState<AgentType | null>(null);
  const [instances, setInstances] = useState<AgentInstance[]>([]);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'instances' | 'config'>('overview');
  const [configText, setConfigText] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    loadAgentTypes();
  }, []);

  useEffect(() => {
    if (selectedType) {
      loadInstances(selectedType.id);
      setConfigText(JSON.stringify(selectedType.defaultConfig || {}, null, 2));
      setConfigError(null);
    }
  }, [selectedType]);

  const loadAgentTypes = async () => {
    try {
      setLoading(true);
      const data = await agentTypesService.getAgentTypes();
      setAgentTypes(data);
      if (data.length > 0 && !selectedType) {
        setSelectedType(data[0]);
      }
    } catch (error) {
      console.error('Failed to load agent types:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInstances = async (agentTypeId: string) => {
    try {
      const data = await agentTypesService.getInstances(agentTypeId);
      setInstances(data);
    } catch (error) {
      console.error('Failed to load agent instances:', error);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedType) return;

    try {
      setConfigError(null);
      setIsSavingConfig(true);

      // Validate JSON
      const config = JSON.parse(configText);

      // Save config
      await agentTypesService.updateConfig(selectedType.id, config);

      // Reload agent types to get updated version
      await loadAgentTypes();

      // Show success message (you could add a toast notification here)
      console.log('Config saved successfully');
    } catch (error) {
      if (error instanceof SyntaxError) {
        setConfigError('Invalid JSON: ' + error.message);
      } else {
        setConfigError('Failed to save configuration');
        console.error('Failed to save config:', error);
      }
    } finally {
      setIsSavingConfig(false);
    }
  };

  const totalInstances = agentTypes.reduce((sum, t) => sum + t.instanceCount, 0);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Left sidebar: Agent Types */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Agent Types</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {totalInstances} total instance{totalInstances !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="p-4 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading agent types...
            </div>
          ) : agentTypes.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No agent types found
            </div>
          ) : (
            agentTypes.map((type) => (
              <AgentTypeCard
                key={type.id}
                agentType={type}
                isSelected={selectedType?.id === type.id}
                onClick={() => setSelectedType(type)}
              />
            ))
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        {selectedType ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <span className="text-5xl">{selectedType.icon}</span>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedType.displayName}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {selectedType.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                        {selectedType.category}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        v{selectedType.version}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedType.instanceCount} instance{selectedType.instanceCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsDownloadModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
                >
                  <Bot className="h-5 w-5" />
                  Download & Install
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6">
              <div className="flex gap-6">
                {['overview', 'instances', 'config'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`py-3 px-1 border-b-2 font-medium transition-colors capitalize ${
                      activeTab === tab
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Agent Type Information
                    </h3>
                    <dl className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Version</dt>
                        <dd className="text-lg font-medium text-gray-900 dark:text-white mt-1">
                          {selectedType.version}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Category</dt>
                        <dd className="text-lg font-medium text-gray-900 dark:text-white mt-1">
                          {selectedType.category}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Total Instances</dt>
                        <dd className="text-lg font-medium text-gray-900 dark:text-white mt-1">
                          {selectedType.instanceCount}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Online</dt>
                        <dd className="text-lg font-medium text-green-600 dark:text-green-400 mt-1">
                          {selectedType.onlineCount}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}

              {activeTab === 'instances' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      All Instances ({instances.length})
                    </h3>
                    {instances.length === 0 ? (
                      <div className="text-center py-12">
                        <Bot className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                          No instances
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Download and register an agent to get started
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                              <th className="p-3 font-medium text-gray-700 dark:text-gray-300">Instance</th>
                              <th className="p-3 font-medium text-gray-700 dark:text-gray-300">Hostname</th>
                              <th className="p-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
                              <th className="p-3 font-medium text-gray-700 dark:text-gray-300">Config</th>
                              <th className="p-3 font-medium text-gray-700 dark:text-gray-300">Last Seen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {instances.map((instance) => (
                              <tr
                                key={instance.id}
                                className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                              >
                                <td className="p-3">
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {instance.instanceName}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {instance.ipAddress}
                                  </div>
                                </td>
                                <td className="p-3 text-gray-600 dark:text-gray-400">
                                  {instance.hostname}
                                </td>
                                <td className="p-3">
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      instance.status === 'online'
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    {instance.status}
                                  </span>
                                </td>
                                <td className="p-3">
                                  {instance.currentConfigVersion !== undefined ? (
                                    <div className="text-xs">
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full font-medium ${
                                        instance.currentConfigVersion === selectedType.configVersion
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                      }`}>
                                        v{instance.currentConfigVersion}
                                      </span>
                                      {instance.currentConfigVersion !== selectedType.configVersion && (
                                        <div className="text-gray-500 dark:text-gray-400 mt-1">
                                          (latest: v{selectedType.configVersion})
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500">-</span>
                                  )}
                                </td>
                                <td className="p-3 text-gray-600 dark:text-gray-400">
                                  {new Date(instance.lastSeenAt).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'config' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Default Configuration
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Version {selectedType.configVersion}
                        {selectedType.configUpdatedAt && (
                          <span className="ml-2">
                            • Updated {new Date(selectedType.configUpdatedAt).toLocaleString()}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={handleSaveConfig}
                      disabled={isSavingConfig}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="h-4 w-4" />
                      {isSavingConfig ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>

                  {configError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-800 dark:text-red-200">{configError}</p>
                    </div>
                  )}

                  <textarea
                    value={configText}
                    onChange={(e) => setConfigText(e.target.value)}
                    className="w-full h-[500px] bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                    spellCheck={false}
                  />

                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> When you save this configuration, the version number will increment automatically.
                      All agents will receive the updated configuration on their next sync (every 5 minutes by default).
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Bot}
            title="Select an Agent Type"
            description="Choose an agent type from the list to view details and instances"
          />
        )}
      </div>

      {/* Download modal */}
      {selectedType && (
        <AgentDownloadModal
          agentType={selectedType}
          isOpen={isDownloadModalOpen}
          onClose={() => setIsDownloadModalOpen(false)}
        />
      )}
    </div>
  );
}
