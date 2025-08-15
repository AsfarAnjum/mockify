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

// ✅ Required so cookies from Shopify OAuth survive Render's proxy
app.set('trust proxy', 1);

// ✅ Ensure cookies work over HTTPS and in embedded iframes
app.use(
  cookieParser(process.env.SESSION_SECRET, {
    sameSite: 'none',
    secure: true,
    httpOnly: true,
  })
);

// Allow Shopify admin embedding
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors https://admin.shopify.com https://*.myshopify.com;"
  );
  res.removeHeader('X-Frame-Options');
  next();
});

app.use(cors({ credentials: true, origin: true }));
app.use(compression());
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


// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});


// ... existing imports & setup above ...

// helper to serve index.html with injected App Bridge apiKey
function sendIndex(res) {
  const filePath = path.join(__dirname, 'web', 'dist', 'index.html');
  let html = fs.readFileSync(filePath, 'utf-8');
  html = html.replace('{{apiKey}}', process.env.SHOPIFY_API_KEY || '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}

// ✅ Root: derive shop from host when embedded; start OAuth if needed
app.get('/', async (req, res) => {
  let shop = (req.query?.shop || '').toString();
  const host = (req.query?.host || '').toString();

  if (!shop && host) {
    try {
      const decoded = Buffer.from(host, 'base64').toString('utf-8'); // "<shop>.myshopify.com/admin"
      shop = decoded.split('/')[0] || '';
    } catch {}
  }

  if (!shop) return sendIndex(res);

  const hasToken = await shopHasToken(shop);
  if (!hasToken) {
    return res.redirect(`/auth/install?shop=${encodeURIComponent(shop)}`);
  }

  return sendIndex(res);
});

// Fallback for SPA (client-side routing)
app.get('*', (req, res) => {
  return sendIndex(res);
});

// ... rest of your server.js unchanged ...
