import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, closeDB } from './lib/mongodb.js';
import agentTypesRoutes from './routes/agentTypes.js';
import agentsRoutes from './routes/agents.js';
import agentInstancesRoutes from './routes/agentInstances.js';
import alertsRoutes from './routes/alerts.js';
import dataSourcesRoutes from './routes/dataSources.js';
import dataModelsRoutes from './routes/dataModels.js';
import detectionRoutes from './routes/detection.js';
import investigationsRoutes from './routes/investigations.js';
import liveMonitorRoutes from './routes/liveMonitor.js';
import detectionInvestigationRoutes from './routes/detectionInvestigation.js';
import mlModelsRoutes from './routes/mlModels.js';
import settingsRoutes from './routes/settings.js';
import storageRoutes from './routes/storage.js';
import searchRulesRoutes from './routes/searchRules.js';
import auditLogsRoutes from './routes/auditLogs.js';
import authorizationRoutes from './routes/authorization.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import downloadsRoutes from './routes/downloads.js';
import apiKeysRoutes from './routes/apiKeys.js';
import rulesRoutes from './routes/rules.js';

dotenv.config();

// Initialize MongoDB connection
async function initializeDatabase() {
  try {
    await connectDB();
    console.log('✓ MongoDB connected successfully');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error);
    console.warn('⚠ Server running without database connection - using mock data');
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'http://frontend:80',
  'http://localhost:80',
];

// ALLOWED_ORIGINS supports comma-separated list, e.g.:
//   ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
const extraOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = [...defaultOrigins, ...extraOrigins];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, same-origin proxy requests)
      // Also handle "null" string origin sent by some proxies (e.g. Cloudflare)
      if (!origin || origin === 'null') return callback(null, true);

      // In development mode allow everything
      if (process.env.NODE_ENV === 'development') return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/agent-types', agentTypesRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/agent-instances', agentInstancesRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/data-sources', dataSourcesRoutes);
app.use('/api/data-models', dataModelsRoutes);
app.use('/api/detection', detectionRoutes);
app.use('/api/investigations', investigationsRoutes);
app.use('/api/live-monitor', liveMonitorRoutes);
app.use('/api/detection-investigation', detectionInvestigationRoutes);
app.use('/api/ml-models', mlModelsRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/api-keys', apiKeysRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/search-rules', searchRulesRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/authorization', authorizationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Download routes (for agent binaries)
app.use('/downloads', downloadsRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
async function startServer() {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏳ Shutting down gracefully...');
  await closeDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏳ Shutting down gracefully...');
  await closeDB();
  process.exit(0);
});

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
