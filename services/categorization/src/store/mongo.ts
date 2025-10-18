import { MongoClient, Db, Collection } from 'mongodb';
import { Item, Label, ItemLabel, AppliedLabel } from '../model';
import { Logger } from 'pino';

export interface MongoStoreOptions {
  uri: string;
  database: string;
  logger: Logger;
}

export class MongoStore {
  private client: MongoClient;
  private db!: Db;
  private logger: Logger;
  private database: string;

  constructor(options: MongoStoreOptions) {
    this.client = new MongoClient(options.uri);
    this.database = options.database;
    this.logger = options.logger;
  }

  getClient(): MongoClient {
    return this.client;
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db(this.database);

      // Create indexes
      await this.createIndexes();

      this.logger.info('Connected to MongoDB', { database: this.database });
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    this.logger.info('Disconnected from MongoDB');
  }

  private async createIndexes(): Promise<void> {
    const labelsCollection = this.getLabelsCollection();
    const itemLabelsCollection = this.getItemLabelsCollection();

    // Labels indexes
    await labelsCollection.createIndex({ kind: 1, name: 1 }, { unique: true });
    await labelsCollection.createIndex({ active: 1 });

    // Item labels indexes
    await itemLabelsCollection.createIndex({ item_id: 1, kind: 1 });
    await itemLabelsCollection.createIndex({ label_id: 1 });
    await itemLabelsCollection.createIndex({ ts: 1 });
    await itemLabelsCollection.createIndex({ item_id: 1, label_id: 1 }, { unique: true });
  }

  getLabelsCollection(): Collection<Label> {
    return this.db.collection<Label>('labels');
  }

  getItemLabelsCollection(): Collection<ItemLabel> {
    return this.db.collection<ItemLabel>('item_labels');
  }

  getItemsCollection(): Collection<Item> {
    return this.db.collection<Item>('items');
  }

  async upsertLabel(label: Omit<Label, 'created_at' | 'updated_at'>): Promise<Label> {
    const now = new Date().toISOString();
    const fullLabel: Label = {
      ...label,
      created_at: now,
      updated_at: now,
    };

    const result = await this.getLabelsCollection().replaceOne({ id: label.id }, fullLabel, {
      upsert: true,
    });

    this.logger.debug('Label upserted', {
      labelId: label.id,
      upserted: result.upsertedCount > 0,
      modified: result.modifiedCount > 0,
    });

    return fullLabel;
  }

  async getLabels(kind?: string, active?: boolean): Promise<Label[]> {
    const filter: any = {};
    if (kind) filter.kind = kind;
    if (active !== undefined) filter.active = active;

    return await this.getLabelsCollection().find(filter).toArray();
  }

  async getLabelById(id: string): Promise<Label | null> {
    return await this.getLabelsCollection().findOne({ id });
  }

  async assignLabels(itemId: string, labels: AppliedLabel[]): Promise<ItemLabel[]> {
    const now = new Date().toISOString();
    const itemLabels: ItemLabel[] = [];

    for (const label of labels) {
      // Find or create label
      let labelDoc = await this.getLabelById(label.name);
      if (!labelDoc) {
        labelDoc = await this.upsertLabel({
          id: label.name,
          kind: label.kind,
          name: label.name,
          active: true,
        });
      }

      const itemLabel: ItemLabel = {
        item_id: itemId,
        label_id: labelDoc.id,
        kind: label.kind,
        ...(label.score !== undefined && { score: label.score }),
        ts: now,
        created_at: now,
      };

      // Upsert item label
      await this.getItemLabelsCollection().replaceOne(
        { item_id: itemId, label_id: labelDoc.id },
        itemLabel,
        { upsert: true }
      );

      itemLabels.push(itemLabel);
    }

    this.logger.debug('Labels assigned', { itemId, labelCount: labels.length });
    return itemLabels;
  }

  async getItemLabels(itemId: string): Promise<ItemLabel[]> {
    return await this.getItemLabelsCollection()
      .find({ item_id: itemId })
      .sort({ ts: -1 })
      .toArray();
  }

  async getItemsByLabel(labelId: string, limit = 100): Promise<ItemLabel[]> {
    return await this.getItemLabelsCollection()
      .find({ label_id: labelId })
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();
  }

  async removeItemLabels(itemId: string, labelIds?: string[]): Promise<number> {
    const filter: any = { item_id: itemId };
    if (labelIds && labelIds.length > 0) {
      filter.label_id = { $in: labelIds };
    }

    const result = await this.getItemLabelsCollection().deleteMany(filter);
    this.logger.debug('Item labels removed', {
      itemId,
      labelIds,
      deletedCount: result.deletedCount,
    });
    return result.deletedCount;
  }
}
