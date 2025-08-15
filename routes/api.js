import express from 'express';
import { shopify } from '../shopify.js';

const router = express.Router();

// ✅ Protect all API routes with Shopify's JWT/session validation
router.use(shopify.validateAuthenticatedSession());

// Test endpoint to confirm auth works
router.get('/ping', (req, res) => {
  res.json({
    ok: true,
    shop: res.locals.shopify.session.shop, // shop domain from validated session
  });
});

/**
 * Example: Fetch products from Shopify GraphQL API
 */
router.get('/products', async (req, res) => {
  try {
    const client = new shopify.clients.Graphql({
      session: res.locals.shopify.session,
    });

    const data = await client.query({
      data: `{
        products(first: 10) {
          edges {
            node {
              id
              title
            }
          }
        }
      }`,
    });

    res.json(data.body.data);
  } catch (e) {
    console.error('[api/products] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Add more API endpoints here, all automatically protected by Shopify auth
// router.post('/upload', async (req, res) => { ... });

export default router;
