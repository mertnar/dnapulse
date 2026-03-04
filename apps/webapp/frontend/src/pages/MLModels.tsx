import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MLModelList } from '../components/ml-models/MLModelList';
import { mlModelsService } from '../services/mlModelsService';
import { Tabs } from '../components/ui/Tabs';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import {
  Brain, ExternalLink, CheckCircle, XCircle, Activity, TrendingUp,
  AlertTriangle, BookOpen, FileText
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type {
  MLModelExtended, MLModelInputOutput, MLTrainingDetails, MLValidationMetrics,
  MLDeployment, MLRuntimeMetrics, MLModelVersionHistory, MLGovernanceNote
} from '../types';

export function MLModels() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<MLModelExtended[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<MLModelExtended | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [inputOutput, setInputOutput] = useState<MLModelInputOutput | null>(null);
  const [training, setTraining] = useState<MLTrainingDetails | null>(null);
  const [validation, setValidation] = useState<MLValidationMetrics | null>(null);
  const [deployment, setDeployment] = useState<MLDeployment | null>(null);
  const [runtime, setRuntime] = useState<MLRuntimeMetrics | null>(null);
  const [versions, setVersions] = useState<MLModelVersionHistory[]>([]);
  const [governance, setGovernance] = useState<MLGovernanceNote[]>([]);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    if (selectedModelId) {
      loadModelDetails(selectedModelId);
    }
  }, [selectedModelId]);

  const loadModels = async () => {
    try {
      setLoading(true);
      const data = await mlModelsService.getMLModels();
      setModels(data);
      if (data.length > 0 && !selectedModelId) {
        setSelectedModelId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load ML models:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadModelDetails = async (modelId: string) => {
    try {
      const [modelData, inputOutputData, trainingData, validationData, deploymentData, runtimeData, versionsData, governanceData] = await Promise.all([
        mlModelsService.getMLModelById(modelId),
        mlModelsService.getModelInputOutput(modelId),
        mlModelsService.getTrainingDetails(modelId),
        mlModelsService.getValidationMetrics(modelId),
        mlModelsService.getDeployment(modelId),
        mlModelsService.getRuntimeMetrics(modelId),
        mlModelsService.getVersionHistory(modelId),
        mlModelsService.getGovernanceNotes(modelId)
      ]);

      if (modelData) setSelectedModel(modelData);
      setInputOutput(inputOutputData || null);
      setTraining(trainingData || null);
      setValidation(validationData || null);
      setDeployment(deploymentData || null);
      setRuntime(runtimeData || null);
      setVersions(versionsData);
      setGovernance(governanceData);
    } catch (error) {
      console.error('Failed to load model details:', error);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'contract', label: 'Model Contract' },
    { id: 'training', label: 'Training' },
    { id: 'validation', label: 'Validation' },
    { id: 'deployment', label: 'Deployment' },
    { id: 'runtime', label: 'Runtime & Usage' },
    { id: 'versions', label: 'Versions' },
    { id: 'governance', label: 'Governance' }
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-gray-500 dark:text-gray-400">Loading ML models...</div></div>;
  }

  if (models.length === 0) {
    return <div className="flex items-center justify-center h-full"><EmptyState icon={Brain} title="No ML Models" description="No ML models have been registered in the system yet." /></div>;
  }

  return (
    <div className="h-full flex">
      <div className="w-80 flex-shrink-0">
        <MLModelList models={models} selectedModelId={selectedModelId} onSelectModel={setSelectedModelId} />
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto">
        {selectedModel ? (
          <div className="p-6">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="pills" />

            <div className="mt-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <Card>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{selectedModel.name}</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{selectedModel.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={selectedModel.status === 'deployed' ? 'success' : 'default'}>{selectedModel.status}</Badge>
                        <Badge variant="default">v{selectedModel.version}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Problem Statement</div><div className="text-sm text-gray-900 dark:text-white">{selectedModel.problem_statement}</div></div>
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Model Family</div><div className="text-sm text-gray-900 dark:text-white capitalize">{selectedModel.type}</div></div>
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Learning Type</div><div className="text-sm text-gray-900 dark:text-white capitalize">{selectedModel.learning_type}</div></div>
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Inference Mode</div><div className="text-sm text-gray-900 dark:text-white capitalize">{selectedModel.inference_mode}</div></div>
                    </div>

                    {selectedModel.research_notebook_url && <a href={selectedModel.research_notebook_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 mr-4"><BookOpen className="h-4 w-4" />Research Notebook<ExternalLink className="h-3 w-3" /></a>}
                    {selectedModel.repository_url && <a href={selectedModel.repository_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"><FileText className="h-4 w-4" />Repository<ExternalLink className="h-3 w-3" /></a>}
                  </Card>

                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ownership & Review</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Owner</div><div className="text-sm text-gray-900 dark:text-white">{selectedModel.owner}</div></div>
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reviewers</div><div className="text-sm text-gray-900 dark:text-white">{selectedModel.reviewers.join(', ')}</div></div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">{(selectedModel.tags || []).map((tag, idx) => <span key={idx} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">{tag}</span>)}</div>
                  </Card>
                </div>
              )}

              {activeTab === 'contract' && inputOutput && (
                <div className="space-y-6">
                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Input Features</h3>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Required Data Models:</div>
                    <div className="mb-4 flex flex-wrap gap-2">{inputOutput.required_data_models.map((model, idx) => <Badge key={idx} variant="info">{model}</Badge>)}</div>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800"><tr><th className="text-left px-4 py-2 font-medium">Feature</th><th className="text-left px-4 py-2 font-medium">Type</th><th className="text-left px-4 py-2 font-medium">Required</th><th className="text-left px-4 py-2 font-medium">Description</th></tr></thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{inputOutput.features.map((feature, idx) => <tr key={idx}><td className="px-4 py-2 font-mono text-xs">{feature.name}</td><td className="px-4 py-2">{feature.type}</td><td className="px-4 py-2">{feature.required ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-gray-400" />}</td><td className="px-4 py-2 text-gray-600 dark:text-gray-400">{feature.description}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </Card>

                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Output Schema</h3>
                    <div className="mb-2"><span className="text-sm text-gray-600 dark:text-gray-400">Output Type:</span><Badge variant="info" className="ml-2">{inputOutput.output_type}</Badge></div>
                    <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-4 rounded overflow-x-auto">{JSON.stringify(inputOutput.output_schema, null, 2)}</pre>
                  </Card>

                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Example Request/Response</h3>
                    <div className="mb-4"><div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Request:</div><pre className="text-xs bg-gray-50 dark:bg-gray-800 p-4 rounded overflow-x-auto">{JSON.stringify(inputOutput.example_request, null, 2)}</pre></div>
                    <div><div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Response:</div><pre className="text-xs bg-gray-50 dark:bg-gray-800 p-4 rounded overflow-x-auto">{JSON.stringify(inputOutput.example_response, null, 2)}</pre></div>
                  </Card>
                </div>
              )}

              {activeTab === 'training' && training && (
                <div className="space-y-6">
                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Training Dataset</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Description</div><div className="text-sm text-gray-900 dark:text-white">{training.dataset_description}</div></div>
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Data Volume</div><div className="text-sm text-gray-900 dark:text-white">{training.data_volume.toLocaleString()} records</div></div>
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Time Range</div><div className="text-sm text-gray-900 dark:text-white">{new Date(training.time_range_start).toLocaleDateString()} - {new Date(training.time_range_end).toLocaleDateString()}</div></div>
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Training Duration</div><div className="text-sm text-gray-900 dark:text-white">{training.training_duration}</div></div>
                    </div>
                    {training.labeling_method && <div className="mb-4"><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Labeling Method</div><div className="text-sm text-gray-900 dark:text-white">{training.labeling_method}</div></div>}
                    <div className="mb-4"><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Training Environment</div><div className="text-sm text-gray-900 dark:text-white">{training.training_environment}</div></div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Dataset Sources:</div>
                    <div className="flex flex-wrap gap-2">{training.dataset_sources.map((source, idx) => <Badge key={idx} variant="default">{source}</Badge>)}</div>
                  </Card>

                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Training Metrics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {training.metrics.accuracy && <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg"><div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{(training.metrics.accuracy * 100).toFixed(1)}%</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Accuracy</div></div>}
                      {training.metrics.precision && <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg"><div className="text-2xl font-bold text-green-600 dark:text-green-400">{(training.metrics.precision * 100).toFixed(1)}%</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Precision</div></div>}
                      {training.metrics.recall && <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg"><div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{(training.metrics.recall * 100).toFixed(1)}%</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Recall</div></div>}
                      {training.metrics.f1_score && <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg"><div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{(training.metrics.f1_score * 100).toFixed(1)}%</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">F1 Score</div></div>}
                      {training.metrics.loss && <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg"><div className="text-2xl font-bold text-red-600 dark:text-red-400">{training.metrics.loss.toFixed(4)}</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Loss</div></div>}
                    </div>
                  </Card>

                  <Card><h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Training Notes</h3><p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{training.notes}</p></Card>
                </div>
              )}

              {activeTab === 'validation' && validation && (
                <div className="space-y-6">
                  <Card>
                    <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Validation Status</h3><Badge variant={validation.approval_status === 'approved' ? 'success' : 'warning'}>{validation.approval_status}</Badge></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Test Dataset</div><div className="text-sm text-gray-900 dark:text-white">{validation.test_dataset_description}</div></div>
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Evaluation Date</div><div className="text-sm text-gray-900 dark:text-white">{new Date(validation.evaluation_date).toLocaleDateString()}</div></div>
                    </div>
                    {validation.approved_by && <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Approved By</div><div className="text-sm text-gray-900 dark:text-white">{validation.approved_by}</div>{validation.approved_at && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDistanceToNow(new Date(validation.approved_at), { addSuffix: true })}</div>}</div>}
                  </Card>

                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Evaluation Metrics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {validation.metrics.accuracy && <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg"><div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{(validation.metrics.accuracy * 100).toFixed(1)}%</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Accuracy</div></div>}
                      {validation.metrics.precision && <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg"><div className="text-2xl font-bold text-green-600 dark:text-green-400">{(validation.metrics.precision * 100).toFixed(1)}%</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Precision</div></div>}
                      {validation.metrics.recall && <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg"><div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{(validation.metrics.recall * 100).toFixed(1)}%</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Recall</div></div>}
                      {validation.metrics.f1_score && <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg"><div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{(validation.metrics.f1_score * 100).toFixed(1)}%</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">F1 Score</div></div>}
                      {validation.metrics.auc_roc && <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg"><div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{(validation.metrics.auc_roc * 100).toFixed(1)}%</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">AUC-ROC</div></div>}
                    </div>
                  </Card>

                  <Card><h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Known Limitations</h3><ul className="space-y-2">{validation.known_limitations.map((limitation, idx) => <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"><AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />{limitation}</li>)}</ul></Card>
                  <Card><h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Validation Notes</h3><p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{validation.validation_notes}</p></Card>
                </div>
              )}

              {activeTab === 'deployment' && deployment && (
                <div className="space-y-6">
                  <Card>
                    <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Microservice Status</h3><Badge variant={deployment.health_status === 'healthy' ? 'success' : 'error'}>{deployment.health_status}</Badge></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Service Name</div><div className="text-sm font-mono text-gray-900 dark:text-white">{deployment.microservice_name}</div></div>
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Version</div><div className="text-sm text-gray-900 dark:text-white">{deployment.version}</div></div>
                      <div className="col-span-2"><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Endpoint</div><code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{deployment.endpoint}</code></div>
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Deployment Mode</div><div className="text-sm text-gray-900 dark:text-white capitalize">{deployment.deployment_mode}</div></div>
                      <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Uptime</div><div className="text-sm text-gray-900 dark:text-white">{deployment.uptime_percentage}%</div></div>
                    </div>
                  </Card>

                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resource Allocation</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg"><div className="text-lg font-bold text-blue-600 dark:text-blue-400">{deployment.resources.cpu}</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">CPU</div></div>
                      <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg"><div className="text-lg font-bold text-green-600 dark:text-green-400">{deployment.resources.ram}</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">RAM</div></div>
                      {deployment.resources.gpu && <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg"><div className="text-lg font-bold text-purple-600 dark:text-purple-400">{deployment.resources.gpu}</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">GPU</div></div>}
                    </div>
                    <div className="mt-4"><div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Scaling Strategy</div><div className="text-sm text-gray-900 dark:text-white">{deployment.scaling_strategy}</div></div>
                  </Card>

                  {deployment.usage_guide_url && <Card><h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Documentation</h3><div className="space-y-2"><a href={deployment.usage_guide_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"><BookOpen className="h-4 w-4" />Usage Guide<ExternalLink className="h-3 w-3" /></a>{deployment.api_spec_url && <a href={deployment.api_spec_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 ml-4"><FileText className="h-4 w-4" />API Specification<ExternalLink className="h-3 w-3" /></a>}</div></Card>}
                </div>
              )}

              {activeTab === 'runtime' && runtime && (
                <div className="space-y-6">
                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Metrics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg"><div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{runtime.inference_count_24h.toLocaleString()}</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Inferences (24h)</div></div>
                      <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg"><div className="text-2xl font-bold text-green-600 dark:text-green-400">{runtime.inference_count_7d.toLocaleString()}</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Inferences (7d)</div></div>
                      <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg"><div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{runtime.average_latency_ms}ms</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Avg Latency</div></div>
                      <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg"><div className="text-2xl font-bold text-red-600 dark:text-red-400">{(runtime.error_rate * 100).toFixed(2)}%</div><div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Error Rate</div></div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-gray-400" /><span className="text-gray-600 dark:text-gray-400">Last Prediction: {formatDistanceToNow(new Date(runtime.last_prediction_time), { addSuffix: true })}</span></div>
                    {runtime.drift_detected && <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-2"><AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" /><div className="text-sm text-yellow-700 dark:text-yellow-300">Model drift detected. Consider retraining with recent data.</div></div>}
                  </Card>

                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Usage by Rules</h3>
                    {runtime.used_by_rules.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No rules using this model</p> : <div className="space-y-2">{runtime.used_by_rules.map((rule) => <button key={rule.id} onClick={() => navigate('/search-rules')} className="w-full p-3 text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center justify-between"><span className="text-sm text-gray-900 dark:text-white">{rule.name}</span><ExternalLink className="h-4 w-4 text-gray-400" /></button>)}</div>}
                  </Card>

                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Investigations</h3>
                    {runtime.used_in_investigations.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No investigations referencing this model</p> : <div className="space-y-2">{runtime.used_in_investigations.map((inv) => <button key={inv.id} onClick={() => navigate('/investigations')} className="w-full p-3 text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center justify-between"><span className="text-sm text-gray-900 dark:text-white">{inv.title}</span><ExternalLink className="h-4 w-4 text-gray-400" /></button>)}</div>}
                  </Card>
                </div>
              )}

              {activeTab === 'versions' && (
                <div className="space-y-4">
                  {versions.length === 0 ? <Card><p className="text-sm text-gray-500 dark:text-gray-400">No version history available</p></Card> : versions.map((version, idx) => (
                    <Card key={idx}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Version {version.version}</h3>
                          {idx === 0 && <Badge variant="success">Current</Badge>}
                          {version.deprecated && <Badge variant="error">Deprecated</Badge>}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}</div>
                      </div>

                      <div className="mb-4"><div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Changes:</div><ul className="space-y-1">{version.changes.map((change, changeIdx) => <li key={changeIdx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"><span className="text-blue-600 dark:text-blue-400">•</span>{change}</li>)}</ul></div>

                      {version.metric_comparison && <div className="mb-4"><div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Metric Improvements:</div><div className="flex gap-4">{version.metric_comparison.accuracy_delta && <div className="flex items-center gap-1 text-sm"><TrendingUp className="h-4 w-4 text-green-600" /><span className="text-gray-700 dark:text-gray-300">Accuracy: +{(version.metric_comparison.accuracy_delta * 100).toFixed(1)}%</span></div>}{version.metric_comparison.precision_delta && <div className="flex items-center gap-1 text-sm"><TrendingUp className="h-4 w-4 text-green-600" /><span className="text-gray-700 dark:text-gray-300">Precision: +{(version.metric_comparison.precision_delta * 100).toFixed(1)}%</span></div>}</div></div>}

                      {version.schema_changes.length > 0 && <div><div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Schema Changes:</div><div className="flex flex-wrap gap-2">{version.schema_changes.map((change, changeIdx) => <Badge key={changeIdx} variant="info" className="text-xs">{change}</Badge>)}</div></div>}

                      {version.deprecated && version.deprecation_reason && <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"><div className="text-sm text-red-700 dark:text-red-300"><strong>Deprecation Reason:</strong> {version.deprecation_reason}</div></div>}
                    </Card>
                  ))}
                </div>
              )}

              {activeTab === 'governance' && (
                <div className="space-y-6">
                  {governance.length === 0 ? <Card><p className="text-sm text-gray-500 dark:text-gray-400">No governance notes available</p></Card> : governance.map((note) => (
                    <Card key={note.id}>
                      <div className="flex items-start justify-between mb-3">
                        <Badge variant={note.category === 'compliance' ? 'success' : note.category === 'risk' ? 'error' : note.category === 'assumption' ? 'warning' : 'default'}>{note.category}</Badge>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</div>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-2">{note.content}</p>
                      <div className="text-xs text-gray-500 dark:text-gray-400">by {note.author}</div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <EmptyState icon={Brain} title="Select a Model" description="Select a model from the list to view its lifecycle, metrics, and usage." />
          </div>
        )}
      </div>
    </div>
  );
}
