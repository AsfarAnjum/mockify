import express from 'express';
import { getDB } from '../db.js';

const router = express.Router();

async function getAccessToken(shop) {
  const db = await getDB();
  const row = await db.get('SELECT access_token FROM shops WHERE shop = ?', [shop]);
  if (!row) throw new Error('Shop not installed or token missing');
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
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.errors?.[0]?.message || res.statusText || 'GraphQL HTTP error';
    throw new Error(msg);
  }
  if (json?.errors?.length) {
    throw new Error(json.errors.map(e => e.message).join('; '));
  }
  return json.data;
}

function envBilling() {
  const host = process.env.HOST?.replace(/\/$/, '');
  return {
    name: process.env.BILLING_NAME || 'Mockup Auto-Embedder Pro',
    price: parseFloat(process.env.BILLING_PRICE || '4.99'),
    interval: process.env.BILLING_INTERVAL || 'EVERY_30_DAYS',
    trialDays: parseInt(process.env.BILLING_TRIAL_DAYS || '7', 10),
    test: String(process.env.BILLING_TEST || 'true') === 'true',
    returnUrlBase: host + (process.env.BILLING_RETURN_PATH || '/billing/confirm'),
  };
}

router.get('/ensure', async (req, res) => {
  try {
    const { shop } = req.query;
    if (!shop) return res.status(400).json({ error: 'Missing shop' });

    const token = await getAccessToken(shop);

    // 1) Check if already subscribed
    const checkQ = `query { appInstallation { activeSubscriptions { id name status } } }`;
    const check = await gql(shop, token, checkQ);
    const list = check?.appInstallation?.activeSubscriptions || [];
    const active = list.some(s => s.status === 'ACTIVE' || s.status === 'ACCEPTED');
    if (active) return res.json({ active: true });

    // 2) Create subscription (IMPORTANT: include ?shop= in returnUrl)
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
    console.error('[/billing/ensure] error:', e);
    res.status(500).json({ error: e.message || 'Billing failed' });
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
