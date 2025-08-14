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

/* ---- mount API/webhook/auth routes first ---- */
app.use('/webhooks/privacy', complianceRoutes);
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/billing', billingRoutes);

/* ---- Root: trigger top-level OAuth when needed ----
   Shopify's automated install expects your app to bounce to /app/grant.
   We do that by serving an App Bridge redirect page when there is no token. */
app.get('/', async (req, res) => {
  const shop = (req.query?.shop || '').toString();
  let host = (req.query?.host || '').toString();

  // derive host if missing
  if (!host && shop) host = Buffer.from(`${shop}/admin`, 'utf-8').toString('base64');

  // check if we already have a token for this shop
  let hasToken = false;
  if (shop) {
    const db = await getDB();
    const row = await db.get('SELECT access_token FROM shops WHERE shop = ?', [shop]);
    hasToken = !!row?.access_token;
  }

  if (shop && !hasToken) {
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

  // token exists (or no shop param) -> serve the app shell
  res.sendFile(path.join(__dirname, 'web', 'dist', 'index.html'));
});

/* ---- Static assets AFTER the root handler ---- */
app.use(
  '/assets',
  express.static(path.join(__dirname, 'web', 'dist', 'assets'), { maxAge: '1y' })
);
// disable index auto-serve so "/" hits our handler above
app.use(express.static(path.join(__dirname, 'web', 'dist'), { index: false }));

/* ---- SPA fallback ---- */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'dist', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));