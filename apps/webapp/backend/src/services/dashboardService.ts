import { ObjectId } from 'mongodb';
import { getCollection, Collections } from '../lib/mongodb.js';

interface DashboardStats {
  totalEvents: number;
  eventsToday: number;
  activeAlerts: number;
  alertsToday: number;
  activeAgents: number;
  activeDataSources: number;
  averageThroughput: number;
}

interface RecentEvent {
  id: string;
  source: string;
  type: string;
  severity: string;
  timestamp: string;
}

interface RecentAlert {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
}

const dashboardService = {
  async getStats(organizationId?: string): Promise<DashboardStats> {
    try {
      const filter = organizationId ? { organization_id: new ObjectId(organizationId) } : {};

      // Get events count
      const eventsCollection = await getCollection(Collections.EVENTS);
      const totalEvents = await eventsCollection.countDocuments(filter);

      // Get events today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const eventsToday = await eventsCollection.countDocuments({
        ...filter,
        created_at: { $gte: startOfDay },
      });

      // Get alerts count
      const alertsCollection = await getCollection(Collections.ALERTS);
      const activeAlerts = await alertsCollection.countDocuments({
        ...filter,
        status: { $in: ['new', 'acknowledged', 'investigating'] },
      });

      const alertsToday = await alertsCollection.countDocuments({
        ...filter,
        created_at: { $gte: startOfDay },
      });

      // Get agents count
      const agentsCollection = await getCollection(Collections.AGENTS);
      const activeAgents = await agentsCollection.countDocuments({
        ...filter,
        status: 'online',
      });

      // Get data sources count
      const dataSourcesCollection = await getCollection(Collections.DATA_SOURCES);
      const activeDataSources = await dataSourcesCollection.countDocuments({
        ...filter,
        status: 'active',
      });

      // Calculate average throughput
      const dataSources = await dataSourcesCollection.find(filter).toArray();
      const averageThroughput =
        dataSources.length > 0
          ? dataSources.reduce((sum, ds) => sum + (ds.throughput || 0), 0) / dataSources.length
          : 0;

      return {
        totalEvents,
        eventsToday,
        activeAlerts,
        alertsToday,
        activeAgents,
        activeDataSources,
        averageThroughput: Math.round(averageThroughput),
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return {
        totalEvents: 0,
        eventsToday: 0,
        activeAlerts: 0,
        alertsToday: 0,
        activeAgents: 0,
        activeDataSources: 0,
        averageThroughput: 0,
      };
    }
  },

  async getRecentEvents(organizationId?: string, limit: number = 10): Promise<RecentEvent[]> {
    try {
      const filter = organizationId ? { organization_id: new ObjectId(organizationId) } : {};
      const collection = await getCollection(Collections.EVENTS);

      const events = await collection.find(filter).sort({ ingested_at: -1 }).limit(limit).toArray();

      return events.map((event) => ({
        id: event._id.toString(),
        source: event.source || 'unknown',
        type: event.type || 'unknown',
        severity: event.severity || event.payload?.severity || 'info',
        timestamp:
          event.ingested_at?.toISOString() ||
          event.created_at?.toISOString() ||
          new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error fetching recent events:', error);
      return [];
    }
  },

  async getRecentAlerts(organizationId?: string, limit: number = 5): Promise<RecentAlert[]> {
    try {
      const filter = organizationId ? { organization_id: new ObjectId(organizationId) } : {};
      const collection = await getCollection(Collections.ALERTS);

      const alerts = await collection.find(filter).sort({ created_at: -1 }).limit(limit).toArray();

      return alerts.map((alert) => ({
        id: alert._id.toString(),
        title: alert.title,
        severity: alert.severity,
        status: alert.status,
        created_at: alert.created_at?.toISOString() || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error fetching recent alerts:', error);
      return [];
    }
  },

  async getThroughputTrend(
    organizationId?: string,
    hours: number = 24
  ): Promise<Array<{ timestamp: string; value: number }>> {
    try {
      const filter = organizationId ? { organization_id: new ObjectId(organizationId) } : {};
      const collection = await getCollection(Collections.EVENTS);

      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      const pipeline = [
        {
          $match: {
            ...filter,
            created_at: { $gte: startTime },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%dT%H:00:00',
                date: '$created_at',
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ];

      const results = await collection.aggregate(pipeline).toArray();

      return results.map((r) => ({
        timestamp: r._id,
        value: r.count,
      }));
    } catch (error) {
      console.error('Error fetching throughput trend:', error);
      return [];
    }
  },
};

export { dashboardService };
export default dashboardService;
