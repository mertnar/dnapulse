import { MongoClient, Db, Collection } from 'mongodb';
import pino from 'pino';

export interface CategorizedItem {
  _id?: string;
  item_id: string;
  tenant_id: string;
  original_item: any;
  labels: any[];
  categorization_time: Date;
  duration_ms: number;
  status: string;
  error?: string;
  created_at: Date;
  updated_at: Date;
}

export class CategorizedItemsStore {
  private db: Db;
  private collection: Collection<CategorizedItem>;
  private logger: pino.Logger;

  constructor(
    private mongoClient: MongoClient,
    private databaseName: string,
    logger?: pino.Logger
  ) {
    this.logger = logger || pino({ level: 'info' });
    this.db = this.mongoClient.db(this.databaseName);
    this.collection = this.db.collection<CategorizedItem>('categorized_items');
  }

  async initialize(): Promise<void> {
    try {
      // Create indexes
      await this.collection.createIndex({ item_id: 1 }, { unique: true });
      await this.collection.createIndex({ tenant_id: 1 });
      await this.collection.createIndex({ categorization_time: -1 });
      await this.collection.createIndex({ status: 1 });

      this.logger.info('Categorized items store initialized');
    } catch (error) {
      this.logger.error('Failed to initialize categorized items store', { error });
      throw error;
    }
  }

  async storeCategorizedItem(item: CategorizedItem): Promise<void> {
    try {
      item.created_at = new Date();
      item.updated_at = new Date();

      await this.collection.insertOne(item);

      this.logger.debug('Categorized item stored', {
        item_id: item.item_id,
        label_count: item.labels.length,
      });
    } catch (error) {
      this.logger.error('Failed to store categorized item', {
        item_id: item.item_id,
        error,
      });
      throw error;
    }
  }

  async getCategorizedItem(itemId: string): Promise<CategorizedItem | null> {
    try {
      const item = await this.collection.findOne({ item_id: itemId });
      return item;
    } catch (error) {
      this.logger.error('Failed to get categorized item', { item_id: itemId, error });
      throw error;
    }
  }

  async getCategorizedItemsByTimeRange(
    start: Date,
    end: Date,
    limit: number = 100
  ): Promise<CategorizedItem[]> {
    try {
      const items = await this.collection
        .find({
          categorization_time: {
            $gte: start,
            $lte: end,
          },
        })
        .sort({ categorization_time: -1 })
        .limit(limit)
        .toArray();

      return items;
    } catch (error) {
      this.logger.error('Failed to get categorized items by time range', { error });
      throw error;
    }
  }

  async getStats(): Promise<{
    total_items: number;
    successful_items: number;
    failed_items: number;
    avg_duration: number;
  }> {
    try {
      const pipeline = [
        {
          $group: {
            _id: null,
            total_items: { $sum: 1 },
            successful_items: {
              $sum: {
                $cond: [{ $eq: ['$status', 'success'] }, 1, 0],
              },
            },
            failed_items: {
              $sum: {
                $cond: [{ $eq: ['$status', 'error'] }, 1, 0],
              },
            },
            avg_duration: { $avg: '$duration_ms' },
          },
        },
      ];

      const result = await this.collection.aggregate(pipeline).toArray();

      if (result.length === 0) {
        return {
          total_items: 0,
          successful_items: 0,
          failed_items: 0,
          avg_duration: 0,
        };
      }

      return {
        total_items: result[0]?.['total_items'] || 0,
        successful_items: result[0]?.['successful_items'] || 0,
        failed_items: result[0]?.['failed_items'] || 0,
        avg_duration: result[0]?.['avg_duration'] || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get categorization stats', { error });
      throw error;
    }
  }
}
