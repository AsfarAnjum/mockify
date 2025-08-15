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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Allow Shopify admin embedding
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors https://admin.shopify.com https://*.myshopify.com;"
  );
  res.removeHeader('X-Frame-Options');
  next();
});

app.use(cors());
app.use(compression());
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/webhooks/privacy', complianceRoutes);
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/billing', billingRoutes);

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

// Main route — redirects to OAuth if token not found
app.get('/', async (req, res) => {
  const shop = (req.query?.shop || '').toString();
  let host = (req.query?.host || '').toString();
  if (!host && shop) host = Buffer.from(`${shop}/admin`, 'utf-8').toString('base64');

  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }

  const hasToken = await shopHasToken(shop);
  if (!hasToken) {
    return res.redirect(`/auth?shop=${shop}`);
  }

  return res.sendFile(path.join(__dirname, 'web', 'dist', 'index.html'));
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

// Fallback for SPA (client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'dist', 'index.html'));
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});