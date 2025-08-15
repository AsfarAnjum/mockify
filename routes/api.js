import express from 'express';
import jwtDecode from 'jwt-decode';

const router = express.Router();

// ✅ Middleware to decode the session token using jwt-decode
router.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer /, '').trim();
    if (!token) throw new Error('Missing token');

    const payload = jwtDecode(token); // ✅ Pure decoding without verification
    res.locals.shopify = { tokenPayload: payload };
    next();
  } catch (error) {
    console.error('JWT decode failed:', error.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

// ✅ Example protected route
router.get('/ping', (req, res) => {
  const shop = res.locals.shopify?.tokenPayload?.dest?.replace(/^https:\/\//, '');
  res.json({
    ok: true,
    shop,
    tokenPayload: res.locals.shopify.tokenPayload,
  });
});

export default router;