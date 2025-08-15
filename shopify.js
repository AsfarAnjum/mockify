import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  hostName: process.env.HOST.replace(/^https?:\/\//, ''),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});