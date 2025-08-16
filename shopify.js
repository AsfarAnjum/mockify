// v11 needs a side-effect import to set the Node runtime adapter
import '@shopify/shopify-api/adapters/node';
import { shopifyApi } from '@shopify/shopify-api';
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

const hostName = rawHost
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');

if (!hostName) {
  throw new Error(
    'Missing hostName. Set HOST_NAME=your-domain.com (or HOST / RENDER_EXTERNAL_URL) in env.'
  );
}

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  hostName,
  apiVersion: '2024-07', // explicit on v11
  isEmbeddedApp: true,
  sessionStorage: new MemorySessionStorage(),
  scopes, // REQUIRED for OAuth
});