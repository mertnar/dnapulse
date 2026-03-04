import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { EventHistogram } from '../components/live-monitor/EventHistogram';
import { FieldsPanel } from '../components/live-monitor/FieldsPanel';
import { EventDetailDrawer } from '../components/live-monitor/EventDetailDrawer';
import { IndexSelector, type DataModelIndex } from '../components/live-monitor/IndexSelector';
import {
  Play,
  Pause,
  Save,
  AlertCircle,
  FileSearch,
  Activity,
  Search,
  Filter
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { liveMonitorService, type LiveEvent, type HistogramBucket, type FieldInfo, type FieldGroup } from '../services/liveMonitorService';
import { dataModelsService } from '../services/dataModelsService';
import type { EventSeverity } from '../types';

export function LiveMonitor() {
  const { user } = useAuth();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<LiveEvent[]>([]);
  const [histogram, setHistogram] = useState<HistogramBucket[]>([]);
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [indices, setIndices] = useState<DataModelIndex[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [timeRange, setTimeRange] = useState<'15m' | '1h' | '24h' | '7d' | '1m' | 'custom'>('7d');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<0 | 5 | 10 | 30>(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedSeverities, setSelectedSeverities] = useState<Set<EventSeverity>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Modal states
  const [isSaveViewModalOpen, setIsSaveViewModalOpen] = useState(false);
  const [isCreateRuleModalOpen, setIsCreateRuleModalOpen] = useState(false);
  const [isAddToInvestigationModalOpen, setIsAddToInvestigationModalOpen] = useState(false);

  useEffect(() => {
    fetchIndices();
  }, []);

  useEffect(() => {
    // Refetch when index, time range, or severity filters change
    if (selectedIndex) {
      fetchData();
    }
  }, [selectedIndex, timeRange, selectedSeverities, customStartDate, customEndDate]);

  useEffect(() => {
    // Fetch fields when index changes
    if (selectedIndex) {
      fetchFields();
    }
  }, [selectedIndex]);

  useEffect(() => {
    // Only filter on client-side for severity and source
    // Query filtering is done on backend via fetchData()
    filterEvents();
  }, [events, selectedSeverities, selectedSources]);

  useEffect(() => {
    if (autoRefresh > 0 && !isPaused) {
      intervalRef.current = setInterval(() => {
        addNewEvent();
      }, autoRefresh * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, isPaused]);

  const fetchIndices = async () => {
    try {
      const activeIndices = await dataModelsService.getActiveIndices();
      setIndices(activeIndices);

      // Auto-select first index if available
      if (activeIndices.length > 0 && !selectedIndex) {
        setSelectedIndex(activeIndices[0].index_name);
      }
      // If no indices, ensure we're not stuck in loading state
      if (activeIndices.length === 0) {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch indices:', error);
      setLoading(false);
    }
  };

  const fetchData = async () => {
    if (!selectedIndex) {
      setEvents([]);
      setHistogram([]);
      return;
    }

    try {
      setLoading(true);
      const params: any = {
        index: selectedIndex,
        limit: 100,
      };

      // Handle time range
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        params.time_range = {
          from: new Date(customStartDate).toISOString(),
          to: new Date(customEndDate).toISOString(),
        };
      } else {
        const presetMap: Record<string, string> = {
          '15m': '15m',
          '1h': '1h',
          '24h': '24h',
          '7d': '7d',
          '1m': '1m',
        };
        params.time_range = { preset: presetMap[timeRange] || '1h' };
      }

      // Add query parameter if present
      if (query && query.trim() !== '') {
        params.query = query.trim();
      }

      // Add severity filter if present
      if (selectedSeverities.size > 0) {
        params.severity = Array.from(selectedSeverities);
      }

      // Calculate time range in minutes for histogram
      let timeRangeMinutes = 60;
      if (timeRange === 'custom' && customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        timeRangeMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
      } else {
        const minutesMap: Record<string, number> = {
          '15m': 15,
          '1h': 60,
          '24h': 1440,
          '7d': 10080,
          '1m': 43200, // 30 days
        };
        timeRangeMinutes = minutesMap[timeRange] || 60;
      }

      const [searchResult, histogramData] = await Promise.all([
        liveMonitorService.searchEvents(params),
        liveMonitorService.getHistogram(timeRangeMinutes, selectedIndex)
      ]);
      setEvents(searchResult.events);
      setHistogram(histogramData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async () => {
    if (!selectedIndex) {
      setFields([]);
      return;
    }

    try {
      // Get fields from Elasticsearch index mappings
      const fieldGroups = await liveMonitorService.getFields(selectedIndex);
      const allFields = fieldGroups.flatMap(group => group.fields);
      setFields(allFields);
    } catch (error) {
      console.error('Failed to fetch fields:', error);
    }
  };

  // Discover all unique fields from current events
  const discoverFieldsFromEvents = (events: LiveEvent[]): FieldInfo[] => {
    const fieldMap = new Map<string, FieldInfo>();

    events.forEach((event) => {
      const eventAny = event as any;
      const payload = eventAny.payload || {};

      // Recursively extract all fields from payload
      const extractFields = (obj: any, prefix = '') => {
        Object.keys(obj).forEach((key) => {
          const fullPath = prefix ? `${prefix}.${key}` : key;
          const value = obj[key];

          if (value === null || value === undefined) return;

          // Skip arrays and complex nested objects for now (or handle differently)
          if (Array.isArray(value)) {
            // Mark as array type
            if (!fieldMap.has(fullPath)) {
              fieldMap.set(fullPath, {
                name: fullPath,
                type: 'string', // Arrays shown as string for simplicity
                category: categorizeField(fullPath),
                example: `[${value.length} items]`,
              });
            }
          } else if (typeof value === 'object') {
            // Recurse into nested objects
            extractFields(value, fullPath);
          } else {
            // Leaf field
            if (!fieldMap.has(fullPath)) {
              fieldMap.set(fullPath, {
                name: fullPath,
                type: inferType(value),
                category: categorizeField(fullPath),
                example: value,
              });
            }
          }
        });
      };

      extractFields(payload);
    });

    return Array.from(fieldMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  const inferType = (value: any): 'string' | 'number' | 'boolean' | 'date' => {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') {
      // Try to detect if it's a date
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'date';
    }
    return 'string';
  };

  const categorizeField = (fieldName: string): 'common' | 'network' | 'process' | 'file' | 'custom' => {
    const commonFields = ['@ts', 'timestamp', 'severity', 'event_type', 'message', 'host', 'user', 'service', 'hostname'];
    const networkFields = ['ip_address', 'port', 'protocol', 'network', 'src_ip', 'dest_ip', 'network_protocol'];
    const processFields = ['process', 'pid', 'process_name', 'command', 'command_line', 'top_processes'];
    const fileFields = ['file', 'file_path', 'file_name', 'path', 'filename'];

    if (commonFields.some(f => fieldName.includes(f))) return 'common';
    if (networkFields.some(f => fieldName.includes(f))) return 'network';
    if (processFields.some(f => fieldName.includes(f))) return 'process';
    if (fileFields.some(f => fieldName.includes(f))) return 'file';
    return 'custom';
  };

  // Load top values for a specific field
  const loadTopValuesForField = async (fieldName: string): Promise<{ value: string; count: number }[]> => {
    try {
      if (!selectedIndex) {
        return [];
      }

      const response = await liveMonitorService.getFacetValues(
        fieldName,
        selectedIndex,
        { preset: timeRange },
        query,
        5
      );

      return response;
    } catch (error) {
      console.error('Failed to load top values:', error);
      return [];
    }
  };

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const getTimeRangeMinutes = () => {
    switch (timeRange) {
      case '15m': return 15;
      case '1h': return 60;
      case '24h': return 1440;
      default: return 60;
    }
  };

  // Helper function to safely parse timestamp from event
  const parseEventTimestamp = (event: LiveEvent): Date => {
    // Try payload.@ts first
    if (event.payload?.['@ts']) {
      const ts = new Date(event.payload['@ts']);
      if (!isNaN(ts.getTime())) return ts;
    }

    // Fallback to created_at
    if (event.created_at) {
      const ts = new Date(event.created_at);
      if (!isNaN(ts.getTime())) return ts;
    }

    // Fallback to ingested_at
    if (event.ingested_at) {
      const ts = new Date(event.ingested_at);
      if (!isNaN(ts.getTime())) return ts;
    }

    // Last resort: current time
    return new Date();
  };

  const getTimeRangeFilter = () => {
    const now = new Date();
    const minutes = getTimeRangeMinutes();
    return {
      start: new Date(now.getTime() - minutes * 60 * 1000),
      end: now
    };
  };

  const filterEvents = () => {
    let filtered = [...events];

    // Note: Query and time range filtering is done on backend
    // Here we only do client-side filtering for severity and source

    // Severity filter (only if not already applied in backend)
    if (selectedSeverities.size > 0) {
      filtered = filtered.filter(e => {
        const severity = e.payload?.severity || e.severity;
        return severity && selectedSeverities.has(severity as EventSeverity);
      });
    }

    // Source filter
    if (selectedSources.size > 0) {
      filtered = filtered.filter(e => {
        const sourceId = e.source || e.agent_id || e.source_id;
        return sourceId && selectedSources.has(String(sourceId));
      });
    }

    setFilteredEvents(filtered);
  };

  const addNewEvent = async () => {
    if (!isPaused && selectedIndex) {
      try {
        const presetMap: Record<string, string> = {
          '15m': '15m', '1h': '1h', '24h': '24h', '7d': '7d', '1m': '1m',
        };
        const params: any = {
          index: selectedIndex,
          time_range: { preset: presetMap[timeRange] || '1h' },
          limit: 10,
        };

        const result = await liveMonitorService.searchEvents(params);
        if (result.events && result.events.length > 0) {
          // Merge new events with existing ones, avoiding duplicates
          setEvents(prev => {
            const existingIds = new Set(prev.map(e => e.id));
            const newEvents = result.events.filter((e: LiveEvent) => !existingIds.has(e.id));
            return [...newEvents, ...prev].slice(0, 500);
          });
        }
      } catch (error) {
        console.error('Failed to fetch new events:', error);
      }
    }
  };

  const handleEventClick = (event: LiveEvent) => {
    setSelectedEvent(event);
    setIsDrawerOpen(true);
  };

  const handleAddFilter = (fieldName: string, value: string) => {
    const filterString = liveMonitorService.addFilter(fieldName, value);
    setQuery(prev => prev ? `${prev} AND ${filterString}` : filterString);
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

  const handleCreateRule = (event: LiveEvent) => {
    alert(`Creating rule from event: ${event.id}`);
  };

  const handleAddToInvestigation = (event: LiveEvent) => {
    alert(`Adding event ${event.id} to investigation`);
  };

  const handleSaveView = async (viewName: string, description: string) => {
    try {
      const view = {
        name: viewName,
        description: description || undefined,
        query: query || '',
        time_preset: timeRange,
        selected_columns: [],
        pinned_filters: {
          severities: Array.from(selectedSeverities),
          sources: Array.from(selectedSources),
          index: selectedIndex || undefined,
        },
      };

      await liveMonitorService.createSavedView(view);
      alert(`View "${viewName}" saved successfully!`);
      setIsSaveViewModalOpen(false);
    } catch (error: any) {
      console.error('Failed to save view:', error);
      alert(`Failed to save view: ${error.message || 'Unknown error'}`);
    }
  };

  const handleCreateRuleFromQuery = async (ruleName: string, severity: string, threshold: number) => {
    try {
      const { detectionService } = await import('../services/detectionService');
      await detectionService.createRule({
        name: ruleName,
        query: query || '*',
        condition: { type: 'count', threshold, time_window_min: 15 },
        severity: severity as 'critical' | 'high' | 'medium' | 'low',
        tags: [],
        enabled: true,
      });
      alert('Rule created successfully!');
      setIsCreateRuleModalOpen(false);
    } catch (error: any) {
      console.error('Failed to create rule:', error);
      alert(error?.message || 'Failed to create rule');
    }
  };

  const handleAddEventsToInvestigation = async (investigationId: string) => {
    try {
      const { detectionService } = await import('../services/detectionService');
      const eventIds = filteredEvents.slice(0, 100).map((e) => e.id).filter(Boolean);
      if (eventIds.length === 0) {
        alert('No events to add. Adjust filters to include events.');
        return;
      }
      let targetId = investigationId;
      if (investigationId === 'new') {
        const inv = await detectionService.createInvestigation({
          title: 'Events from Live Monitor',
          status: 'open',
          severity: 'medium',
          alert_ids: [],
          event_refs: [],
          entities: { hosts: [], users: [], ips: [] },
          created_by: 'current-user',
        });
        targetId = inv.id!;
      }
      await detectionService.addEventsToInvestigation(targetId, eventIds);
      alert('Events added to investigation successfully!');
      setIsAddToInvestigationModalOpen(false);
    } catch (error: any) {
      console.error('Failed to add events to investigation', error);
      alert(error?.message || 'Failed to add events to investigation');
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Live Monitor</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Real-time event stream and exploration
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => setIsSaveViewModalOpen(true)}>
              <Save className="h-4 w-4 mr-2" />
              Save View
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setIsCreateRuleModalOpen(true)}>
              <AlertCircle className="h-4 w-4 mr-2" />
              Create Alert Rule
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setIsAddToInvestigationModalOpen(true)}>
              <FileSearch className="h-4 w-4 mr-2" />
              Add to Investigation
            </Button>
          </div>
        </div>

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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      fetchData();
                    }
                  }}
                  className="pl-10"
                />
              </div>
              <Button onClick={fetchData}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
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
                  <Button
                    size="sm"
                    onClick={fetchData}
                    disabled={!customStartDate || !customEndDate}
                  >
                    Apply
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Auto-refresh:</span>
                <div className="flex gap-1">
                  {([0, 5, 10, 30] as const).map(refresh => (
                    <button
                      key={refresh}
                      onClick={() => setAutoRefresh(refresh)}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        autoRefresh === refresh
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {refresh === 0 ? 'OFF' : `${refresh}s`}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant={isPaused ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setIsPaused(!isPaused)}
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {isPaused && (
          <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Event stream is paused. Click Resume to continue receiving events.
            </p>
          </div>
        )}

        <EventHistogram data={histogram} />
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Event Stream
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
                {filteredEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => handleEventClick(event)}
                    className="w-full text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-1 h-full ${getSeverityColor(event.payload?.severity || event.severity || 'info')} rounded-full mt-1`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getSeverityBadgeVariant((event.payload?.severity || event.severity || 'info') as EventSeverity)} size="sm">
                            {event.payload?.severity || event.severity || 'info'}
                          </Badge>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {event.payload?.event_type || event.event_type || 'unknown'}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {event.agent_id || event.source || event.source_id || 'unknown'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                          {event.payload?.host && (
                            <span className="font-mono">{event.payload.host}</span>
                          )}
                          {event.payload?.user && (
                            <span>{event.payload.user}</span>
                          )}
                          {event.payload?.service && (
                            <span>{event.payload.service}</span>
                          )}
                          {event.payload?.ip_address && (
                            <span className="font-mono">{event.payload.ip_address}</span>
                          )}
                        </div>
                        {event.payload?.message && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 truncate">
                            {event.payload.message}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(parseEventTimestamp(event), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-80 flex-shrink-0 overflow-y-auto">
          <FieldsPanel
            fields={fields}
            onAddFilter={handleAddFilter}
            onLoadTopValues={loadTopValuesForField}
          />
        </div>
      </div>

      <EventDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        event={selectedEvent}
        onCreateRule={handleCreateRule}
        onAddToInvestigation={handleAddToInvestigation}
      />

      {/* Save View Modal */}
      <SaveViewModal
        isOpen={isSaveViewModalOpen}
        onClose={() => setIsSaveViewModalOpen(false)}
        onSave={handleSaveView}
        currentQuery={query}
      />

      {/* Create Alert Rule Modal */}
      <CreateRuleModal
        isOpen={isCreateRuleModalOpen}
        onClose={() => setIsCreateRuleModalOpen(false)}
        onCreate={handleCreateRuleFromQuery}
        currentQuery={query}
      />

      {/* Add to Investigation Modal */}
      <AddToInvestigationModal
        isOpen={isAddToInvestigationModalOpen}
        onClose={() => setIsAddToInvestigationModalOpen(false)}
        onAdd={handleAddEventsToInvestigation}
        eventCount={filteredEvents.length}
      />
    </div>
  );
}

// Save View Modal Component
function SaveViewModal({ isOpen, onClose, onSave, currentQuery }: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  currentQuery: string;
}) {
  const [viewName, setViewName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (viewName.trim()) {
      onSave(viewName, description);
      setViewName('');
      setDescription('');
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
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this saved view..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            rows={3}
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

// Create Rule Modal Component
function CreateRuleModal({ isOpen, onClose, onCreate, currentQuery }: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, severity: string, threshold: number) => void;
  currentQuery: string;
}) {
  const [ruleName, setRuleName] = useState('');
  const [severity, setSeverity] = useState<'critical' | 'high' | 'medium' | 'low'>('high');
  const [threshold, setThreshold] = useState(10);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ruleName.trim()) {
      onCreate(ruleName, severity, threshold);
      setRuleName('');
      setSeverity('high');
      setThreshold(10);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Alert Rule">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Rule Name
          </label>
          <Input
            type="text"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="e.g., High CPU Usage Alert"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Query
          </label>
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono">
            {currentQuery || '(no query)'}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Severity
          </label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Threshold (event count)
          </label>
          <Input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value) || 10)}
            min={1}
            required
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Create Rule
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Add to Investigation Modal Component
function AddToInvestigationModal({ isOpen, onClose, onAdd, eventCount }: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (investigationId: string) => void;
  eventCount: number;
}) {
  const [investigationId, setInvestigationId] = useState('');
  const [createNew, setCreateNew] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createNew || investigationId.trim()) {
      onAdd(createNew ? 'new' : investigationId);
      setInvestigationId('');
      setCreateNew(true);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add to Investigation">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Add {eventCount} filtered event{eventCount !== 1 ? 's' : ''} to an investigation
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={createNew}
              onChange={() => setCreateNew(true)}
              className="text-primary-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Create new investigation
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!createNew}
              onChange={() => setCreateNew(false)}
              className="text-primary-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Add to existing investigation
            </span>
          </label>
        </div>
        {!createNew && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Investigation ID
            </label>
            <Input
              type="text"
              value={investigationId}
              onChange={(e) => setInvestigationId(e.target.value)}
              placeholder="Enter investigation ID"
              required
            />
          </div>
        )}
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Add to Investigation
          </Button>
        </div>
      </form>
    </Modal>
  );
}
