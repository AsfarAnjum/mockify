import express from 'express';
import { shopify } from '../shopify.js';

const router = express.Router();

/** Middleware: verify Shopify session token (JWT) */
async function verifySessionToken(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });

    // ✅ Decode/verify token (no network call)
    const payload = await shopify.session.decodeSessionToken(token);

    // Expose to handlers if needed
    res.locals.shopify = { tokenPayload: payload };
    return next();
  } catch (e) {
    console.error('[api] token verify failed:', e?.message || e);
    return res.status(401).json({ error: 'Invalid session token' });
  }
}

// Protect all API routes with session token
router.use(verifySessionToken);

// Simple test endpoint
router.get('/ping', (req, res) => {
  res.json({ ok: true, shop: res.locals.shopify?.tokenPayload?.dest });
});

// TODO: your existing endpoints below, e.g. products, uploads, etc.
// router.post('/your-endpoint', async (req, res) => { ... });

export default router;
