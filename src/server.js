require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const db = require('./models');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler.middleware');
const logger = require('./utils/logger');
const cleanupService = require('./services/cleanupService');
const { startEmailProcessor } = require('./jobs/emailProcessor');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info('✅ Uploads directory created');
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Socket.IO for real-time features
io.on('connection', (socket) => {
  logger.info('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    logger.info('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    await db.sequelize.authenticate();
    logger.info('✅ Database connection established');

    // Start cleanup service for expired bookings and locked slots
    cleanupService.startCleanupJob();
    logger.info('🧹 Cleanup service started (expired bookings: every 5 minutes, overdue appointments: every hour)');

    // Start email processor
    startEmailProcessor();
    logger.info('📧 Email processor started');

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info('📊 Database connection ready');
      logger.info('⏱  Automatic cleanup enabled for expired bookings');
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`\n${signal} received, starting graceful shutdown...`);

  try {
    // Stop cleanup service
    cleanupService.stopCleanupJob();
    logger.info('🛑 Cleanup service stopped');

    // Close server
    server.close(() => {
      logger.info('🔌 Server closed');
    });

    // Close database connection
    await db.sequelize.close();
    logger.info('🔌 Database connection closed');

    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});

startServer();

module.exports = { app, server, io };