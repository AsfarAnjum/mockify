// routes/billing.js
import express from 'express';
import { shopify } from '../shopify.js';
import { clearShopSessions } from '../db.js';

const router = express.Router();

/* -------------------- Helpers -------------------- */

// Verify the App Bridge session token from the frontend and extract the shop
async function getShopFromAuthHeader(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new Error('Missing session token');

  // Verifies signature & expiry; returns payload with .dest = "https://<shop>.myshopify.com"
  const payload = await shopify.session.decodeSessionToken(token);
  const shop = (payload?.dest || '').replace(/^https?:\/\//, '');
  if (!shop) throw new Error('Unable to extract shop from token');
  return shop;
}

// Load the OFFLINE session/token stored by Shopify during OAuth
async function loadOfflineSession(shop) {
  const offlineId = shopify.session.getOfflineId(shop);
  const session = await shopify.sessionStorage.loadSession(offlineId);
  if (!session?.accessToken) throw new Error('No offline session/access token stored');
  return session;
}

// Run a GraphQL Admin query using Shopify client (server-side only)
async function adminGraphQL(session, query, variables = {}) {
  const client = new shopify.clients.Graphql({ session });
  const resp = await client.query({ data: { query, variables } });

  // Library throws on non-2xx. Still check for GraphQL-level errors.
  const errors = resp?.body?.errors || resp?.body?.data?.userErrors;
  if (Array.isArray(errors) && errors.length) {
    const msg = errors.map(e => e?.message || String(e)).join('; ');
    const err = new Error(msg || 'GraphQL error');
    err.status = 400;
    throw err;
  }
  return resp?.body?.data;
}

function envBilling() {
  // Prefer explicit APP_URL or HOST_NAME; fallback to HOST
  const rawHost = process.env.APP_URL || process.env.HOST_NAME || process.env.HOST || '';
  const base = rawHost ? rawHost.replace(/\/$/, '') : '';

  return {
    name: process.env.BILLING_NAME || 'Mockup Auto-Embedder Pro',
    price: parseFloat(process.env.BILLING_PRICE || '4.99'),
    interval: process.env.BILLING_INTERVAL || 'EVERY_30_DAYS', // or 'ANNUAL'
    trialDays: parseInt(process.env.BILLING_TRIAL_DAYS || '7', 10),
    test: String(process.env.BILLING_TEST || 'true') === 'true',
    returnUrlBase: base + (process.env.BILLING_RETURN_PATH || '/billing/confirm'),
  };
}

async function handleUnauthorized(shop) {
  try { await clearShopSessions(shop); } catch {}
  try { await shopify.sessionStorage.deleteSessions(shop); } catch {}
}

/* -------------------- Routes -------------------- */

// Validate billing / prompt if missing
router.get('/ensure', async (req, res) => {
  let shop = '';
  try {
    // 1) Identify shop from App Bridge session token (Authorization: Bearer <jwt>)
    shop = await getShopFromAuthHeader(req);

    // 2) Use OFFLINE session to call Admin
    const offlineSession = await loadOfflineSession(shop);

    // 3) Managed pricing path (optional via env)
    const useManaged = String(process.env.USE_MANAGED_PRICING || 'false') === 'true';
    if (useManaged) {
      // Requires future.unstable_managedPricingSupport = true in shopify.js
      const result = await shopify.billing.check({
        session: offlineSession,
        isTest: String(process.env.BILLING_TEST || 'true') === 'true',
        returnObject: true,
      });

      // result: { hasActivePayment, subscriptions, redirectUrl?, confirmationUrl? }
      if (result?.hasActivePayment) {
        return res.json({ active: true });
      }

      const target = result?.redirectUrl || result?.confirmationUrl || null;
      return res.json({ active: false, confirmationUrl: target });
    }
    // 3) Check current subscriptions
    const checkQ = /* GraphQL */ `
      query AppSubs {
        appInstallation {
          activeSubscriptions {
            id
            name
            status
          }
        }
      }
    `;
    const data = await adminGraphQL(offlineSession, checkQ);
    const list = data?.appInstallation?.activeSubscriptions || [];
    const active = list.some(s => s?.status === 'ACTIVE' || s?.status === 'ACCEPTED');
    if (active) return res.json({ active: true });

    // 4) Not active → create a subscription and return confirmationUrl
    const cfg = envBilling();
    const returnUrl = `${cfg.returnUrlBase}?shop=${encodeURIComponent(shop)}`;

    const createM = /* GraphQL */ `
      mutation CreateSub(
        $name: String!
        $returnUrl: URL!
        $test: Boolean!
        $trialDays: Int
        $lineItems: [AppSubscriptionLineItemInput!]!
      ) {
        appSubscriptionCreate(
          name: $name
          returnUrl: $returnUrl
          test: $test
          trialDays: $trialDays
          lineItems: $lineItems
        ) {
          userErrors { field message }
          confirmationUrl
          appSubscription { id status }
        }
      }
    `;

    const vars = {
      name: cfg.name,
      returnUrl,
      test: cfg.test,
      trialDays: cfg.trialDays,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: cfg.price, currencyCode: 'USD' },
              interval: cfg.interval, // 'EVERY_30_DAYS' or 'ANNUAL'
            },
          },
        },
      ],
    };

    const created = await adminGraphQL(offlineSession, createM, vars);
    const uerr = created?.appSubscriptionCreate?.userErrors?.[0]?.message;
    if (uerr) {
      const err = new Error(uerr);
      err.status = 400;
      throw err;
    }

    const confirmationUrl = created?.appSubscriptionCreate?.confirmationUrl;
    return res.json({ active: false, confirmationUrl });
  } catch (e) {
    const status =
      e?.status ||
      e?.response?.status ||
      e?.response?.code ||
      e?.statusCode ||
      undefined;

    const msg = (e?.message || '').toLowerCase();

    // Token/authorization issues → clear sessions and instruct the frontend to top-level reauth
    if (
      status === 401 || status === 403 ||
      msg.includes('invalid api key') ||
      (msg.includes('access token') && msg.includes('invalid')) ||
      msg.includes('not authorized') ||
      msg.includes('no offline session') ||
      msg.includes('missing session')
    ) {
      if (shop) await handleUnauthorized(shop);
      const url = `/auth/exit-iframe?shop=${encodeURIComponent(shop || req.query.shop || '')}`;
      return res.status(401).json({ error: 'unauthorized', redirect: url });
    }

    console.error('[/billing/ensure] error:', e);
    return res.status(500).json({ error: e?.message || 'Billing failed' });
  }
});

// After merchant confirms billing, bounce back into the embedded app
router.get('/confirm', async (req, res) => {
  try {
    const shop = (req.query.shop || '').toString();
    if (!shop) return res.status(400).send('Missing shop');
    const host = Buffer.from(`${shop}/admin`, 'utf-8').toString('base64');
    return res.redirect(302, `/?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`);
  } catch (e) {
    return res.status(500).send(e?.message || 'Confirm error');
  }
});

export default router;