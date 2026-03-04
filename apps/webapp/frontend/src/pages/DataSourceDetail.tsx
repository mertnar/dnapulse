import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Tabs } from '../components/ui/Tabs';
import { Drawer } from '../components/ui/Drawer';
import {
  ArrowLeft,
  PlayCircle,
  RefreshCw,
  Power,
  PowerOff,
  Activity,
  Database,
  AlertTriangle,
  FileJson,
  Route,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { dataSourcesService } from '../services/dataSourcesService';
import type { DataSource, DataModelDetail, SampleEvent, SchemaChange, DataSourceError, AuditLog } from '../types';

export function DataSourceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [dataModel, setDataModel] = useState<DataModelDetail | null>(null);
  const [sampleEvents, setSampleEvents] = useState<SampleEvent[]>([]);
  const [schemaChanges, setSchemaChanges] = useState<SchemaChange[]>([]);
  const [errors, setErrors] = useState<DataSourceError[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<SampleEvent | null>(null);
  const [isEventDrawerOpen, setIsEventDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const source = await dataSourcesService.getDataSourceById(id);
      setDataSource(source || null);

      if (source?.model_id) {
        // getDataModel expects sourceId, not modelId
        const model = await dataSourcesService.getDataModel(id);
        setDataModel(model || null);
      }

      const [events, changes, sourceErrors, logs] = await Promise.all([
        dataSourcesService.getSampleEvents(id),
        dataSourcesService.getSchemaChanges(id),
        dataSourcesService.getErrors(id),
        dataSourcesService.getAuditLogs(id)
      ]);

      setSampleEvents(events);
      setSchemaChanges(changes);
      setErrors(sourceErrors);
      setAuditLogs(logs);
    } catch (error) {
      console.error('Failed to fetch data source:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!id) return;
    const result = await dataSourcesService.testConnection(id);
    alert(result.message);
  };

  const handleRunDiscovery = async () => {
    if (!id) return;
    try {
      const model = await dataSourcesService.runDiscovery(id);
      setDataModel(model);
      if (dataSource) {
        const updated = await dataSourcesService.updateDataSource(id, { model_id: model.id });
        setDataSource(updated);
      }
      alert('Discovery completed successfully');
    } catch (error) {
      console.error('Failed to run discovery:', error);
    }
  };

  const handleToggleStatus = async () => {
    if (!id || !dataSource) return;
    const newStatus = dataSource.status === 'disabled' ? 'active' : 'disabled';
    const updated = await dataSourcesService.updateDataSource(id, { status: newStatus });
    setDataSource(updated);
  };

  const handleSendTestEvent = async () => {
    if (!id) return;
    const event = await dataSourcesService.sendTestEvent(id);
    setSampleEvents(prev => [event, ...prev]);
    alert('Test event sent successfully');
  };

  const handleAcceptChanges = async () => {
    if (!id) return;
    await dataSourcesService.acceptSchemaChanges(id);
    setSchemaChanges([]);
    if (dataSource) {
      setDataSource({ ...dataSource, drift_status: 'none' });
    }
    alert('Schema changes accepted');
  };

  const handleEventClick = (event: SampleEvent) => {
    setSelectedEvent(event);
    setIsEventDrawerOpen(true);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'degraded': return 'warning';
      case 'error': return 'danger';
      case 'disabled': return 'neutral';
      default: return 'neutral';
    }
  };

  if (loading || !dataSource) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  const overviewTab = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">Throughput</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {dataSource.throughput.toLocaleString()}/s
              </p>
            </div>
            <Activity className="h-8 w-8 text-primary-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">p95 Latency</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {dataSource.latencyP95}ms
              </p>
            </div>
            <Clock className="h-8 w-8 text-primary-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">Errors (24h)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {errors.length}
              </p>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">Last Seen</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                {formatDistanceToNow(new Date(dataSource.last_seen), { addSuffix: true })}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </Card>
      </div>

      {errors.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Errors</h3>
          <div className="space-y-3">
            {errors.slice(0, 5).map((error) => (
              <div key={error.id} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">{error.error_type}</p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">{error.message}</p>
                  </div>
                  <span className="text-xs text-red-600 dark:text-red-400">
                    {formatDistanceToNow(new Date(error.timestamp), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );

  const connectionTab = (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Connection Configuration</h3>
          <Button variant="secondary" size="sm" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? 'Cancel' : 'Edit'}
          </Button>
        </div>

        <div className="space-y-4">
          {dataSource?.connection_config && Object.keys(dataSource.connection_config).length > 0 ? (
            Object.entries(dataSource.connection_config).map(([key, value]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                  {key.replace(/_/g, ' ')}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={String(value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                    readOnly={!isEditing}
                  />
                ) : (
                  <p className="text-sm font-mono text-gray-900 dark:text-white">{String(value)}</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No connection configuration available</p>
          )}
        </div>

        {isEditing && (
          <Button onClick={() => {
            setIsEditing(false);
            alert('Configuration saved');
          }} className="mt-4">
            Save Changes
          </Button>
        )}
      </Card>

      <Button variant="secondary" onClick={handleTestConnection}>
        <PlayCircle className="h-4 w-4 mr-2" />
        Test Connection
      </Button>
    </div>
  );

  const schemaTab = (
    <div className="space-y-6">
      {!dataModel ? (
        <Card>
          <div className="text-center py-12">
            <Database className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Undefined Data Model
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              No schema has been discovered yet for this data source
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={handleRunDiscovery}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Discovery
              </Button>
              <Button variant="secondary" onClick={handleSendTestEvent}>
                Send Sample Event
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{dataModel?.name || 'Data Model'}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Version {dataModel?.version || 1}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleRunDiscovery}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Field Name</th>
                    <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Type</th>
                    <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Required</th>
                    <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Example</th>
                    <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {dataModel?.fields?.map((field, index) => (
                    <tr key={index} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="p-3 font-mono text-xs">{field.name}</td>
                      <td className="p-3">
                        <Badge variant="info">{field.type}</Badge>
                      </td>
                      <td className="p-3">{field.required ? '✓' : '-'}</td>
                      <td className="p-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                        {field.example ? String(field.example) : '-'}
                      </td>
                      <td className="p-3 text-xs text-gray-500 dark:text-gray-400">
                        {field.last_seen ? formatDistanceToNow(new Date(field.last_seen), { addSuffix: true }) : '-'}
                      </td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-gray-500 dark:text-gray-400">
                        No fields discovered yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {schemaChanges && schemaChanges.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Schema Drift Detected</h3>
                </div>
                <Badge variant="warning">Drift</Badge>
              </div>

              <div className="space-y-2 mb-4">
                {schemaChanges.map((change, index) => (
                  <div key={index} className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                          {change.field_name}
                        </span>
                        <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
                          {change.change_type === 'added' && 'New field added'}
                          {change.change_type === 'removed' && 'Field removed'}
                          {change.change_type === 'type_changed' && `Type changed from ${change.old_type} to ${change.new_type}`}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(change.detected_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button onClick={handleAcceptChanges}>
                  Accept Changes (create v{(dataModel?.version || 0) + 1})
                </Button>
                <Button variant="secondary" onClick={() => setSchemaChanges([])}>
                  Ignore
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );

  const pipelineTab = (
    <div className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pipeline Steps</h3>
        {dataSource.pipeline_config ? (
          <div className="space-y-2">
            {dataSource.pipeline_config.steps.map((step) => (
              <div key={step.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{step.type}</span>
                <Badge variant={step.enabled ? 'success' : 'neutral'}>
                  {step.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">No pipeline configured</p>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Field Mappings</h3>
        {dataSource.pipeline_config?.mappings && dataSource.pipeline_config.mappings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Source Field</th>
                  <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Target Field</th>
                  <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Transformation</th>
                </tr>
              </thead>
              <tbody>
                {dataSource.pipeline_config.mappings.map((mapping, index) => (
                  <tr key={index} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="p-3 font-mono text-xs">{mapping.source_field}</td>
                    <td className="p-3 font-mono text-xs">{mapping.target_field}</td>
                    <td className="p-3 text-xs text-gray-600 dark:text-gray-400">{mapping.transformation || 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">No mappings configured</p>
        )}
      </Card>
    </div>
  );

  const sampleEventsTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sample Events</h3>
        <Button variant="secondary" size="sm" onClick={handleSendTestEvent}>
          Send Test Event
        </Button>
      </div>

      {sampleEvents.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FileJson className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600 dark:text-gray-400">No sample events available</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {sampleEvents.map((event) => (
            <Card key={event.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleEventClick(event)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={
                    event.severity === 'critical' ? 'danger' :
                    event.severity === 'high' ? 'warning' : 'info'
                  }>
                    {event.severity}
                  </Badge>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Event ID: {event.id}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const routingTab = (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Output Routing</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Output Stream/Topic
          </label>
          <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white">
            <option>default-stream</option>
            <option>security-events</option>
            <option>application-logs</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            Current Route
          </label>
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm font-mono text-gray-900 dark:text-white">default-stream</p>
          </div>
        </div>
        <Button>Save Routing Configuration</Button>
      </div>
    </Card>
  );

  const auditTab = (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Audit Log</h3>
      {auditLogs.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600 dark:text-gray-400">No audit logs available</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Timestamp</th>
                  <th className="text-left p-3 font-medium text-gray-900 dark:text-white">Action</th>
                  <th className="text-left p-3 font-medium text-gray-900 dark:text-white">User</th>
                  <th className="text-left p-3 font-medium text-gray-900 dark:text-white">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="p-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </td>
                    <td className="p-3 font-mono text-xs">{log.action}</td>
                    <td className="p-3 text-xs">{log.user_id || 'System'}</td>
                    <td className="p-3 text-xs text-gray-600 dark:text-gray-400">{log.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/data-sources')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Data Sources
        </Button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{dataSource.name}</h1>
            <Badge variant="info">{dataSource.type}</Badge>
            <Badge variant={getStatusBadgeVariant(dataSource.status)}>{dataSource.status}</Badge>
            {dataSource.drift_status === 'detected' && (
              <Badge variant="warning">Schema Drift</Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={handleTestConnection}>
              <PlayCircle className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
            <Button variant="secondary" onClick={handleRunDiscovery}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Discovery
            </Button>
            <Button variant="secondary" onClick={handleToggleStatus}>
              {dataSource.status === 'disabled' ? (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  Enable
                </>
              ) : (
                <>
                  <PowerOff className="h-4 w-4 mr-2" />
                  Disable
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview', content: overviewTab, icon: <TrendingUp className="h-4 w-4" /> },
          { id: 'connection', label: 'Connection', content: connectionTab, icon: <Activity className="h-4 w-4" /> },
          { id: 'schema', label: 'Schema / Data Model', content: schemaTab, icon: <Database className="h-4 w-4" /> },
          { id: 'pipeline', label: 'Mapping & Pipeline', content: pipelineTab, icon: <Route className="h-4 w-4" /> },
          { id: 'events', label: 'Sample Events', content: sampleEventsTab, icon: <FileJson className="h-4 w-4" /> },
          { id: 'routing', label: 'Routing', content: routingTab, icon: <Route className="h-4 w-4" /> },
          { id: 'audit', label: 'Audit', content: auditTab, icon: <FileText className="h-4 w-4" /> }
        ]}
      />

      <Drawer
        isOpen={isEventDrawerOpen}
        onClose={() => setIsEventDrawerOpen(false)}
        title="Event Details"
      >
        {selectedEvent && (
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Raw Payload</h4>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
                {JSON.stringify(selectedEvent.raw, null, 2)}
              </pre>
            </div>
            {selectedEvent.parsed && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Parsed Data</h4>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs">
                  {JSON.stringify(selectedEvent.parsed, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
