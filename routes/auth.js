import express from "express";
import { shopify } from "../shopify.js";

const router = express.Router();

// STEP 1: Begin OAuth (v11) — shopify.auth.begin() performs the redirect itself
router.get("/install", async (req, res) => {
  const shop = (req.query.shop || "").toString();
  const host = (req.query.host || "").toString();

  if (!shop || !host) {
    if (!res.headersSent) return res.status(400).send("Missing shop or host param");
    return;
  }

  try {
    await shopify.auth.begin({
      shop,
      isOnline: false,
      callbackPath: "/auth/callback",
      rawRequest: req,
      rawResponse: res,
    });
    // NOTE: Do not call res.redirect here — begin() already handled it.
  } catch (err) {
    console.error("[AUTH/INSTALL] error:", err);
    const msg = err?.message || "unknown error";
    if (!res.headersSent) {
      return res.status(500).send(`Failed to start OAuth: ${msg}`);
    }
  }
});

// STEP 2: Complete OAuth — then redirect back into the app
router.get("/callback", async (req, res) => {
  try {
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const host = (req.query.host || "").toString();
    const shop = session?.shop;

    if (!shop || !host) {
      if (!res.headersSent) return res.status(400).send("Missing shop or host on callback");
      return;
    }

    if (!res.headersSent) {
      return res.redirect(`/?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`);
    }
  } catch (err) {
    console.error("[AUTH/CALLBACK] error:", err);
    if (!res.headersSent) {
      return res.status(400).send("OAuth callback failed");
    }
  }
});

export default router;