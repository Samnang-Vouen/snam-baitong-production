const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initScheduler } = require('./services/scheduler.service');

const healthRoutes = require('./routes/health.routes');
const sensorsRoutes = require('./routes/sensors.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const telegramRoutes = require('./routes/telegram.routes');
const plantsRoutes = require('./routes/plants.routes');
const qrRoutes = require('./routes/qr.routes');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const commentsRoutes = require('./routes/comments.routes');
const farmersRoutes = require('./routes/farmers.routes');
const uploadRoutes = require('./routes/upload.routes');
const soilHealthRoutes = require('./routes/soilHealth.routes');
const errorHandler = require('./middlewares/errorHandler');

function createApp() {
  const app = express();

  // So req.protocol/req.ip are correct behind Nginx/Load Balancer
  app.set('trust proxy', true);

  // Initialize scheduler only if explicitly enabled on the API process
  if (String(process.env.ENABLE_SCHEDULER_IN_API || 'false').toLowerCase() === 'true') {
    initScheduler();
  }

  // Middleware
  // Allow requests from frontend URL and same origin (since frontend is served from backend)
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    `http://${process.env.SERVER_IP}:${process.env.PORT || 3000}`,
    'http://localhost:3000',
    'http://localhost:5173'
  ].filter(Boolean);

  app.use(cors({
    origin: function(origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all origins for now - tighten in production if needed
      }
    },
    credentials: true
  }));
  app.use(cookieParser());
  app.use(express.json());

  // Routes
  app.use('/health', healthRoutes);
  app.use('/api/sensors', sensorsRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/telegram', telegramRoutes);
  app.use('/api/plants', plantsRoutes);
  app.use('/api/qr', qrRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/comments', commentsRoutes);
  app.use('/api/farmers', farmersRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/soil-health', soilHealthRoutes);

  // Serve frontend static files (after API routes)
  const frontendDistPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDistPath));

  // Handle client-side routing - send all non-API requests to index.html
  app.use((req, res, next) => {
    // If it's not an API request, serve the index.html
    if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    } else {
      next();
    }
  });

  // Error handling middleware
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
