import express from "express";
import { shopify } from "../shopify.js";

const router = express.Router();

// STEP 1: Begin OAuth — do NOT require host
router.get("/install", async (req, res) => {
  const shop = (req.query.shop || "").toString();
  console.log("[AUTH/INSTALL] begin", { shop });
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
    // Log the incoming query for visibility (no secrets here)
    console.log("[AUTH/CALLBACK] query:", req.query);

    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    if (!session) {
      console.error("[AUTH/CALLBACK] no session returned from shopify.auth.callback");
      if (!res.headersSent) return res.status(500).type("text/plain; charset=utf-8").send("OAuth callback failed: no session");
      return;
    }

    const shop = session.shop;
    if (!shop) {
      console.error("[AUTH/CALLBACK] session missing shop:", session);
      if (!res.headersSent) return res.status(500).type("text/plain; charset=utf-8").send("OAuth callback failed: session missing shop");
      return;
    }

    // Prefer host sent by Shopify; otherwise synthesize a valid one
    let host = (req.query.host ?? "").toString();
    if (!host) {
      host = Buffer.from(`${shop}/admin`, "utf-8").toString("base64");
      console.warn("[AUTH/CALLBACK] host missing; synthesized host:", host);
    }

    const target = `/?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`;
    console.log("[AUTH/CALLBACK] redirecting to", target);

    if (!res.headersSent) {
      return res.redirect(302, target);
    } else {
      console.warn("[AUTH/CALLBACK] headers already sent before redirect");
    }
  } catch (err) {
    console.error("[AUTH/CALLBACK] error:", {
      name: err?.name,
      message: err?.message,
      cause: err?.cause?.message || err?.cause,
      stack: err?.stack?.split("\n").slice(0, 5).join("\n"),
    });
    if (!res.headersSent) {
      return res
        .status(400)
        .type("text/plain; charset=utf-8")
        .send(`OAuth callback failed: ${err?.name || "Error"} - ${err?.message || "unknown"}`);
    }
  }
});

export default router;