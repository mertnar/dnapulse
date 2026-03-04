#!/usr/bin/env node

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/dna-pulse';

const agentTypes = [
  {
    name: 'linux-resource-monitor',
    display_name: 'Linux Resource Monitor',
    description: 'Monitors CPU, memory, disk, and network resources on Linux systems',
    version: '1.0.0',
    icon: '🐧',
    category: 'system',
    binary_url: '/downloads/linux-resource-monitor-linux-amd64',
    install_script: '',
    default_config: {
      collection: {
        enabled: true,
        interval: '30s',
        sources: [
          {
            type: 'system_metrics',
            enabled: true,
          },
        ],
      },
    },
    config_version: 1,
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    name: 'syslog',
    display_name: 'Syslog Collector',
    description: 'Collects and forwards syslog messages from Linux systems',
    version: '1.0.0',
    icon: '📝',
    category: 'system',
    binary_url: '/downloads/syslog-linux-amd64',
    install_script: '',
    default_config: {
      collection: {
        enabled: true,
        interval: '10s',
        sources: [
          {
            type: 'file',
            enabled: true,
            path: '/var/log/syslog',
          },
        ],
      },
    },
    config_version: 1,
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  },
];

async function seedAgentTypes() {
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('dna-pulse');
    const agentTypesCollection = db.collection('agentTypes');
    const orgsCollection = db.collection('organizations');

    // Get or create default organization
    let org = await orgsCollection.findOne({});
    if (!org) {
      console.log('Creating default organization...');
      const result = await orgsCollection.insertOne({
        name: 'Default Organization',
        created_at: new Date(),
      });
      org = { _id: result.insertedId, name: 'Default Organization' };
      console.log('Created organization:', org._id);
    }

    console.log('Using organization:', org._id);

    // Seed agent types
    for (const agentType of agentTypes) {
      const existing = await agentTypesCollection.findOne({ name: agentType.name });

      if (existing) {
        console.log(`Agent type '${agentType.name}' already exists (ID: ${existing._id})`);
        continue;
      }

      const doc = {
        ...agentType,
        organization_id: org._id,
      };

      const result = await agentTypesCollection.insertOne(doc);
      console.log(`✓ Created agent type: ${agentType.name} (ID: ${result.insertedId})`);
    }

    console.log('\n✅ Agent types seeded successfully!');
  } catch (error) {
    console.error('Error seeding agent types:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seedAgentTypes();
