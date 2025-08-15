import express from 'express';
import { shopify } from '../shopify.js';

const router = express.Router();

/** Middleware: verify Shopify session token (JWT) manually for v11 */
async function verifySessionToken(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    // Decode + verify without a network request
    const payload = await shopify.session.decodeSessionToken(token);

    // Expose the payload to subsequent handlers
    res.locals.shopify = { tokenPayload: payload };
    return next();
  } catch (e) {
    console.error('[api] token verify failed:', e?.message || e);
    return res.status(401).json({ error: 'Invalid session token' });
  }
}

// Apply session-token verification to all API routes
router.use(verifySessionToken);

// Example test endpoint
router.get('/ping', (req, res) => {
  res.json({
    ok: true,
    shop: res.locals.shopify?.tokenPayload?.dest,
  });
});

// Your other endpoints go here
// router.post('/products', async (req, res) => { ... });

export default router;
