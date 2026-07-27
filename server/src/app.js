import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import authRoutes from './routes/auth.js';
import pickerRoutes from './routes/pickers.js';
import announcementRoutes from './routes/announcements.js';
import meRoutes from './routes/me.js';
import reportRoutes from './routes/reports.js';
import miscRoutes from './routes/misc.js';

/**
 * The Express application, with no server attached.
 *
 * `src/index.js` puts a listener on it for local development; `api/index.js`
 * at the repository root exports it straight to Vercel as a serverless
 * function. Keeping the two apart is what lets the same code run in both.
 */
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/', (_req, res) =>
  res.json({
    name: 'Waste Picker Management System API',
    project: 'INSY 492 Senior Project - Wiclife Omondi Ongo, UEAB',
    status: 'running',
    health: '/api/health',
  })
);

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/pickers', pickerRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/me', meRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', miscRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Something went wrong' });
});

export default app;
