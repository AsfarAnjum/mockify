import { jwtDecode } from 'jwt-decode';
import express from 'express';
import { withAuth } from '../utils/auth-guard.js';
import { getDB, clearShopSessions } from '../db.js';
import { shopify } from '../shopify.js';

const router = express.Router();

async function getAccessToken(shop) {
  const db = await getDB();
  const row = await db.get('SELECT access_token FROM shops WHERE shop = ?', [shop]);
  if (!row || !row.access_token) throw new Error('Shop not installed or token missing');
  return row.access_token;
}

async function gql(shop, token, query, variables = {}) {
  const res = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch {}

  if (!res.ok) {
    const msg = json?.errors?.[0]?.message || json?.error || res.statusText || 'GraphQL HTTP error';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (json?.errors?.length) {
    const err = new Error(json.errors.map(e => e.message).join('; '));
    err.status = res.status;
    throw err;
  }
  return json.data;
}

function envBilling() {
  const host = (process.env.HOST || '').replace(/\/$/, '');
  return {
    name: process.env.BILLING_NAME || 'Mockup Auto-Embedder Pro',
    price: parseFloat(process.env.BILLING_PRICE || '4.99'),
    interval: process.env.BILLING_INTERVAL || 'EVERY_30_DAYS',
    trialDays: parseInt(process.env.BILLING_TRIAL_DAYS || '7', 10),
    test: String(process.env.BILLING_TEST || 'true') === 'true',
    returnUrlBase: host + (process.env.BILLING_RETURN_PATH || '/billing/confirm'),
  };
}

async function handleUnauthorized(shop) {
  try { await clearShopSessions(shop); } catch {}
  try {
    const db = await getDB();
    await db.run('UPDATE shops SET access_token = NULL WHERE shop = ?', [shop]);
  } catch {}
}

/**
 * Protect this route with validateAuthenticatedSession
 * This ensures the shop is extracted from the embedded app session
 */
// middleware to decode JWT manually (compatible with v11)
router.use('/ensure', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer /, '').trim();
    if (!token) throw new Error('Missing token');

    const payload = jwtDecode(token);
    res.locals.shopify = { tokenPayload: payload };
    next();
  } catch (error) {
    console.error('JWT decode failed:', error.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

router.get('/ensure', async (req, res) => {
  const shop = res.locals.shopify?.tokenPayload?.dest?.replace(/^https:\/\//, '');
  if (!shop) return res.status(400).json({ error: 'Missing shop' });
  console.log(shop)
  try {
    const token = await getAccessToken(shop);

    const checkQ = `query { appInstallation { activeSubscriptions { id name status } } }`;
    const check = await gql(shop, token, checkQ);
    const list = check?.appInstallation?.activeSubscriptions || [];
    const active = list.some(s => s.status === 'ACTIVE' || s.status === 'ACCEPTED');
    if (active) return res.json({ active: true });

    const cfg = envBilling();
    const returnUrl = `${cfg.returnUrlBase}?shop=${encodeURIComponent(shop)}`;
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
      name: cfg.name,
      returnUrl,
      test: cfg.test,
      trialDays: cfg.trialDays,
      lineItems: [{
        plan: { appRecurringPricingDetails: { price: { amount: cfg.price, currencyCode: 'USD' }, interval: cfg.interval } }
      }],
    };
    const resp = await gql(shop, token, m, vars);
    const err = resp?.appSubscriptionCreate?.userErrors?.[0]?.message;
    if (err) throw new Error(err);

    const confirmationUrl = resp?.appSubscriptionCreate?.confirmationUrl;
    return res.json({ active: false, confirmationUrl });

  } catch (e) {
    console.log(e)
    const status = e?.status || e?.response?.status || e?.response?.code || e?.statusCode || e?.code;
    const msg = (e?.message || '').toLowerCase();

    if ((status === 401 || status === 403) ||
        msg.includes('invalid api key') ||
        (msg.includes('access token') && msg.includes('invalid')) ||
        msg.includes('not authorized')) {
      await handleUnauthorized(shop);
      return res.redirect(`/auth/install?shop=${encodeURIComponent(shop)}`);
    }

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
