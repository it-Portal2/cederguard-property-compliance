import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: '4.5mb' }));
app.use(express.urlencoded({ extended: true, limit: '4.5mb' }));

const PORT = process.env.PORT || 4000;

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'cedarguard-api', timestamp: new Date().toISOString() });
});

// API handler - dynamic import to handle ESM/TypeScript via tsx
let apiHandler = null;

async function loadHandler() {
  if (!apiHandler) {
    const mod = await import('./api/index.ts');
    apiHandler = mod.default;
  }
  return apiHandler;
}

// Proxy all /api requests to the Vercel-style handler
app.all('/api', async (req, res) => {
  try {
    const handler = await loadHandler();
    await handler(req, res);
  } catch (e) {
    console.error('API Error:', e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message || 'Internal server error' });
    }
  }
});

// Serve static files from the dist directory
app.use(express.static(join(__dirname, 'dist'), {
  maxAge: '1y',
  immutable: true,
  index: false
}));

// SPA fallback - serve index.html for all non-API, non-asset routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return;
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CedarGuard server running on port ${PORT}`);
});
