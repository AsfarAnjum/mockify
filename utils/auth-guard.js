// utils/auth-guard.js
import { clearShopSessions } from '../db.js';

function shopFromReq(req) {
  return (req.query?.shop ||
          req.headers['x-shopify-shop-domain'] ||
          req.body?.shop || '').toString();
}

export function withAuth(handler) {
  return async (req, res, next) => {
    try {
      return await handler(req, res, next);
    } catch (err) {
      const status =
        err?.status ||
        err?.response?.status ||
        err?.response?.code ||
        err?.statusCode ||
        err?.code;

      if (status === 401 || status === 403) {
        const shop = shopFromReq(req);
        if (shop) await clearShopSessions(shop);
        return res.redirect(`/auth/install?shop=${encodeURIComponent(shop)}`);
      }
      return next(err);
    }
  };
}