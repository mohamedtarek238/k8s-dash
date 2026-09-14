require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const apiRoutes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { initializeKubernetesClients, getCurrentContext } = require('./config/kubernetes');

function createApp() {
  initializeKubernetesClients();

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
      },
    });
  });

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
