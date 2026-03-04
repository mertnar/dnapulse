import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Server,
  Database,
  Webhook,
  Code,
  Wifi,
  Loader
} from 'lucide-react';
import type { DataSource, DataSourceType, DataModelField } from '../../types';
import { dataSourcesService } from '../../services/dataSourcesService';

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (dataSource: DataSource) => void;
}

interface FormData {
  name: string;
  type: DataSourceType | '';
  connectionConfig: Record<string, any>;
  discoveryEnabled: boolean;
  discoveredFields: DataModelField[];
  pipelineEnabled: boolean;
  mappings: Array<{ source: string; target: string; transform: string }>;
}

const sourceTypes = [
  { type: 'Agent', icon: Server, description: 'Deploy agents to endpoints' },
  { type: 'ELK/Elastic', icon: Database, description: 'Connect to Elasticsearch cluster' },
  { type: 'API/Webhook', icon: Webhook, description: 'Receive events via HTTP' },
  { type: 'Custom SDK', icon: Code, description: 'Integrate using SDK' },
  { type: 'Network/IoT Stream', icon: Wifi, description: 'MQTT, Kafka, or NATS' }
];

export function AddDataSourceWizard({ isOpen, onClose, onComplete }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: '',
    connectionConfig: {},
    discoveryEnabled: true,
    discoveredFields: [],
    pipelineEnabled: false,
    mappings: []
  });
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const steps = [
    { number: 1, title: 'Basics' },
    { number: 2, title: 'Connection' },
    { number: 3, title: 'Schema Discovery' },
    { number: 4, title: 'Mapping & Pipeline' },
    { number: 5, title: 'Review & Create' }
  ];

  const handleNext = async () => {
    if (currentStep === 3 && formData.discoveryEnabled && formData.discoveredFields.length === 0) {
      await runDiscovery();
    }
    setCurrentStep(prev => Math.min(prev + 1, 5));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const runDiscovery = async () => {
    setIsDiscovering(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setFormData(prev => ({
      ...prev,
      discoveredFields: [
        { name: 'timestamp', type: 'date', required: true, example: '2026-01-08T10:30:00Z', last_seen: new Date().toISOString() },
        { name: 'event_type', type: 'string', required: true, example: 'system.event', last_seen: new Date().toISOString() },
        { name: 'severity', type: 'string', required: false, example: 'info', last_seen: new Date().toISOString() },
        { name: 'message', type: 'string', required: false, example: 'Sample event message', last_seen: new Date().toISOString() }
      ]
    }));
    setIsDiscovering(false);
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const newSource = await dataSourcesService.createDataSource({
        organization_id: 'org-1',
        name: formData.name,
        type: formData.type as DataSourceType,
        status: 'active',
        throughput: 0,
        latencyP95: 0,
        last_seen: new Date().toISOString(),
        model_id: formData.discoveryEnabled ? `model-${Date.now()}` : null,
        drift_status: 'none',
        connection_config: formData.connectionConfig,
        pipeline_config: formData.pipelineEnabled ? {
          steps: [
            { id: 'step-1', type: 'parse', enabled: true, config: {} },
            { id: 'step-2', type: 'normalize', enabled: true, config: {} }
          ],
          mappings: formData.mappings.map(m => ({
            source_field: m.source,
            target_field: m.target,
            transformation: m.transform as any
          }))
        } : null,
        config: {}
      });
      onComplete(newSource);
      resetForm();
    } catch (error) {
      console.error('Failed to create data source:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setFormData({
      name: '',
      type: '',
      connectionConfig: {},
      discoveryEnabled: true,
      discoveredFields: [],
      pipelineEnabled: false,
      mappings: []
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name && formData.type;
      case 2:
        return Object.keys(formData.connectionConfig).length > 0;
      default:
        return true;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Data Source" size="xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep > step.number
                      ? 'bg-green-600 text-white'
                      : currentStep === step.number
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {currentStep > step.number ? <Check className="h-4 w-4" /> : step.number}
                </div>
                <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white hidden md:inline">
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${currentStep > step.number ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="min-h-[400px]">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Data Source Name
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Production API Logs"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Source Type
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sourceTypes.map(({ type, icon: Icon, description }) => (
                    <button
                      key={type}
                      onClick={() => setFormData(prev => ({ ...prev, type: type as DataSourceType }))}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        formData.type === type
                          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <Icon className={`h-6 w-6 mb-2 ${formData.type === type ? 'text-primary-600' : 'text-gray-400'}`} />
                      <div className="font-medium text-gray-900 dark:text-white">{type}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              {formData.type === 'Agent' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Enrollment Token
                    </label>
                    <div className="flex gap-2">
                      <Input value="tk_enroll_xyz789abc123" readOnly />
                      <Button variant="secondary" onClick={() => copyToClipboard('tk_enroll_xyz789abc123')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Install Command
                    </label>
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
                      curl -s https://install.dnapulse.io/agent.sh | bash -s -- --token tk_enroll_xyz789abc123
                    </pre>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                      onClick={() => copyToClipboard('curl -s https://install.dnapulse.io/agent.sh | bash -s -- --token tk_enroll_xyz789abc123')}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Command
                    </Button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Transport
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      value={formData.connectionConfig.transport || 'grpc'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        connectionConfig: { ...prev.connectionConfig, transport: e.target.value }
                      }))}
                    >
                      <option value="grpc">gRPC</option>
                      <option value="http">HTTP</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="mtls"
                      className="rounded"
                      checked={formData.connectionConfig.mtls_enabled || false}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        connectionConfig: { ...prev.connectionConfig, mtls_enabled: e.target.checked }
                      }))}
                    />
                    <label htmlFor="mtls" className="ml-2 text-sm text-gray-900 dark:text-white">
                      Enable mTLS
                    </label>
                  </div>
                </div>
              )}

              {formData.type === 'ELK/Elastic' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Cluster URL
                    </label>
                    <Input
                      placeholder="https://elk.company.com:9200"
                      value={formData.connectionConfig.cluster_url || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        connectionConfig: { ...prev.connectionConfig, cluster_url: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Auth Method
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      value={formData.connectionConfig.auth_method || 'api_key'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        connectionConfig: { ...prev.connectionConfig, auth_method: e.target.value }
                      }))}
                    >
                      <option value="basic">Basic Auth</option>
                      <option value="api_key">API Key</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Index Pattern
                    </label>
                    <Input
                      placeholder="logs-*"
                      value={formData.connectionConfig.index_pattern || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        connectionConfig: { ...prev.connectionConfig, index_pattern: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Time Field
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      value={formData.connectionConfig.time_field || '@timestamp'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        connectionConfig: { ...prev.connectionConfig, time_field: e.target.value }
                      }))}
                    >
                      <option value="@timestamp">@timestamp</option>
                      <option value="timestamp">timestamp</option>
                      <option value="created_at">created_at</option>
                    </select>
                  </div>
                </div>
              )}

              {formData.type === 'API/Webhook' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Ingestion Endpoint
                    </label>
                    <div className="flex gap-2">
                      <Input value="http://localhost:19071/api/v1/pulse" readOnly />
                      <Button variant="secondary" onClick={() => copyToClipboard('http://localhost:19071/api/v1/pulse')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Secret Token
                    </label>
                    <div className="flex gap-2">
                      <Input value="whsec_abcd1234efgh5678" readOnly type="password" />
                      <Button variant="secondary" onClick={() => copyToClipboard('whsec_abcd1234efgh5678')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Sample cURL Request
                    </label>
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
{`curl -X POST http://localhost:19071/api/v1/pulse \\
  -H "Authorization: Bearer whsec_abcd1234efgh5678" \\
  -H "Content-Type: application/json" \\
  -d '{"event_type":"test","severity":"info"}'`}
                    </pre>
                  </div>
                </div>
              )}

              {formData.type === 'Custom SDK' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Language
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      value={formData.connectionConfig.language || 'python'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        connectionConfig: { ...prev.connectionConfig, language: e.target.value }
                      }))}
                    >
                      <option value="python">Python</option>
                      <option value="node">Node.js</option>
                      <option value="go">Go</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      API Key
                    </label>
                    <div className="flex gap-2">
                      <Input value="sdk_py_xyz789abc" readOnly />
                      <Button variant="secondary" onClick={() => copyToClipboard('sdk_py_xyz789abc')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      SDK Snippet
                    </label>
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
{`from dnapulse import Client

client = Client(api_key="sdk_py_xyz789abc")
client.send_event({
    "event_type": "user.login",
    "severity": "info",
    "user_id": "12345"
})`}
                    </pre>
                  </div>
                </div>
              )}

              {formData.type === 'Network/IoT Stream' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Protocol
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                      value={formData.connectionConfig.protocol || 'MQTT'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        connectionConfig: { ...prev.connectionConfig, protocol: e.target.value }
                      }))}
                    >
                      <option value="MQTT">MQTT</option>
                      <option value="Kafka">Kafka</option>
                      <option value="NATS">NATS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Broker URL
                    </label>
                    <Input
                      placeholder="mqtt://broker.company.com:1883"
                      value={formData.connectionConfig.broker_url || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        connectionConfig: { ...prev.connectionConfig, broker_url: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Topic/Subject
                    </label>
                    <Input
                      placeholder="sensors/telemetry/#"
                      value={formData.connectionConfig.topic || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        connectionConfig: { ...prev.connectionConfig, topic: e.target.value }
                      }))}
                    />
                  </div>
                </div>
              )}

              {formData.type && (
                <Button
                  variant="secondary"
                  onClick={() => alert('Connection test successful!')}
                  className="w-full"
                >
                  Test Connection
                </Button>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.discoveryEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, discoveryEnabled: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                    Run discovery now (recommended)
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                  Automatically discover schema from sample events
                </p>
              </div>

              {formData.discoveryEnabled && (
                <>
                  {isDiscovering ? (
                    <div className="text-center py-12">
                      <Loader className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Discovering schema from sample events...
                      </p>
                    </div>
                  ) : formData.discoveredFields.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                        Discovered Fields
                      </h4>
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Field Name</th>
                              <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Type</th>
                              <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Required</th>
                              <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Sample Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.discoveredFields.map((field, index) => (
                              <tr key={index} className="border-t border-gray-200 dark:border-gray-700">
                                <td className="p-3 font-mono text-xs">{field.name}</td>
                                <td className="p-3 text-gray-600 dark:text-gray-400">{field.type}</td>
                                <td className="p-3">{field.required ? '✓' : '-'}</td>
                                <td className="p-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                                  {String(field.example)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </>
              )}

              {!formData.discoveryEnabled && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Data model will be marked as Undefined. You can run discovery later or send a sample event.
                  </p>
                </div>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.pipelineEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, pipelineEnabled: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                    Enable ingestion pipeline
                  </span>
                </label>
              </div>

              {formData.pipelineEnabled && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Pipeline Steps
                    </h4>
                    <div className="space-y-2">
                      {['Parse', 'Normalize', 'Enrich', 'Mask/Drop', 'Route'].map(step => (
                        <label key={step} className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <input type="checkbox" defaultChecked className="rounded" />
                          <span className="ml-3 text-sm text-gray-900 dark:text-white">{step}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Field Mappings
                    </h4>
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                        <div>Source Field</div>
                        <div>Target Field</div>
                        <div>Transform</div>
                      </div>
                      {formData.mappings.map((mapping, index) => (
                        <div key={index} className="grid grid-cols-3 gap-2">
                          <Input value={mapping.source} readOnly size="sm" />
                          <Input value={mapping.target} readOnly size="sm" />
                          <select className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800">
                            <option>None</option>
                            <option>Lowercase</option>
                            <option>Uppercase</option>
                          </select>
                        </div>
                      ))}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          mappings: [...prev.mappings, { source: 'field_name', target: 'canonical_name', transform: 'none' }]
                        }))}
                      >
                        Add Mapping
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{formData.name}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">{formData.type}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Schema Discovery</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {formData.discoveryEnabled ? `Enabled (${formData.discoveredFields.length} fields)` : 'Disabled'}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pipeline</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {formData.pipelineEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Ready to create data source. Click Create to finish.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="secondary"
            onClick={currentStep === 1 ? onClose : handleBack}
            disabled={isCreating}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>
          {currentStep < 5 ? (
            <Button onClick={handleNext} disabled={!canProceed() || isDiscovering}>
              {isDiscovering ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Discovering...
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Create
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
