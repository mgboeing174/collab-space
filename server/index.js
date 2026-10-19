import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDatabase } from './db/database.js';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import documentRoutes from './routes/documents.js';
import whiteboardRoutes from './routes/whiteboards.js';
import activityRoutes from './routes/activity.js';
import searchRoutes from './routes/search.js';
import { setupSockets } from './sockets/socketHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
initDatabase();

const app = express();
const server = http.createServer(app);

// Configure CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:5000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl) or in allowed list
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Dev-friendly permissive CORS
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Setup Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 30000,
  pingInterval: 10000
});

setupSockets(io);

// Make io accessible in request if needed
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'CollabSpace API', timestamp: new Date().toISOString() });
});

// Mount Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/whiteboards', whiteboardRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/search', searchRoutes);

// Serve static frontend build if it exists
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      next();
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`>>> CollabSpace backend server running on http://localhost:${PORT}`);
});
