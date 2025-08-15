import express from 'express';
import { shopify } from '../shopify.js';

const router = express.Router();

// Install route — starts OAuth and keeps host param
router.get('/install', async (req, res) => {
  const { shop, host } = req.query;
  if (!shop || !host) return res.status(400).send('Missing shop or host param');

  try {
    const authRoute = await shopify.auth.begin({
      shop,
      callbackPath: `/auth/callback?host=${encodeURIComponent(host)}`,
      isOnline: false,
    });
    res.redirect(authRoute);
  } catch (err) {
    console.error('Auth install error:', err);
    res.status(500).send('Failed to start OAuth');
  }
});

// Callback route — completes OAuth and sends back to app
router.get('/callback', async (req, res) => {
  try {
    await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { shop, host } = req.query;
    if (!shop || !host) return res.status(400).send('Missing shop or host param');

    res.redirect(`/?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send(err.message);
  }
});

export default router;
