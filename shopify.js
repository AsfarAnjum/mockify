import { shopifyApi } from '@shopify/shopify-api';

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  hostName: process.env.HOST.replace(/^https?:\/\//, ''),
  apiVersion: '2024-07', // or LATEST_API_VERSION
  isEmbeddedApp: true,
});