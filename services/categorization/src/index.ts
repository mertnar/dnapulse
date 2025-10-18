#!/usr/bin/env node

import { CategorizationApp } from './app';

async function main() {
  const options = {
    port: parseInt(process.env['PORT'] || '8083'),
    host: process.env['HOST'] || '0.0.0.0',
    configUrl: process.env['CONFIG_URL'] || 'http://localhost:8084',
    configScope: process.env['CONFIG_SCOPE'] || 'categorization',
    mongoUri: process.env['MONGO_URI'] || 'mongodb://localhost:27017',
    mongoDatabase: process.env['MONGO_DATABASE'] || 'categorization',
    ...(process.env['ELASTICSEARCH_NODE'] && {
      elasticsearchNode: process.env['ELASTICSEARCH_NODE'],
    }),
    elasticsearchIndex: process.env['ELASTICSEARCH_INDEX'] || 'categorized-items',
    ...(process.env['KAFKA_BROKERS'] && { kafkaBrokers: process.env['KAFKA_BROKERS'].split(',') }),
    ...(process.env['JAEGER_ENDPOINT'] && { jaegerEndpoint: process.env['JAEGER_ENDPOINT'] }),
    ...(process.env['JWT_SECRET'] && { jwtSecret: process.env['JWT_SECRET'] }),
    bypassAuth: process.env['BYPASS_AUTH'] === 'true',
  };

  const app = new CategorizationApp(options);

  try {
    await app.start();
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
