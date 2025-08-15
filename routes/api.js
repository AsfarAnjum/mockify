import express from 'express';
import { authenticateJWT } from '@shopify/shopify-api';
import { shopify } from '../shopify.js';

const router = express.Router();

// ✅ Middleware to validate App Bridge session token
router.use(async (req, res, next) => {
  try {
    const session = await authenticateJWT(req, shopify);
    res.locals.shopify = { session };
    next();
  } catch (error) {
    console.error('JWT validation failed:', error.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

// ✅ Protected API endpoint
router.get('/ping', (req, res) => {
  const { shop, id: sessionId } = res.locals.shopify.session;

  res.json({
    ok: true,
    shop,
    sessionId,
  });
});

export default router;