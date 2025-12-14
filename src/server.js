require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');

const db = require('./models');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler.middleware');
const logger = require('./utils/logger');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5174",
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Start server without automatic database sync
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info('Database sync disabled - manage tables manually');
});

module.exports = { app, server, io };