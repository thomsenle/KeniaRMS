import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './db/index.js';
import { seedDatabase } from './db/seed.js';

import { inventoryRouter } from './modules/inventory/inventory.router.js';
import { recipesRouter } from './modules/recipes/recipes.router.js';
import { waitersRouter } from './modules/waiters/waiters.router.js';
import { posRouter } from './modules/pos/pos.router.js';
import { printerRouter } from './modules/printers/printer.router.js';
import { closingRouter } from './modules/closing/closing.router.js';
import { displayRouter } from './modules/display/display.router.js';
import { mpesaRouter } from './modules/mpesa/mpesa.router.js';
import { staffRouter } from './modules/staff/staff.router.js';

const app = express();
const server = http.createServer(app);

export const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded dish photos
const uploadsDir = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    system: 'KeniaRMS',
    country: 'Kenya',
    currency: 'KES',
    time: new Date().toISOString()
  });
});

// Module routes
app.use('/api/inventory', inventoryRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/waiters', waitersRouter);
app.use('/api/pos', posRouter);
app.use('/api/printers', printerRouter);
app.use('/api/closing', closingRouter);
app.use('/api/display', displayRouter);
app.use('/api/mpesa', mpesaRouter);
app.use('/api/staff', staffRouter);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Initialize DB & Seed
initDatabase();
seedDatabase();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 KeniaRMS Backend running on http://localhost:${PORT}`);
  console.log(`📍 Configured for Kenya (KES, 16% VAT, 2% Catering Levy)`);
  console.log(`📡 WebSocket ready for live POS & Display sync`);
  console.log(`=================================================`);
});
