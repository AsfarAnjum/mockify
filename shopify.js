// shopify.js
import '@shopify/shopify-api/adapters/node';           // <-- REQUIRED adapter
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import dotenv from 'dotenv';
dotenv.config();

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES.split(','),
  hostName: process.env.HOST.replace(/^https?:\/\//, ''), // no protocol
  apiVersion: LATEST_API_VERSION,                         // stay on current stable
  isEmbeddedApp: true,
});
