# Mockup Auto-Embedder – Shopify Public App (MVP, with Billing)

This app helps POD merchants attach/upload mockup images to products and optionally insert them in descriptions.

## Quick Start
1) npm i
2) cp .env.example .env  (fill values)
3) npm run dev
4) Install on a dev store via: /auth/install?shop=your-store.myshopify.com

## Billing (7-day free trial, USD $4.99/mo)
Uses Shopify App Subscription (GraphQL). If there’s no active subscription, the app shows a “Start free trial” button and redirects to Shopify’s confirmation URL.

## Scopes
- write_products
- write_files

## Dashboard URLs
- App URL: https://YOUR_HOST/
- Redirects: https://YOUR_HOST/auth/callback , https://YOUR_HOST/billing/confirm
