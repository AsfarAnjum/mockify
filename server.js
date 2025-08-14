
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
app.use('/webhooks/privacy', complianceRoutes);

app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));


dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Allow embedding inside Shopify Admin
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

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/billing', billingRoutes);

// Serve built frontend
app.use(express.static(path.join(__dirname, 'web', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'dist', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
