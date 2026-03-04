#!/usr/bin/env node

/**
 * Setup script for data_model_pipelines collection
 * Creates the collection with proper schema and indexes
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGO_DB_NAME || 'dnapulse';

async function setupPipelinesCollection() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);

    // Create data_model_pipelines collection
    const collectionName = 'data_model_pipelines';
    const collections = await db.listCollections({ name: collectionName }).toArray();

    if (collections.length === 0) {
      await db.createCollection(collectionName, {
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: [
              'data_model_id',
              'organization_id',
              'version',
              'status',
              'pipeline',
              'elk_config',
              'created_at',
              'created_by',
            ],
            properties: {
              data_model_id: {
                bsonType: 'objectId',
                description: 'Reference to data_models._id',
              },
              organization_id: {
                bsonType: 'objectId',
                description: 'Organization ID',
              },
              version: {
                bsonType: 'int',
                minimum: 1,
                description: 'Pipeline version number',
              },
              status: {
                enum: ['draft', 'active', 'archived'],
                description: 'Pipeline status',
              },
              pipeline: {
                bsonType: 'object',
                required: ['steps'],
                properties: {
                  steps: {
                    bsonType: 'array',
                    items: {
                      bsonType: 'object',
                      required: ['id', 'type', 'operation'],
                      properties: {
                        id: { bsonType: 'string' },
                        type: { bsonType: 'string' },
                        operation: { bsonType: 'string' },
                        inputs: {
                          bsonType: 'array',
                          items: {
                            bsonType: 'object',
                            properties: {
                              attribute_id: { bsonType: 'objectId' },
                              path: { bsonType: 'string' },
                            },
                          },
                        },
                        params: { bsonType: 'object' },
                        outputs: {
                          bsonType: 'array',
                          items: {
                            bsonType: 'object',
                            properties: {
                              attribute_id: { bsonType: 'objectId' },
                              path: { bsonType: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              elk_config: {
                bsonType: 'object',
                required: ['index_name'],
                properties: {
                  index_name: { bsonType: 'string' },
                  mapping: { bsonType: 'object' },
                },
              },
              created_at: { bsonType: 'date' },
              updated_at: { bsonType: 'date' },
              created_by: { bsonType: 'string' },
              updated_by: { bsonType: 'string' },
              last_deployed_at: { bsonType: 'date' },
            },
          },
        },
      });
      console.log(`✓ Created collection: ${collectionName}`);
    } else {
      console.log(`✓ Collection already exists: ${collectionName}`);
    }

    const collection = db.collection(collectionName);

    // Create indexes
    const indexes = [
      {
        key: { data_model_id: 1, version: -1 },
        name: 'data_model_version_idx',
        unique: false,
      },
      {
        key: { organization_id: 1, status: 1 },
        name: 'org_status_idx',
        unique: false,
      },
      {
        key: { status: 1, last_deployed_at: 1 },
        name: 'deployment_tracking_idx',
        unique: false,
      },
      {
        key: { data_model_id: 1, status: 1 },
        name: 'model_active_pipeline_idx',
        unique: false,
      },
    ];

    for (const index of indexes) {
      try {
        await collection.createIndex(index.key, {
          name: index.name,
          unique: index.unique,
        });
        console.log(`✓ Created index: ${index.name}`);
      } catch (err) {
        if (err.code === 85 || err.code === 86) {
          console.log(`✓ Index already exists: ${index.name}`);
        } else {
          throw err;
        }
      }
    }

    console.log('\n✅ data_model_pipelines collection setup complete!');
    console.log('\nCollection Schema:');
    console.log('- data_model_id: ObjectId (ref to data_models)');
    console.log('- organization_id: ObjectId');
    console.log('- version: int (pipeline version)');
    console.log('- status: enum (draft, active, archived)');
    console.log('- pipeline: { steps: [...] }');
    console.log('- elk_config: { index_name, mapping }');
    console.log('- created_at, updated_at, created_by, updated_by');
    console.log('- last_deployed_at: Date (deployment timestamp)');
  } catch (error) {
    console.error('Error setting up pipelines collection:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupPipelinesCollection();
