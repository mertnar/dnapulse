import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Sparkline } from '../components/ui/Sparkline';
import { EventDrawer } from '../components/dashboard/EventDrawer';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Bot,
  AlertTriangle,
  Clock,
  HardDrive,
  Play,
  Pause,
  Filter,
  CheckCircle,
  Eye,
  FileSearch,
  Brain,
  Archive
} from 'lucide-react';
import { formatDistanceToNow, isValid } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { dashboardService } from '../services/dashboardService';
import { liveMonitorService } from '../services/liveMonitorService';
import { alertsService } from '../services/alertsService';
import type { Event, Alert } from '../types';

// Helper function to safely format dates
const safeFormatDistance = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  if (!isValid(date)) return 'Invalid date';
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    return 'Unknown';
  }
};

type UserRole = 'admin' | 'analyst' | 'viewer';

interface KPICardData {
  id: string;
  label: string;
  value: string;
  change: number;
  trend: 'up' | 'down';
  sparklineData: number[];
  status: 'normal' | 'warning' | 'critical';
  navigateTo: string;
  tooltip?: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [userRole] = useState<UserRole>('admin');
  const [recentEvents, setRecentEvents] = useState<Event[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEventDrawerOpen, setIsEventDrawerOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const kpis: KPICardData[] = [
    {
      id: 'ingestion',
      label: 'Ingestion Rate',
      value: '5,560/s',
      change: 12.5,
      trend: 'up',
      sparklineData: [4200, 4500, 4800, 5100, 5300, 5400, 5560],
      status: 'normal',
      navigateTo: '/live-monitor',
      tooltip: 'Events per second'
    },
    {
      id: 'agents',
      label: 'Active Agents',
      value: '95',
      change: 2,
      trend: 'up',
      sparklineData: [88, 90, 91, 92, 93, 94, 95],
      status: 'normal',
      navigateTo: '/agents'
    },
    {
      id: 'alerts',
      label: 'Alerts (24h)',
      value: '23',
      change: -15,
      trend: 'down',
      sparklineData: [35, 32, 30, 28, 26, 24, 23],
      status: 'warning',
      navigateTo: '/alerts'
    },
    {
      id: 'latency',
      label: 'Data Latency',
      value: '145ms',
      change: -8,
      trend: 'down',
      sparklineData: [180, 170, 165, 160, 155, 150, 145],
      status: 'normal',
      navigateTo: '/data-sources',
      tooltip: 'Average ingestion latency'
    },
    {
      id: 'storage',
      label: 'Storage Usage',
      value: '68.4TB',
      change: 5,
      trend: 'up',
      sparklineData: [60, 62, 64, 65, 66, 67, 68.4],
      status: 'warning',
      navigateTo: '/storage'
    }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [eventsData, alertsData] = await Promise.all([
          liveMonitorService.getRecentEvents(15),
          alertsService.getAlerts()
        ]);
        setRecentEvents(eventsData);
        setRecentAlerts(alertsData.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    if (!isPaused) {
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [isPaused]);

  const handleKPIClick = (kpi: KPICardData) => {
    navigate(kpi.navigateTo);
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setIsEventDrawerOpen(true);
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    await alertsService.updateAlertStatus(alertId, 'acknowledged');
    const updatedAlerts = recentAlerts.map(a =>
      a.id === alertId ? { ...a, status: 'acknowledged' as const } : a
    );
    setRecentAlerts(updatedAlerts);
  };

  const handleResolveAlert = async (alertId: string) => {
    await alertsService.updateAlertStatus(alertId, 'resolved');
    const updatedAlerts = recentAlerts.map(a =>
      a.id === alertId ? { ...a, status: 'resolved' as const } : a
    );
    setRecentAlerts(updatedAlerts);
  };

  const handleStartInvestigation = (alertId: string) => {
    navigate('/investigations');
  };

  const handleCreateRule = (event: Event) => {
    navigate('/search');
  };

  const handleAddToInvestigation = (event: Event) => {
    navigate('/investigations');
  };

  const filteredEvents = severityFilter === 'all'
    ? recentEvents
    : recentEvents.filter(e => e.severity === severityFilter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'border-red-500';
      case 'warning': return 'border-yellow-500';
      default: return 'border-green-500';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-5 gap-6 mb-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Real-time intelligence and monitoring overview
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {kpis.map((kpi) => (
          <Card
            key={kpi.id}
            className={`cursor-pointer hover:shadow-lg transition-all border-l-4 ${getStatusColor(kpi.status)}`}
            onClick={() => handleKPIClick(kpi)}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    {kpi.label}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {kpi.value}
                  </p>
                </div>
                <div className={`flex items-center text-xs font-medium ${
                  kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {kpi.trend === 'up' ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span className="ml-1">{Math.abs(kpi.change)}%</span>
                </div>
              </div>

              <div className="h-10">
                <Sparkline data={kpi.sparklineData} color={kpi.status === 'critical' ? '#EF5350' : kpi.status === 'warning' ? '#FFA726' : '#4CAF7A'} height={40} />
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                vs last hour
              </p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Live Ingestion Stream
              </h2>
              <div className="flex items-center gap-3">
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 dark:bg-gray-800 dark:text-white"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isPaused
                      ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {isPaused ? 'Paused' : 'Live'}
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Badge variant={
                        event.severity === 'critical' ? 'danger' :
                        event.severity === 'high' ? 'warning' :
                        event.severity === 'medium' ? 'info' : 'neutral'
                      }>
                        {event.severity}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {event.event_type}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {event.source_id}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {safeFormatDistance(event.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {(userRole === 'admin' || userRole === 'analyst') && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Recent Alerts
              </h2>
              <div className="space-y-3">
                {recentAlerts.map((alert) => (
                  <div key={alert.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          alert.severity === 'critical' ? 'danger' :
                          alert.severity === 'high' ? 'warning' : 'info'
                        }>
                          {alert.severity}
                        </Badge>
                        <Badge variant={
                          alert.status === 'new' ? 'danger' :
                          alert.status === 'acknowledged' ? 'warning' :
                          alert.status === 'resolved' ? 'success' : 'neutral'
                        }>
                          {alert.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {safeFormatDistance(alert.created_at)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      {alert.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {alert.description}
                    </p>
                    {userRole !== 'viewer' && alert.status !== 'resolved' && (
                      <div className="flex gap-2">
                        {alert.status === 'new' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAcknowledgeAlert(alert.id)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleResolveAlert(alert.id)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleStartInvestigation(alert.id)}
                        >
                          <FileSearch className="h-3 w-3 mr-1" />
                          Investigate
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {(userRole === 'admin' || userRole === 'analyst') && (
            <>
              <Card>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <Bot className="h-4 w-4 mr-2" />
                  Top Alerting Agents
                </h3>
                <div className="space-y-2">
                  {[
                    { name: 'prod-api-01', count: 12 },
                    { name: 'db-monitor-03', count: 8 },
                    { name: 'auth-service', count: 5 }
                  ].map((agent, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{agent.name}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{agent.count}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Noisiest Rules
                </h3>
                <div className="space-y-2">
                  {[
                    { name: 'High Error Rate', count: 145 },
                    { name: 'API Latency', count: 89 },
                    { name: 'Memory Usage', count: 52 }
                  ].map((rule, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300 truncate">{rule.name}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{rule.count}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <Brain className="h-4 w-4 mr-2" />
                  ML Signals (24h)
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Anomalies</span>
                      <span className="font-bold text-gray-900 dark:text-white">23</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-primary-600 h-2 rounded-full" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Risk Score</span>
                      <span className="font-bold text-orange-600">Medium</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-orange-500 h-2 rounded-full" style={{ width: '65%' }}></div>
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}

          {userRole === 'admin' && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                <Archive className="h-4 w-4 mr-2" />
                Upcoming Archives
              </h3>
              <div className="space-y-2">
                {[
                  { name: 'Dec 2025 Logs', size: '2.4TB', days: 3 },
                  { name: 'Nov 2025 Events', size: '1.8TB', days: 5 }
                ].map((item, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{item.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{item.size}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Moving to cold storage in {item.days} days
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <EventDrawer
        event={selectedEvent}
        isOpen={isEventDrawerOpen}
        onClose={() => setIsEventDrawerOpen(false)}
        onCreateRule={handleCreateRule}
        onAddToInvestigation={handleAddToInvestigation}
      />
    </div>
  );
}
