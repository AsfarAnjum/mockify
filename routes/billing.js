import express from 'express';
import { getDB, clearShopSessions } from '../db.js';
import { shopify } from '../shopify.js';

const router = express.Router();

/**
 * Middleware to verify Shopify session token (JWT)
 */
async function verifySessionToken(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });

    const payload = await shopify.session.decodeSessionToken(token);

    res.locals.shopify = {
      shop: payload.dest.replace(/^https?:\/\//, ''),
      tokenPayload: payload,
    };
    return next();
  } catch (e) {
    console.error('[billing] token verify failed:', e?.message || e);
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

// Replace shopify.auth.tokenValidation() with our own middleware
router.get('/ensure', verifySessionToken, async (req, res) => {
  const shop = res.locals.shopify.shop;
  if (!shop) return res.status(400).json({ error: 'Missing shop' });

  try {
    const db = await getDB();
    const row = await db.get('SELECT access_token FROM shops WHERE shop = ?', [shop]);
    if (!row?.access_token) throw new Error('Shop not installed or token missing');

    const token = row.access_token;

    // 1) Check if already subscribed
    const checkQ = `query { appInstallation { activeSubscriptions { id name status } } }`;
    const client = new shopify.clients.Graphql({ shop, accessToken: token });
    const check = await client.query({ data: checkQ });

    const list = check?.body?.data?.appInstallation?.activeSubscriptions || [];
    const active = list.some(s => s.status === 'ACTIVE' || s.status === 'ACCEPTED');
    if (active) return res.json({ active: true });

    // 2) Create subscription
    const returnUrl = `${process.env.HOST}/billing/confirm?shop=${encodeURIComponent(shop)}`;
    const m = `
      mutation appSubscriptionCreate(
        $name: String!, $returnUrl: URL!, $test: Boolean!,
        $trialDays: Int, $lineItems: [AppSubscriptionLineItemInput!]!
      ) {
        appSubscriptionCreate(
          name: $name, returnUrl: $returnUrl, test: $test, trialDays: $trialDays, lineItems: $lineItems
        ) {
          userErrors { field message }
          confirmationUrl
          appSubscription { id status }
        }
      }`;

    const vars = {
      name: process.env.BILLING_NAME || 'Mockup Auto-Embedder Pro',
      returnUrl,
      test: String(process.env.BILLING_TEST || 'true') === 'true',
      trialDays: parseInt(process.env.BILLING_TRIAL_DAYS || '7', 10),
      lineItems: [{
        plan: { appRecurringPricingDetails: { price: { amount: parseFloat(process.env.BILLING_PRICE || '4.99'), currencyCode: 'USD' }, interval: process.env.BILLING_INTERVAL || 'EVERY_30_DAYS' } }
      }],
    };

    const resp = await client.query({ data: { query: m, variables: vars } });
    const confirmationUrl = resp?.body?.data?.appSubscriptionCreate?.confirmationUrl;

    return res.json({ active: false, confirmationUrl });
  } catch (e) {
    console.error('[/billing/ensure] error:', e);
    return res.status(500).json({ error: e.message || 'Billing failed' });
  }
});

router.get('/confirm', async (req, res) => {
  try {
    const { shop } = req.query;
    if (!shop) return res.status(400).send('Missing shop');
    const host = Buffer.from(`${shop}/admin`, 'utf-8').toString('base64');
    res.redirect(`/?shop=${shop}&host=${host}`);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

export default router;
