import express from 'express';
import { shopify } from '../shopify.js';
import { getDB } from '../db.js';

const router = express.Router();

/**
 * Step 1: Top-level redirect helper — ensures cookies can be set in an embedded app.
 * Shopify requires the OAuth request to first hit a top-level page before `/auth/install`.
 */
router.get('/toplevel', (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send('Missing shop');

  // Render a simple HTML page that will break out of the iframe and redirect to /auth/install
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <script>
      window.top.location.href = '/auth/install?shop=${encodeURIComponent(shop)}';
    </script>
  `);
});

/**
 * Step 2: Start OAuth (must be top-level so the cookie survives).
 * If inside an iframe, bounce to /auth/toplevel first.
 */
router.get('/install', async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send('Missing shop');

  // If embedded, break out to top-level first
  const embedded = req.query.embedded === '1' || req.query.embedded === 'true';
  if (embedded) {
    return res.redirect(`/auth/toplevel?shop=${encodeURIComponent(shop)}`);
  }

  // Begin OAuth and set cookie
  await shopify.auth.begin({
    shop,
    callbackPath: '/auth/callback',
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
});

/**
 * Step 3: Complete OAuth, store token, redirect back to embedded app in Admin
 */
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

    // Redirect to embedded app in the Shopify admin
    const store = session.shop.replace('.myshopify.com', '');
    const redirectUrl = `https://admin.shopify.com/store/${store}/apps/${process.env.SHOPIFY_APP_HANDLE}`;
    return res.redirect(redirectUrl);
  } catch (e) {
    const shop = req.query.shop || '';
    console.error('[auth/callback] error:', e?.message || e);
    // If cookie missing or other error, restart flow
    if (shop) return res.redirect(`/auth/install?shop=${encodeURIComponent(shop)}`);
    return res.status(401).send('Auth failed');
  }
});

export default router;
