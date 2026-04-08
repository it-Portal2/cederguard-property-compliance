import { allRoutes } from './routes/index.js';
import { createContext } from './lib/context.js';

export const maxDuration = 60;

export default async function handler(req: any, res: any) {
  // --- CORS Setup ---
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'https://cedarguard.co.uk,https://www.cedarguard.co.uk').split(',').map(o => o.trim());
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0] || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // --- Context Creation ---
  const ctx = await createContext(req, res);
  if (!ctx) return; // Response is already handled by createContext (401/500)

  // --- Action Dispatching ---
  const action = req.query.action || req.body?.action;

  if (req.method === 'POST') {
    if (allRoutes[action]) {
      try {
        return await allRoutes[action](req, res, ctx);
      } catch (e: any) {
        console.error(`ERROR in API Action [${action}]:`, {
          message: e.message,
          stack: e.stack,
          query: req.query
        });
        return res.status(500).json({ 
          error: e.message || 'Internal error in action',
          action,
          timestamp: new Date().toISOString()
        });
      }
    }
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export { allRoutes };
