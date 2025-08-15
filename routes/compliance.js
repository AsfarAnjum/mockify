import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// Verify webhook HMAC
function verifyHmac(req, res, buf) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const generatedHmac = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(buf, 'utf8')
    .digest('base64');

  if (hmacHeader !== generatedHmac) {
    throw new Error('Webhook HMAC validation failed');
  }
}

// Middleware to verify HMAC for all webhook routes
router.use(
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    try {
      verifyHmac(req, res, req.body);
      next();
    } catch (err) {
      console.error('[Webhook] Invalid HMAC:', err.message);
      return res.status(401).send('Invalid HMAC');
    }
  }
);

// Shopify will POST these webhooks. Always respond 200 quickly.
router.post('/customers/data_request', (req, res) => {
  res.status(200).send('ok');
});

router.post('/customers/redact', (req, res) => {
  res.status(200).send('ok');
});

router.post('/shop/redact', (req, res) => {
  res.status(200).send('ok');
});

export default router;
