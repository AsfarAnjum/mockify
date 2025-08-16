// shopify.js

// v11 needs a side-effect import to set the Node runtime adapter
import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import { MemorySessionStorage } from '@shopify/shopify-app-session-storage-memory';

// Parse scopes from env (comma-separated)
const scopes = (process.env.SCOPES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Prefer HOST_NAME; fallback to HOST; then Render's external URL
const rawHost =
  process.env.HOST_NAME ||
  process.env.HOST ||
  process.env.RENDER_EXTERNAL_URL ||
  '';

const hostName = rawHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
if (!hostName) {
  throw new Error(
    'Missing hostName. Set HOST_NAME=your-domain.com (or HOST / RENDER_EXTERNAL_URL) in env.'
  );
}

// Build once so we can log what we’re passing in
const config = {
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  hostName,
  apiVersion: LATEST_API_VERSION, // or '2024-07'
  isEmbeddedApp: true,
  sessionStorage: new MemorySessionStorage(),
  scopes,
  future: {
    unstable_managedPricingSupport: true, // <- REQUIRED for Managed Pricing
  },
};

export const shopify = shopifyApi(config);

// Helpful boot log so we can confirm flags are on in Render logs
console.log('[shopify] hostName:', hostName);
console.log('[shopify] scopes:', scopes.join(',') || '(none)');
console.log('[shopify] future.unstable_managedPricingSupport:', config.future?.unstable_managedPricingSupport === true);