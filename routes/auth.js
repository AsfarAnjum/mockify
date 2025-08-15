import express from 'express';
import { shopify } from '../shopify.js';
import { getDB } from '../db.js';

const router = express.Router();

// Start OAuth (top-level). Do NOT redirect manually; the SDK does it.
router.get('/install', async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send('Missing shop');

  await shopify.auth.begin({
    shop,
    callbackPath: '/auth/callback',
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
});

// Complete OAuth, persist token, bounce back to the app in Admin
router.get('/callback', async (req, res) => {
  try {
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const db = await getDB();
    await db.run(
      `INSERT OR REPLACE INTO shops (shop, access_token, scope, installed_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [session.shop, session.accessToken, session.scope]
    );

    // Redirect to embedded app entry in the unified admin
    const store = session.shop.replace('.myshopify.com', '');
    const redirectUrl = `https://admin.shopify.com/store/${store}/apps/${process.env.SHOPIFY_APP_HANDLE}`;
    return res.redirect(redirectUrl);
  } catch (e) {
    // If OAuth cookie was dropped, restart install at top-level
    const shop = req.query.shop || '';
    console.error('[auth/callback] error:', e?.message || e);
    if (shop) return res.redirect(`/auth/install?shop=${encodeURIComponent(shop)}`);
    return res.status(401).send('Auth failed');
  }
});

export default router;
