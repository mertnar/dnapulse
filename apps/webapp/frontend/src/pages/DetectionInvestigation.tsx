import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { EventHistogram } from '../components/live-monitor/EventHistogram';
import { EventDetailDrawer } from '../components/live-monitor/EventDetailDrawer';
import { IndexSelector, type DataModelIndex } from '../components/live-monitor/IndexSelector';
import { SavedViewsPanel } from '../components/detection/SavedViewsPanel';
import { RulesPanel } from '../components/detection/RulesPanel';
import { RuleBuilderDrawer } from '../components/detection/RuleBuilderDrawer';
import { AlertsView } from '../components/detection/AlertsView';
import { InvestigationCanvas } from '../components/detection/InvestigationCanvas';
import {
  Search,
  Save,
  AlertCircle,
  FileSearch,
  Activity,
  Shield,
  BookMarked,
  Filter
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { liveMonitorService, type LiveEvent, type HistogramBucket } from '../services/liveMonitorService';
import { dataModelsService } from '../services/dataModelsService';
import {
  detectionService,
  type SavedView,
  type DetectionRule,
  type Alert,
  type Investigation,
  type AlertStatus,
  type InvestigationStatus
} from '../services/detectionService';
import type { EventSeverity } from '../types';

type WorkspaceView = 'events' | 'alerts' | 'investigation';

export function DetectionInvestigation() {
  const { user } = useAuth();
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('events');
  const [query, setQuery] = useState('');
  const [timeRange, setTimeRange] = useState<'15m' | '1h' | '24h' | '7d' | '1m' | 'custom'>('7d');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [indices, setIndices] = useState<DataModelIndex[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);

  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<LiveEvent[]>([]);
  const [histogram, setHistogram] = useState<HistogramBucket[]>([]);

  const [selectedView, setSelectedView] = useState<SavedView | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [activeInvestigation, setActiveInvestigation] = useState<Investigation | null>(null);

  const [isEventDrawerOpen, setIsEventDrawerOpen] = useState(false);
  const [isRuleBuilderOpen, setIsRuleBuilderOpen] = useState(false);
  const [isSaveViewModalOpen, setIsSaveViewModalOpen] = useState(false);
  const [ruleBuilderData, setRuleBuilderData] = useState<any>(null);

  const [selectedSeverities, setSelectedSeverities] = useState<Set<EventSeverity>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    fetchIndices();
  }, []);

  useEffect(() => {
    if (selectedIndex) {
      loadEvents();
    }
  }, [query, timeRange, selectedIndex]);

  useEffect(() => {
    filterEvents();
  }, [events, query, selectedSeverities, timeRange]);

  const fetchIndices = async () => {
    try {
      const activeIndices = await dataModelsService.getActiveIndices();
      setIndices(activeIndices);

      // Auto-select first index if available
      if (activeIndices.length > 0 && !selectedIndex) {
        setSelectedIndex(activeIndices[0].index_name);
      }
      if (activeIndices.length === 0) {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch indices:', error);
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [viewsData, rulesData, alertsData, investigationsData] = await Promise.all([
        detectionService.getSavedViews(),
        detectionService.getRules(),
        detectionService.getAlerts(),
        detectionService.getInvestigations(),
      ]);

      setSavedViews(viewsData);
      setRules(rulesData);
      setAlerts(alertsData);
      setInvestigations(investigationsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    if (!selectedIndex) {
      setEvents([]);
      setHistogram([]);
      return;
    }

    try {
      const range = getTimeRangeFilter();
      const minutesMap: Record<string, number> = {
        '15m': 15,
        '1h': 60,
        '24h': 1440,
        '7d': 10080,
        '1m': 43200,
      };
      const timeRangeMinutes = minutesMap[timeRange] || 60;

      const [eventsData, histogramData] = await Promise.all([
        liveMonitorService.searchEvents({
          index: selectedIndex,
          query: query || undefined,
          time_range: {
            from: range.start.toISOString(),
            to: range.end.toISOString(),
          },
          limit: 100,
        }),
        liveMonitorService.getHistogram(timeRangeMinutes, selectedIndex)
      ]);

      setEvents(eventsData.events || []);
      setHistogram(histogramData);
    } catch (error) {
      console.error('Failed to load events:', error);
      setEvents([]);
    }
  };

  const parseEventTimestamp = (event: LiveEvent): Date => {
    // Try payload.@ts first
    if (event.payload?.['@ts']) {
      const ts = new Date(event.payload['@ts']);
      if (!isNaN(ts.getTime())) return ts;
    }

    // Fallback to timestamp field
    if (event.timestamp) {
      const ts = new Date(event.timestamp);
      if (!isNaN(ts.getTime())) return ts;
    }

    // Fallback to created_at
    if (event.created_at) {
      const ts = new Date(event.created_at);
      if (!isNaN(ts.getTime())) return ts;
    }

    // Last resort: current time
    return new Date();
  };

  const filterEvents = () => {
    let filtered = [...events];

    // Note: Time range filtering is done on backend via loadEvents()
    // Here we only do client-side filtering for severity

    if (selectedSeverities.size > 0) {
      filtered = filtered.filter(e => {
        const severity = e.payload?.severity || e.severity;
        return severity && selectedSeverities.has(severity as EventSeverity);
      });
    }

    // Query filtering is also done on backend, but we can do additional client-side filtering
    if (query && !query.includes(':')) {
      // Simple text search (not KQL)
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(e => {
        const eventAny = e as any;
        const searchable = [
          eventAny.event_type,
          eventAny.payload?.event_type,
          eventAny.severity,
          eventAny.payload?.severity,
          eventAny.host,
          eventAny.payload?.host,
          eventAny.payload?.hostname,
          eventAny.user,
          eventAny.payload?.user,
          eventAny.service,
          eventAny.payload?.service,
          eventAny.source_id,
          eventAny.source,
          eventAny.payload?.message,
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(lowerQuery);
      });
    }

    setFilteredEvents(filtered);
  };

  const getTimeRangeFilter = () => {
    if (timeRange === 'custom' && customStartDate && customEndDate) {
      return {
        start: new Date(customStartDate),
        end: new Date(customEndDate)
      };
    }

    const now = new Date();
    let minutes = 60;

    switch (timeRange) {
      case '15m': minutes = 15; break;
      case '1h': minutes = 60; break;
      case '24h': minutes = 1440; break;
      case '7d': minutes = 10080; break;
      case '1m': minutes = 43200; break; // 30 days
    }

    return {
      start: new Date(now.getTime() - minutes * 60 * 1000),
      end: now
    };
  };

  const handleSelectView = (view: SavedView) => {
    setSelectedView(view);
    setQuery(view.query);
    setTimeRange(view.timeRange);
    setWorkspaceView('events');
  };

  const handleCreateRule = (view?: SavedView) => {
    setRuleBuilderData({
      query: view?.query || query,
      sourceViewId: view?.id
    });
    setIsRuleBuilderOpen(true);
  };

  const handleCreateRuleFromEvent = (event: LiveEvent) => {
    setRuleBuilderData({
      query: `event_type:${event.event_type}`,
      event
    });
    setIsRuleBuilderOpen(true);
    setIsEventDrawerOpen(false);
  };

  const handleSaveRule = async (rule: Partial<DetectionRule>) => {
    if (rule.id) {
      await detectionService.updateRule(rule.id, rule);
    } else {
      await detectionService.createRule(rule as any);
    }
    await loadData();
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    await detectionService.updateRule(ruleId, { enabled });
    await loadData();
  };

  const handleEditRule = (rule: DetectionRule) => {
    setRuleBuilderData({ existingRule: rule });
    setIsRuleBuilderOpen(true);
  };

  const handleDeleteRule = async (ruleId: string) => {
    await detectionService.deleteRule(ruleId);
    await loadData();
  };

  const handleDeleteView = async (viewId: string) => {
    await detectionService.deleteSavedView(viewId);
    await loadData();
  };

  const handleOpenSaveViewModal = () => {
    setIsSaveViewModalOpen(true);
  };

  const handleSaveViewSubmit = async (viewName: string) => {
    try {
      await detectionService.createSavedView({
        name: viewName,
        query,
        timeRange,
        columns: ['severity', 'event_type', 'host', 'user', 'timestamp'],
        filters: {}
      });
      await loadData();
      setIsSaveViewModalOpen(false);
    } catch (error: any) {
      console.error('Failed to save view', error);
      alert(error?.message || 'Failed to save view');
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    await detectionService.updateAlertStatus(alertId, 'acknowledged', 'current-user');
    await loadData();
  };

  const handleResolveAlert = async (alertId: string) => {
    await detectionService.updateAlertStatus(alertId, 'resolved');
    await loadData();
  };

  const handleStartInvestigation = async (alertId: string) => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;

    const investigation = await detectionService.createInvestigation({
      name: `Investigation: ${alert.ruleName}`,
      status: 'in_progress',
      severity: alert.severity,
      alertIds: [alertId],
      eventIds: alert.eventIds,
      notes: [],
      relatedHosts: [],
      relatedUsers: [],
      relatedIPs: [],
      assignedTo: 'current-user'
    });

    setActiveInvestigation(investigation);
    setWorkspaceView('investigation');
    await loadData();
  };

  const handleAddInvestigationNote = async (content: string) => {
    if (activeInvestigation) {
      await detectionService.addNoteToInvestigation(activeInvestigation.id, content, 'current-user');
      await loadData();
      const updated = investigations.find(i => i.id === activeInvestigation.id);
      if (updated) setActiveInvestigation(updated);
    }
  };

  const handleUpdateInvestigationStatus = async (status: InvestigationStatus) => {
    if (activeInvestigation) {
      await detectionService.updateInvestigation(activeInvestigation.id, { status });
      await loadData();
      const updated = investigations.find(i => i.id === activeInvestigation.id);
      if (updated) setActiveInvestigation(updated);
    }
  };

  const handleEventClick = (event: LiveEvent) => {
    setSelectedEvent(event);
    setIsEventDrawerOpen(true);
  };

  const toggleSeverity = (severity: EventSeverity) => {
    const newSelected = new Set(selectedSeverities);
    if (newSelected.has(severity)) {
      newSelected.delete(severity);
    } else {
      newSelected.add(severity);
    }
    setSelectedSeverities(newSelected);
  };

  const getSeverityBadgeVariant = (severity: EventSeverity) => {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'neutral';
    }
  };

  const getSeverityColor = (severity: EventSeverity) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="p-6 space-y-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Detection & Investigation</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Unified event search, rule management, alerts, and investigations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={handleOpenSaveViewModal}>
              <Save className="h-4 w-4 mr-2" />
              Save View
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleCreateRule()}>
              <Shield className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
            <Button
              variant={workspaceView === 'alerts' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setWorkspaceView('alerts')}
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              View Alerts
              {alerts.filter(a => a.status === 'triggered').length > 0 && (
                <Badge variant="danger" size="sm" className="ml-2">
                  {alerts.filter(a => a.status === 'triggered').length}
                </Badge>
              )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (investigations.length > 0) {
                  setActiveInvestigation(investigations[0]);
                  setWorkspaceView('investigation');
                }
              }}
            >
              <FileSearch className="h-4 w-4 mr-2" />
              Investigations
            </Button>
          </div>
        </div>

        {workspaceView === 'events' && (
          <>
            <Card>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="severity:critical AND source:agent-*"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Index:</span>
                    <IndexSelector
                      indices={indices}
                      selectedIndex={selectedIndex}
                      onSelectIndex={setSelectedIndex}
                      loading={loading}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Time range:</span>
                    <div className="flex gap-1">
                      {(['15m', '1h', '24h', '7d', '1m'] as const).map(range => (
                        <button
                          key={range}
                          onClick={() => setTimeRange(range)}
                          className={`px-3 py-1 text-sm rounded transition-colors ${
                            timeRange === range
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          {range}
                        </button>
                      ))}
                      <button
                        onClick={() => setTimeRange('custom')}
                        className={`px-3 py-1 text-sm rounded transition-colors ${
                          timeRange === 'custom'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                  </div>

                  {timeRange === 'custom' && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">From:</span>
                      <input
                        type="datetime-local"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="px-3 py-1 text-sm rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">To:</span>
                      <input
                        type="datetime-local"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="px-3 py-1 text-sm rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <EventHistogram data={histogram} />
          </>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BookMarked className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Saved Views</h3>
              </div>
              <SavedViewsPanel
                views={savedViews}
                onSelectView={handleSelectView}
                onCreateRule={handleCreateRule}
                onDelete={handleDeleteView}
                selectedViewId={selectedView?.id}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Detection Rules</h3>
              </div>
              <RulesPanel
                rules={rules}
                onToggleRule={handleToggleRule}
                onEditRule={handleEditRule}
                onDeleteRule={handleDeleteRule}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {workspaceView === 'events' && (
            <>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary-600" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Event Results
                    </h2>
                    <Badge variant="neutral">{filteredEvents.length} events</Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <div className="flex gap-2 flex-wrap">
                    {(['critical', 'high', 'medium', 'low', 'info'] as EventSeverity[]).map(severity => (
                      <button
                        key={severity}
                        onClick={() => toggleSeverity(severity)}
                        className={`px-2 py-1 text-xs rounded transition-all ${
                          selectedSeverities.has(severity)
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {severity}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4">
                {filteredEvents.length === 0 ? (
                  <EmptyState
                    icon={Activity}
                    title="No Events"
                    description="No events match your current filters"
                  />
                ) : (
                  <div className="space-y-2">
                    {filteredEvents.map((event) => {
                      const eventAny = event as any;
                      const severity = eventAny.payload?.severity || eventAny.severity || 'info';
                      const eventType = eventAny.payload?.event_type || eventAny.event_type || 'unknown';
                      const host = eventAny.payload?.host || eventAny.payload?.hostname || eventAny.host;
                      const user = eventAny.payload?.user || eventAny.user;
                      const service = eventAny.payload?.service || eventAny.service;
                      const sourceId = eventAny.source_id || eventAny.source || eventAny.agent_id;
                      const timestamp = parseEventTimestamp(event);

                      return (
                        <button
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className="w-full text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-1 h-full ${getSeverityColor(severity as EventSeverity)} rounded-full mt-1`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={getSeverityBadgeVariant(severity as EventSeverity)} size="sm">
                                  {severity}
                                </Badge>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {eventType}
                                </span>
                                {sourceId && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {sourceId}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                                {host && <span className="font-mono">{host}</span>}
                                {user && <span>{user}</span>}
                                {service && <span>{service}</span>}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDistanceToNow(timestamp, { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {workspaceView === 'alerts' && (
            <div className="flex-1 overflow-y-auto p-6">
              <AlertsView
                alerts={alerts}
                onAcknowledge={handleAcknowledgeAlert}
                onAssign={(alertId, user) => {}}
                onResolve={handleResolveAlert}
                onStartInvestigation={handleStartInvestigation}
                onViewDetails={setSelectedAlert}
              />
            </div>
          )}

          {workspaceView === 'investigation' && activeInvestigation && (
            <InvestigationCanvas
              investigation={activeInvestigation}
              onAddNote={handleAddInvestigationNote}
              onUpdateStatus={handleUpdateInvestigationStatus}
              onClose={() => setWorkspaceView('events')}
            />
          )}
        </div>
      </div>

      <EventDetailDrawer
        isOpen={isEventDrawerOpen}
        onClose={() => setIsEventDrawerOpen(false)}
        event={selectedEvent}
        onCreateRule={handleCreateRuleFromEvent}
        onAddToInvestigation={(event) => {}}
      />

      <RuleBuilderDrawer
        isOpen={isRuleBuilderOpen}
        onClose={() => setIsRuleBuilderOpen(false)}
        onSave={handleSaveRule}
        initialData={ruleBuilderData}
      />

      {isSaveViewModalOpen && (
        <SaveViewModal
          isOpen={isSaveViewModalOpen}
          onClose={() => setIsSaveViewModalOpen(false)}
          currentQuery={query}
          currentTimeRange={timeRange}
          onSave={handleSaveViewSubmit}
        />
      )}
    </div>
  );
}

function SaveViewModal({
  isOpen,
  onClose,
  currentQuery,
  currentTimeRange,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentQuery: string;
  currentTimeRange: string;
  onSave: (viewName: string) => void;
}) {
  const [viewName, setViewName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (viewName.trim()) {
      onSave(viewName.trim());
      setViewName('');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Save View">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            View Name
          </label>
          <Input
            type="text"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="e.g., Critical Events Last Hour"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Current Query
          </label>
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono">
            {currentQuery || '(no query)'}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Time Range
          </label>
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
            {currentTimeRange}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Save View
          </Button>
        </div>
      </form>
    </Modal>
  );
}
