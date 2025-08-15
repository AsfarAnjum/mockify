import express from 'express';
import { shopify } from '../shopify.js';
import { getDB } from '../db.js';

const router = express.Router();

router.get('/install', async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send('Missing shop');

  // ❗️FIX: DO NOT redirect manually after shopify.auth.begin
  await shopify.auth.begin({
    shop,
    callbackPath: '/auth/callback',
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
});

router.get('/callback', async (req, res) => {
  const { session } = await shopify.auth.callback({
    rawRequest: req,
    rawResponse: res,
  });

  const db = await getDB();
  await db.run(
    `INSERT OR REPLACE INTO shops (shop, access_token, scope, installed_at) VALUES (?, ?, ?, datetime('now'))`,
    [session.shop, session.accessToken, session.scope]
  );

  const redirectUrl = `https://admin.shopify.com/store/${session.shop.replace('.myshopify.com', '')}/apps/${process.env.SHOPIFY_APP_HANDLE}`;
  return res.redirect(redirectUrl);
});

export default router;
