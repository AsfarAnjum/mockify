import { shopifyApi } from '@shopify/shopify-api';

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  hostName: process.env.HOST.replace(/^https?:\/\//, ''),
  apiVersion: '2024-07', // explicitly use a valid version string
  isEmbeddedApp: true,
});