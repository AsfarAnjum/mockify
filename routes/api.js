import express from 'express';
import { shopify } from '../shopify.js';

const router = express.Router();

/**
 * ✅ Protect all API routes with App Bridge session token (JWT)
 *    shopify.auth.tokenValidation() will:
 *    - Verify Bearer token from Authorization header
 *    - Ensure it’s valid for the shop
 *    - Attach decoded session to res.locals.shopify
 */
router.use(shopify.auth.tokenValidation());

// Simple test endpoint
router.get('/ping', (req, res) => {
  res.json({
    ok: true,
    shop: res.locals.shopify?.session?.shop,
  });
});

// Example protected POST endpoint
// router.post('/products', async (req, res) => {
//   // Access token is in res.locals.shopify.session.accessToken if needed
//   res.json({ received: req.body });
// });

export default router;
