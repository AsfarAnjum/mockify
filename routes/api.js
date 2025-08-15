import express from 'express';
import { validateAuthenticatedSession } from '@shopify/shopify-api';
import { shopify } from '../shopify.js';

const router = express.Router();

// ✅ Middleware: validate session from App Bridge (returns session, does not redirect)
router.use(async (req, res, next) => {
  try {
    const session = await validateAuthenticatedSession(shopify)(req, res, true);
    res.locals.shopify = { session };
    next();
  } catch (error) {
    console.error('JWT validation failed:', error.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

// ✅ Example protected route
router.get('/ping', (req, res) => {
  const { shop, id: sessionId } = res.locals.shopify.session;

  res.json({
    ok: true,
    shop,
    sessionId,
  });
});

export default router;