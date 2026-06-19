import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { join } from 'path';
import { initDatabase } from './db.js';

import authRoutes from './routes/auth.js';
import assignmentRoutes from './routes/assignments.js';
import projectRoutes from './routes/projects.js';
import workloadRoutes from './routes/workload.js';
import commentRoutes from './routes/comments.js';
import doclibRoutes from './routes/doclib.js';
import processRoutes from './routes/processes.js';
import taskRoutes from './routes/tasks.js';
import subtaskRoutes from './routes/subtasks.js';
import worklogRoutes from './routes/worklogs.js';
import emergencyRoutes from './routes/emergency.js';
import brandRoutes from './routes/brand.js';
import settingsRoutes from './routes/settings.js';
import meetingRoutes from './routes/meetings.js';
import todoRoutes from './routes/todos.js';
import notificationRoutes from './routes/notifications.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors({
  origin: '*', // Allow all origins for local testing and Tauri integration
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Request logger middleware
// [H-4] 민감 필드(비밀번호 등)는 마스킹하여 로그에 남기지 않음
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    const safeBody = { ...req.body };
    const SENSITIVE_KEYS = ['password', 'newPassword', 'adminPassword', 'password_hash', 'pin'];
    SENSITIVE_KEYS.forEach(k => { if (safeBody[k] !== undefined) safeBody[k] = '***'; });
    console.log('  Body:', safeBody);
  }
  next();
});

// Initialize SQLite schemas and demo seed data
initDatabase().then(() => {
  console.log('SQLite local.db initialization checked.');
}).catch(err => {
  console.error('Database initialization failed:', err);
});

// Setup API routes
app.use('/auth', authRoutes);
app.use('/assignments', assignmentRoutes);
app.use('/projects', projectRoutes);
app.use('/workload', workloadRoutes);
app.use('/comments', commentRoutes);
app.use('/doclib', doclibRoutes);
app.use('/processes', processRoutes);
app.use('/tasks', taskRoutes);
app.use('/subtasks', subtaskRoutes);
app.use('/worklogs', worklogRoutes);
app.use('/emergency', emergencyRoutes);
app.use('/brand', brandRoutes);
app.use('/settings', settingsRoutes);
app.use('/meetings', meetingRoutes);
app.use('/todos', todoRoutes);
app.use('/notifications', notificationRoutes);

// Static files: uploaded documents (direct file serving)
app.use('/uploads', express.static(join(new URL('.', import.meta.url).pathname.slice(1), 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Start listening
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`Project Atlas Backend ERP running on port ${PORT}`);
  console.log(`===================================================`);
});
