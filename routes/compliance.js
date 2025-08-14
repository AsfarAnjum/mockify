import express from 'express';
const router = express.Router();

// Shopify will POST these webhooks. Always respond 200 quickly.
router.post('/customers/data_request', (req, res) => {
  // TODO: look up & return or log what you store (if anything) for this customer
  res.status(200).send('ok');
});

router.post('/customers/redact', (req, res) => {
  // TODO: delete any customer data you store (if any)
  res.status(200).send('ok');
});

router.post('/shop/redact', (req, res) => {
  // TODO: delete shop-scoped data if required by your policy
  res.status(200).send('ok');
});

export default router;
