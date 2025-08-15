import express from 'express';
import { shopify } from '../shopify.js';

const router = express.Router();

/**
 * Middleware to verify Shopify session token (JWT) for authenticated requests
 * Works for Shopify API v11.14.1
 */
async function verifySessionToken(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    // Decode & verify the token locally (no API call needed)
    const payload = await shopify.session.decodeSessionToken(token);

    // Expose the shop domain & token payload to downstream handlers
    res.locals.shopify = {
      shop: payload.dest.replace(/^https?:\/\//, ''), // e.g., myshop.myshopify.com
      tokenPayload: payload,
    };

    return next();
  } catch (e) {
    console.error('[api] token verify failed:', e?.message || e);
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

// ✅ Protect all API routes with session token verification
router.use(verifySessionToken);

// Example API endpoint
router.get('/ping', (req, res) => {
  res.json({
    ok: true,
    shop: res.locals.shopify?.shop,
    payload: res.locals.shopify?.tokenPayload,
  });
});

// Example: Fetch shop info using the Admin API
router.get('/shop-info', async (req, res) => {
  try {
    const client = new shopify.clients.Rest({
      session: {
        shop: res.locals.shopify.shop,
        accessToken: res.locals.shopify.tokenPayload?.accessToken || '',
      },
    });

    const response = await client.get({ path: 'shop' });
    res.json(response.body);
  } catch (err) {
    console.error('[api] /shop-info error:', err);
    res.status(500).json({ error: 'Failed to fetch shop info' });
  }
});

export default router;
