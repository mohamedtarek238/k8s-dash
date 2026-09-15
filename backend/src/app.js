require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const apiRoutes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { clusterMiddleware } = require('./middleware/clusterMiddleware');
const { initializeClusterRegistry, getCurrentContext, listClusters } = require('./config/kubernetes');

function createApp() {
  initializeClusterRegistry();

  const clusters = listClusters();
  console.log(`[App] Loaded ${clusters.length} cluster(s): ${clusters.map((c) => c.id).join(', ')}`);

  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        name: 'Kubernetes Dashboard Backend',
        version: '1.0.0',
        context: getCurrentContext(),
        clusters: listClusters().length,
      },
    });
  });

  // Mount cluster middleware on all /api routes — resolves req.k8sClients
  app.use('/api', clusterMiddleware, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
