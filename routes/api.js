import express from 'express';
import { shopify } from '../shopify.js';

const router = express.Router();

// Require valid session token for all API requests
router.use(shopify.auth.sessionToken());

router.get('/ping', (req, res) => {
  res.json({
    ok: true,
    shop: req.auth?.shop,
    user: req.auth?.user,
  });
});

export default router;
