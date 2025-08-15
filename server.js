import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import billingRoutes from './routes/billing.js';
import complianceRoutes from './routes/compliance.js';
import { getDB } from './db.js';

import { shopify } from './shopify.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ Required so cookies from Shopify OAuth survive Render's proxy
app.set('trust proxy', 1);

// ✅ Parse/sign cookies FIRST so OAuth nonce/state cookie can be set
app.use(
  cookieParser(process.env.SESSION_SECRET, {
    sameSite: 'none',
    secure: true,
    httpOnly: true,
  })
);

// ✅ Mount /auth BEFORE compression/CORS/body parsers to avoid header issues
app.use('/auth', authRoutes);

// Allow Shopify admin embedding
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    'frame-ancestors https://admin.shopify.com https://*.myshopify.com;'
  );
  res.removeHeader('X-Frame-Options');
  next();
});

// Remaining middlewares
app.use(cors({ credentials: true, origin: true }));
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Billing, webhook, and API routes
app.use('/billing', billingRoutes);
app.use('/webhooks/privacy', complianceRoutes);
app.use('/api', apiRoutes);

// Function to check if shop has access token
async function shopHasToken(shop) {
  if (!shop) return false;
  const db = await getDB();
  const row = await db.get('SELECT access_token FROM shops WHERE shop = ?', [shop]);
  return !!row?.access_token;
}

// Static files
app.use(
  '/assets',
  express.static(path.join(__dirname, 'web', 'dist', 'assets'), { maxAge: '1y' })
);
app.use(express.static(path.join(__dirname, 'web', 'dist'), { index: false }));

// helper to serve index.html with injected App Bridge apiKey
function sendIndex(res) {
  const filePath = path.join(__dirname, 'web', 'dist', 'index.html');
  let html = fs.readFileSync(filePath, 'utf-8');
  html = html.replace('{{apiKey}}', process.env.SHOPIFY_API_KEY || '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}

// ✅ Root: derive shop/host; start OAuth if needed
app.get('/', async (req, res) => {
  let shop = (req.query?.shop || '').toString();
  let host = (req.query?.host || '').toString();

  // If embedded and only host is present, decode to get the shop
  if (!shop && host) {
    try {
      const decoded = Buffer.from(host, 'base64').toString('utf-8'); // "<shop>.myshopify.com/admin"
      shop = decoded.split('/')[0] || '';
    } catch {}
  }

  // If we have a shop but not a host, synthesize one
  if (shop && !host) {
    host = Buffer.from(`${shop}/admin`, 'utf-8').toString('base64');
  }

  if (!shop) return sendIndex(res);

  const hasToken = await shopHasToken(shop);
  if (!hasToken) {
    const qs = new URLSearchParams({ shop, host: host || '' }).toString();
    return res.redirect(`/auth/install?${qs}`);
  }

  return sendIndex(res);
});

// Grant route to render login.html with variables
app.get('/app/grant', (req, res) => {
  const shop = req.query.shop || '';
  const host = req.query.host || '';
  const apiKey = process.env.SHOPIFY_API_KEY || '';

  const loginHtml = fs
    .readFileSync(path.join(__dirname, 'web', 'login.html'), 'utf-8')
    .replace('{{shop}}', shop)
    .replace('{{host}}', host)
    .replace('{{apiKey}}', apiKey);

  res.setHeader('Content-Type', 'text/html');
  return res.send(loginHtml);
});

// 🔎 Diagnostics
app.get('/healthz', (req, res) => res.status(200).send('ok'));
app.get('/diag', (req, res) => {
  res.json({
    hasApiKey: !!process.env.SHOPIFY_API_KEY,
    hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
    hasSessionSecret: !!process.env.SESSION_SECRET,
    hostEnv: process.env.HOST,
    hostNameComputed: (process.env.HOST || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
    scopesRaw: process.env.SCOPES,
  });
});

// Fallback for SPA (client-side routing)
app.get('*', (req, res) => {
  return sendIndex(res);
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});

// ... existing imports & setup above ...
