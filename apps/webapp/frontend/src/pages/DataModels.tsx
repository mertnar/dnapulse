import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModelList } from '../components/data-models/ModelList';
import { ModelPlayground } from '../components/data-models/ModelPlayground';
import { ModelContext } from '../components/data-models/ModelContext';
import { AddDerivedAttributeModal } from '../components/data-models/AddDerivedAttributeModal';
import { CreateDerivedModelModal } from '../components/data-models/CreateDerivedModelModal';
import { CreateVectorModelModal } from '../components/data-models/CreateVectorModelModal';
import { PipelineBuilderModal } from '../components/data-models/PipelineBuilderModal';
import { dataModelsService } from '../services/dataModelsService';
import { EmptyState } from '../components/ui/EmptyState';
import { Database } from 'lucide-react';
import type {
  DataModelExtended,
  ModelLineage,
  ModelNote,
  ModelUsage,
  ModelContributor,
  ModelVersion,
  DataSampleRecord,
  ModelAttribute
} from '../types';

export function DataModels() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<DataModelExtended[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<DataModelExtended | null>(null);

  const [lineage, setLineage] = useState<ModelLineage>({ sources: [], consumers: [], relationships: [] });
  const [notes, setNotes] = useState<ModelNote[]>([]);
  const [usage, setUsage] = useState<ModelUsage>({ rules: [], alerts_triggered: 0, investigations: [], ml_pipelines: [] });
  const [contributors, setContributors] = useState<ModelContributor[]>([]);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [sampleData, setSampleData] = useState<DataSampleRecord[]>([]);
  const [showAddAttributeModal, setShowAddAttributeModal] = useState(false);
  const [showCreateDerivedModal, setShowCreateDerivedModal] = useState(false);
  const [showCreateVectorModal, setShowCreateVectorModal] = useState(false);
  const [pipelineData, setPipelineData] = useState<{
    id: string;
    version: number;
    status: string;
    pipeline: { steps: any[] };
  } | null>(null);
  const [showPipelineBuilderModal, setShowPipelineBuilderModal] = useState(false);

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
      const data = await dataModelsService.getDataModels();
      setModels(data);

      if (data.length > 0 && !selectedModelId) {
        setSelectedModelId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadModelDetails = async (modelId: string) => {
    try {
      const [
        modelData,
        lineageData,
        notesData,
        usageData,
        contributorsData,
        versionsData,
        sampleDataData
      ] = await Promise.all([
        dataModelsService.getDataModelById(modelId),
        dataModelsService.getModelLineage(modelId),
        dataModelsService.getModelNotes(modelId),
        dataModelsService.getModelUsage(modelId),
        dataModelsService.getModelContributors(modelId),
        dataModelsService.getModelVersions(modelId),
        dataModelsService.getModelSampleData(modelId)
      ]);

      if (modelData) {
        setSelectedModel(modelData);
      } else {
        setSelectedModel(null);
      }
      setLineage(lineageData);
      setNotes(notesData);
      setUsage(usageData);
      setContributors(contributorsData);
      setVersions(versionsData);
      setSampleData(sampleDataData);
      setPipelineData(null);
      if (modelData && (modelData.type === 'derived' || modelData.type === 'vector')) {
        try {
          const pipeline = await dataModelsService.getPipeline(modelId);
          if (pipeline) {
            setPipelineData({
              id: pipeline.id,
              version: pipeline.version,
              status: pipeline.status,
              pipeline: pipeline.pipeline || { steps: [] }
            });
          }
        } catch {
          setPipelineData(null);
        }
      }
    } catch (error) {
      console.error('Failed to load model details:', error);
    }
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModelId(modelId);
  };

  const handleCreateModel = () => {
    console.log('Create new model');
  };

  const handleUpdateModel = (updates: Partial<DataModelExtended>) => {
    if (selectedModel) {
      setSelectedModel({ ...selectedModel, ...updates });
    }
  };

  const handleUpdateAttribute = async (attributeId: string, updates: Partial<ModelAttribute>) => {
    if (!selectedModel) return;

    try {
      const updatedAttr = await dataModelsService.updateAttribute(
        selectedModel.id,
        attributeId,
        updates
      );

      setSelectedModel({
        ...selectedModel,
        attributes: (selectedModel.attributes || []).map(attr =>
          attr.id === attributeId ? { ...attr, ...updates } : attr
        )
      });
    } catch (error) {
      console.error('Failed to update attribute:', error);
    }
  };

  const handleOpenAddAttributeModal = () => {
    setShowAddAttributeModal(true);
  };

  const handleSaveDerivedAttribute = async (attribute: Omit<ModelAttribute, 'id'>) => {
    if (!selectedModel) return;

    const newAttr = await dataModelsService.createDerivedAttribute(selectedModel.id, attribute);
    setSelectedModel({
      ...selectedModel,
      attributes: [...(selectedModel.attributes || []), newAttr]
    });
  };

  const handleSaveVersion = async () => {
    if (!selectedModel) return;

    try {
      const newVersion = await dataModelsService.saveModelVersion(
        selectedModel.id,
        ['Manual save by user']
      );
      setVersions([newVersion, ...versions]);
      console.log('Version saved successfully');
    } catch (error) {
      console.error('Failed to save version:', error);
    }
  };

  const handleViewLiveData = () => {
    navigate('/live-monitor');
  };

  const handleCreateDerived = async () => {
    setShowCreateDerivedModal(true);
  };

  const handleVectorize = () => {
    setShowCreateVectorModal(true);
  };

  const handleCreateDerivedModel = async (params: {
    name: string;
    source_model_ids: string[];
    attributes?: Array<{ path: string; type: string }>;
    pipeline?: { steps: any[] };
  }) => {
    const newModel = await dataModelsService.createDerivedModel(params);
    setModels((prev) => [...prev, newModel]);
    setSelectedModelId(newModel.id);
    setSelectedModel(newModel);
  };

  const handlePipelineSaved = () => {
    if (selectedModelId) {
      dataModelsService.getPipeline(selectedModelId).then((p) => {
        if (p) {
          setPipelineData({
            id: p.id,
            version: p.version,
            status: p.status,
            pipeline: p.pipeline || { steps: [] }
          });
        }
      }).catch(() => setPipelineData(null));
    }
  };

  const handleCreateVectorModel = async (params: {
    name: string;
    source_model_id: string;
    text_field: string;
    embedding_model?: string;
    dimensions?: number;
  }) => {
    const newModel = await dataModelsService.createVectorModel(params);
    setModels((prev) => [...prev, newModel]);
    setSelectedModelId(newModel.id);
    setSelectedModel(newModel);
  };

  const handleAddNote = async (content: string, attributeName?: string) => {
    if (!selectedModel) return;

    try {
      const newNote = await dataModelsService.addNote({
        model_id: selectedModel.id,
        attribute_name: attributeName,
        content,
        author: 'current-user@example.com'
      });
      setNotes([newNote, ...notes]);
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const handleNavigate = (type: string, id: string) => {
    switch (type) {
      case 'agent':
        navigate('/agents');
        break;
      case 'data-source':
        navigate('/data-sources');
        break;
      case 'model':
        setSelectedModelId(id);
        break;
      case 'rule':
        navigate('/search-rules');
        break;
      case 'alert':
        navigate('/alerts');
        break;
      case 'investigation':
        navigate('/investigations');
        break;
      case 'ml-pipeline':
        navigate('/ml-models');
        break;
      default:
        console.log('Navigate to', type, id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">Loading models...</div>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          icon={Database}
          title="No Data Models"
          description="Get started by creating your first data model or connecting a data source."
          action={{
            label: 'Create Model',
            onClick: handleCreateModel
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <div className="w-80 flex-shrink-0">
        <ModelList
          models={models}
          selectedModelId={selectedModelId}
          onSelectModel={handleSelectModel}
          onCreateModel={handleCreateModel}
          onOpenCreateDerived={() => setShowCreateDerivedModal(true)}
          onOpenCreateVector={() => setShowCreateVectorModal(true)}
        />
      </div>

      <div className="flex-1 min-w-0">
        {selectedModel ? (
          <>
            <ModelPlayground
              model={selectedModel}
              sampleData={sampleData}
              onUpdateModel={handleUpdateModel}
              onUpdateAttribute={handleUpdateAttribute}
              onOpenAddAttributeModal={handleOpenAddAttributeModal}
              onSaveVersion={handleSaveVersion}
              onViewLiveData={handleViewLiveData}
              onCreateDerived={handleCreateDerived}
              onVectorize={handleVectorize}
            />
            <AddDerivedAttributeModal
              isOpen={showAddAttributeModal}
              onClose={() => setShowAddAttributeModal(false)}
              modelName={selectedModel.name}
              existingAttributes={selectedModel.attributes || []}
              nextOrder={(selectedModel.attributes || []).length + 1}
              onSave={handleSaveDerivedAttribute}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 dark:text-gray-400">
              Select a model to view details
            </div>
          </div>
        )}
      </div>

      <CreateDerivedModelModal
        isOpen={showCreateDerivedModal}
        onClose={() => setShowCreateDerivedModal(false)}
        models={models}
        defaultSourceModelId={selectedModel?.id ?? null}
        onCreate={handleCreateDerivedModel}
      />
      <CreateVectorModelModal
        isOpen={showCreateVectorModal}
        onClose={() => setShowCreateVectorModal(false)}
        sourceModel={selectedModel ?? null}
        models={models}
        onCreate={handleCreateVectorModel}
      />
      {selectedModel && (
        <PipelineBuilderModal
          isOpen={showPipelineBuilderModal}
          onClose={() => setShowPipelineBuilderModal(false)}
          modelId={selectedModel.id}
          modelName={selectedModel.name}
          pipeline={pipelineData}
          attributes={selectedModel.attributes || []}
          onSave={handlePipelineSaved}
        />
      )}

      <div className="w-96 flex-shrink-0">
        {selectedModel && (
          <ModelContext
            lineage={lineage}
            notes={notes}
            usage={usage}
            contributors={contributors}
            versions={versions}
            pipeline={pipelineData}
            modelId={selectedModel.id}
            modelType={selectedModel.type}
            modelAttributes={selectedModel.attributes || []}
            onAddNote={handleAddNote}
            onNavigate={handleNavigate}
            onOpenPipelineBuilder={() => setShowPipelineBuilderModal(true)}
          />
        )}
      </div>
    </div>
  );
}
