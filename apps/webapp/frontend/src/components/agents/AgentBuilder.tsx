import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { ChevronLeft, ChevronRight, Check, Copy } from 'lucide-react';
import type { AgentPlatform, DataCollectionConfig } from '../../services/agentsService';

interface AgentBuilderProps {
  onSave: (agentData: {
    name: string;
    description: string;
    platform: AgentPlatform;
    dataSourceId: string;
    config: DataCollectionConfig;
  }) => void;
  onCancel: () => void;
}

const platformIcons: Record<AgentPlatform, string> = {
  windows: '🪟',
  macos: '🍎',
  linux: '🐧',
  docker: '🐳'
};

export function AgentBuilder({ onSave, onCancel }: AgentBuilderProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState<AgentPlatform>('linux');

  const [config, setConfig] = useState<DataCollectionConfig>({
    systemMetrics: {
      enabled: true,
      frequency: 60,
      attributes: ['cpu_usage', 'memory_usage', 'disk_usage']
    },
    processActivity: {
      enabled: false,
      frequency: 60,
      attributes: ['process_name', 'pid', 'user']
    },
    fileSystemEvents: {
      enabled: false,
      frequency: 60,
      attributes: ['file_path', 'operation', 'user']
    },
    networkActivity: {
      enabled: false,
      frequency: 60,
      attributes: ['source_ip', 'dest_ip', 'port']
    },
    applicationLogs: {
      enabled: true,
      frequency: 30,
      attributes: ['log_level', 'message', 'source']
    },
    customAttributes: {
      enabled: false,
      attributes: {}
    }
  });

  const steps = [
    'Basic Info',
    'Data Collection',
    'AI Assistant',
    'Output & Ingestion',
    'Review'
  ];

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCreate = () => {
    onSave({
      name,
      description,
      platform,
      dataSourceId: `ds-${Date.now()}`,
      config
    });
  };

  const toggleCategory = (category: keyof DataCollectionConfig) => {
    if (category === 'customAttributes') {
      setConfig({
        ...config,
        [category]: {
          ...config[category],
          enabled: !config[category].enabled
        }
      });
    } else {
      setConfig({
        ...config,
        [category]: {
          ...config[category],
          enabled: !config[category].enabled
        }
      });
    }
  };

  const updateFrequency = (category: keyof DataCollectionConfig, frequency: number) => {
    if (category !== 'customAttributes') {
      setConfig({
        ...config,
        [category]: {
          ...config[category],
          frequency
        }
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Create New Agent</h2>
        <div className="flex items-center gap-2">
          {steps.map((stepName, index) => (
            <div key={index} className="flex items-center">
              <div className={`flex items-center gap-2 ${index + 1 <= step ? 'text-primary-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index + 1 < step
                    ? 'bg-primary-600 text-white'
                    : index + 1 === step
                    ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-2 border-primary-600'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}>
                  {index + 1 < step ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <span className="text-xs font-medium hidden md:block">{stepName}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-2 ${index + 1 < step ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {step === 1 && (
          <div className="max-w-2xl space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Agent Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Production Web Server"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this agent monitors..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Target Platform
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['linux', 'windows', 'macos', 'docker'] as AgentPlatform[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      platform === p
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="text-4xl mb-2">{platformIcons[p]}</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {p}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-3xl space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select the types of data you want to collect and configure collection frequency
            </p>

            {(Object.keys(config) as Array<keyof DataCollectionConfig>)
              .filter(key => key !== 'customAttributes')
              .map(category => (
                <div
                  key={category}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={config[category].enabled}
                        onChange={() => toggleCategory(category)}
                        className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                      />
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                          {category.replace(/([A-Z])/g, ' $1').trim()}
                        </h3>
                      </div>
                    </div>
                    {config[category].enabled && category !== 'customAttributes' && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 dark:text-gray-400">
                          Frequency (seconds):
                        </label>
                        <Input
                          type="number"
                          value={config[category].frequency}
                          onChange={(e) => updateFrequency(category, Number(e.target.value))}
                          className="w-20"
                          min={1}
                        />
                      </div>
                    )}
                  </div>
                  {config[category].enabled && category !== 'customAttributes' && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {config[category].attributes.map(attr => (
                        <Badge key={attr} variant="neutral" size="sm">
                          {attr}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {step === 3 && (
          <div className="max-w-2xl">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                AI-Assisted Configuration (Coming Soon)
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                Describe what you want to monitor in plain English, and our AI will automatically configure the optimal settings for your agent.
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700 opacity-50">
                <textarea
                  placeholder="e.g., 'Monitor CPU and memory usage every minute, track all network connections, and capture application errors...'"
                  className="w-full h-24 p-3 border border-gray-300 dark:border-gray-600 rounded-lg"
                  disabled
                />
                <Button className="mt-3" disabled>
                  Generate Configuration
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              For now, you can continue with the manual configuration from the previous step.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Output Configuration
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Data Source Name
                  </label>
                  <Input
                    value={`${name} Data Source`}
                    readOnly
                    className="bg-gray-50 dark:bg-gray-800"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Automatically created from agent name
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ingestion Endpoint
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value="http://localhost:19071/api/v1/pulse"
                      readOnly
                      className="bg-gray-50 dark:bg-gray-800"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => navigator.clipboard.writeText('https://ingest.dnapulse.io/v1/events')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Authentication Token
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value="dnap_xxxxxxxxxxxxxxxxxxxxxxx"
                      readOnly
                      className="bg-gray-50 dark:bg-gray-800 font-mono"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => navigator.clipboard.writeText('dnap_xxxxxxxxxxxxxxxxxxxxxxx')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Token will be generated after creation
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Output Format
                  </label>
                  <Badge variant="neutral">JSON</Badge>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sample Event
                  </label>
                  <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
{`{
  "timestamp": "2024-01-08T12:34:56Z",
  "event_type": "system_metric",
  "agent_id": "agent-xxxx",
  "data": {
    "cpu_usage": 45.2,
    "memory_usage": 67.8,
    "disk_usage": 82.1
  }
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="max-w-2xl space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Review Configuration
            </h3>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agent Name</h4>
                <p className="text-sm text-gray-900 dark:text-white">{name}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</h4>
                <p className="text-sm text-gray-900 dark:text-white">{description}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Platform</h4>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{platformIcons[platform]}</span>
                  <span className="text-sm text-gray-900 dark:text-white capitalize">{platform}</span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Enabled Data Collection</h4>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(config) as Array<keyof DataCollectionConfig>)
                    .filter(key => config[key].enabled)
                    .map(key => (
                      <Badge key={key} variant="success">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Badge>
                    ))}
                </div>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200">
                After creating the agent, you'll receive deployment instructions and authentication credentials.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
        <Button variant="secondary" onClick={step === 1 ? onCancel : handleBack}>
          {step === 1 ? 'Cancel' : (
            <>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </>
          )}
        </Button>
        {step < 5 ? (
          <Button onClick={handleNext} disabled={step === 1 && (!name || !description)}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleCreate}>
            Create Agent
          </Button>
        )}
      </div>
    </div>
  );
}
