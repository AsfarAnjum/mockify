import express from "express";
import { shopify } from "../shopify.js";

const router = express.Router();

// STEP 1: Begin OAuth — do NOT require host
router.get("/install", async (req, res) => {
  const shop = (req.query.shop || "").toString();
  // host is optional for begin()
  if (!shop) {
    if (!res.headersSent) return res.status(400).send("Missing shop param");
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
    // NOTE: begin() performs the redirect itself.
  } catch (err) {
    console.error("[AUTH/INSTALL] error:", err);
    if (!res.headersSent) {
      return res
        .status(500)
        .type("text/plain; charset=utf-8")
        .send(`Failed to start OAuth: ${err?.message || "unknown error"}`);
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

    // Try to use provided host, otherwise synthesize one from shop
    let host = (req.query.host || "").toString();
    const shop = session?.shop;

    if (!shop) {
      if (!res.headersSent) return res.status(400).send("Missing shop on callback");
      return;
    }

    if (!host) {
      // synthesize a host param Shopify Admin understands
      host = Buffer.from(`${shop}/admin`, "utf-8").toString("base64");
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