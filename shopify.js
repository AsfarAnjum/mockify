// v11 needs a side-effect import to set the Node runtime adapter
import '@shopify/shopify-api/adapters/node';

import { shopifyApi } from '@shopify/shopify-api';

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  hostName: (process.env.HOST || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
  apiVersion: '2024-07', // keep explicit on v11
  isEmbeddedApp: true,
});