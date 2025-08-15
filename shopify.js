// v11 needs a side-effect import to set the Node runtime adapter
import '@shopify/shopify-api/adapters/node';
import { shopifyApi } from '@shopify/shopify-api';

// Parse scopes from env (comma-separated)
const scopes = (process.env.SCOPES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  hostName: (process.env.HOST || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
  apiVersion: '2024-07', // explicit on v11
  isEmbeddedApp: true,
  scopes, // REQUIRED for OAuth
});