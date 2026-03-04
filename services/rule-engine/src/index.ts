import { MongoClient } from 'mongodb';
import { RuleEvaluator } from './evaluator.js';
import * as dotenv from 'dotenv';

dotenv.config();

// Get MongoDB URL and ensure username/password are properly encoded
let MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/dna-pulse';

// If MONGO_URL contains ${MONGO_PASSWORD}, replace it with encoded password
if (MONGO_URL.includes('${MONGO_PASSWORD}') && process.env.MONGO_PASSWORD) {
  const encodedPassword = encodeURIComponent(process.env.MONGO_PASSWORD);
  MONGO_URL = MONGO_URL.replace('${MONGO_PASSWORD}', encodedPassword);
}

// Always encode username and password in connection string to handle special characters
if (MONGO_URL.startsWith('mongodb+srv://') || MONGO_URL.startsWith('mongodb://')) {
  try {
    const urlPattern = /^(mongodb(\+srv)?:\/\/)([^@]+)@(.+)$/;
    const match = MONGO_URL.match(urlPattern);

    if (match) {
      const [, protocol, , credentials, rest] = match;
      const [username, password] = credentials.split(':');

      if (username && password) {
        const decodedUsername = decodeURIComponent(username);
        const decodedPassword = decodeURIComponent(password);
        const encodedUsername = encodeURIComponent(decodedUsername);
        const encodedPassword = encodeURIComponent(decodedPassword);
        MONGO_URL = `${protocol}${encodedUsername}:${encodedPassword}@${rest}`;
      }
    }
  } catch (e) {
    console.warn('URL encoding failed, using original URL');
  }
}

const DB_NAME = process.env.MONGO_DB_NAME || 'dna-pulse';
const SCHEDULE_INTERVAL_SEC = parseInt(process.env.SCHEDULE_INTERVAL_SEC || '60');

async function main() {
  console.log('🚀 DNA Pulse Rule Engine starting...');
  console.log(`📊 Schedule interval: ${SCHEDULE_INTERVAL_SEC}s`);

  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log(`✅ Connected to MongoDB: ${DB_NAME}`);

    const db = client.db(DB_NAME);
    const evaluator = new RuleEvaluator(db);

    // Run immediately on startup
    console.log('\n🔄 Running initial evaluation...');
    try {
      await evaluator.evaluateAllRules();
      console.log('✅ Initial evaluation completed\n');
    } catch (error) {
      console.error('❌ Initial evaluation failed:', error);
    }

    // Schedule periodic evaluations
    console.log(`⏰ Scheduling evaluations every ${SCHEDULE_INTERVAL_SEC}s...\n`);

    setInterval(async () => {
      const timestamp = new Date().toISOString();
      console.log(`\n⏰ [${timestamp}] Starting scheduled evaluation...`);

      try {
        await evaluator.evaluateAllRules();
        console.log(`✅ [${timestamp}] Evaluation completed\n`);
      } catch (error) {
        console.error(`❌ [${timestamp}] Evaluation error:`, error);
      }
    }, SCHEDULE_INTERVAL_SEC * 1000);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down gracefully...');
      await client.close();
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\n🛑 Shutting down gracefully...');
      await client.close();
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Failed to start rule engine:', error);
    process.exit(1);
  }
}

main();
