import express from 'express';
import { shopify } from '../shopify.js';

const router = express.Router();

// STEP 1: Begin OAuth
router.get('/install', async (req, res) => {
  const shop = (req.query.shop || '').toString();
  const host = (req.query.host || '').toString();

  if (!shop || !host) {
    return res.status(400).send('Missing shop or host param');
  }

  try {
    const redirectUrl = await shopify.auth.begin({
      shop,
      isOnline: false,
      callbackPath: '/auth/callback',
      rawRequest: req,
      rawResponse: res,
    });
    return res.redirect(redirectUrl);
  } catch (err) {
    // 👉 TEMP: show the reason in the response so you can see it in the browser
    console.error('[AUTH/INSTALL] error:', err);
    const msg = err?.message || 'unknown error';
    return res.status(500).send(`Failed to start OAuth: ${msg}`);
  }
});

// STEP 2: Complete OAuth
router.get('/callback', async (req, res) => {
  try {
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });
    const host = (req.query.host || '').toString();
    const shop = session?.shop;
    if (!shop || !host) return res.status(400).send('Missing shop or host on callback');
    return res.redirect(`/?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`);
  } catch (err) {
    console.error('[AUTH/CALLBACK] error:', err);
    return res.status(400).send('OAuth callback failed');
  }
});

export default router;