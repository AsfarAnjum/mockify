import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
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

/* Allow embedding inside Shopify Admin */
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

/* ---- helpers ---- */
async function shopHasToken(shop) {
  if (!shop) return false;
  const db = await getDB();
  const row = await db.get('SELECT access_token FROM shops WHERE shop = ?', [shop]);
  return !!row?.access_token;
}

/* ---- routes ---- */
app.use('/webhooks/privacy', complianceRoutes);
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/billing', billingRoutes);

/* Serve built frontend assets */
app.use('/assets', express.static(path.join(__dirname, 'web', 'dist', 'assets'), { maxAge: '1y' }));
app.use(express.static(path.join(__dirname, 'web', 'dist')));

/* IMPORTANT: Top-level OAuth redirect on root */
app.get('/', async (req, res) => {
  const shop = (req.query?.shop || '').toString();
  let host = (req.query?.host || '').toString();

  // If no host provided, derive it from shop (Shopify sometimes omits on first hit)
  if (!host && shop) host = Buffer.from(`${shop}/admin`, 'utf-8').toString('base64');

  // If we don't yet have a token for this shop, force top-level redirect to /auth/install
  if (shop && !(await shopHasToken(shop))) {
    const apiKey = process.env.SHOPIFY_API_KEY || '';
    return res
      .status(200)
      .type('html')
      .send(`<!doctype html>
<html><head><meta charset="utf-8">
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
</head><body>
<script>
  var AppBridge = window['app-bridge'];
  var createApp = AppBridge.default;
  var Redirect = AppBridge.actions.Redirect;
  var app = createApp({ apiKey: '${apiKey}', host: '${host}', forceRedirect: true });
  Redirect.create(app).dispatch(Redirect.Action.APP, '/auth/install?shop=${encodeURIComponent(shop)}');
</script>
</body></html>`);
  }

  // Token exists (or no shop param) → serve the SPA
  res.sendFile(path.join(__dirname, 'web', 'dist', 'index.html'));
});

/* SPA fallback for any other unknown path (after API routes above) */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'dist', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));