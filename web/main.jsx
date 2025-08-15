import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import createApp from "@shopify/app-bridge";
import { getSessionToken } from "@shopify/app-bridge-utils";

/** Fetch helper that adds Shopify session token (JWT) */
export async function apiFetch(url, options = {}) {
  const app = window.__APP_BRIDGE_APP__;
  if (!app) return fetch(url, options); // Fallback if App Bridge not ready

  const token = await getSessionToken(app);
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  // Only set JSON Content-Type if body is plain object
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options = { ...options, body: JSON.stringify(options.body) };
  }

  return fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });
}

// Optional: expose globally
window.apiFetch = apiFetch;

const el = document.getElementById("root");
const root = createRoot(el);

function RootApp() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = new URLSearchParams(window.location.search).get("host");
    if (!host) {
      console.error("Missing ?host= param in URL — App Bridge will not init.");
      return;
    }

    const app = createApp({
      apiKey: "dd982d2aaade607bd9c6c8047913cc86", // ✅ Your API key
      host,
      forceRedirect: true,
    });

    // Store globally so apiFetch can access
    window.__APP_BRIDGE_APP__ = app;

    // Pre-fetch token once to confirm it works
    getSessionToken(app)
      .then(() => setReady(true))
      .catch((err) => console.error("Failed to get session token", err));
  }, []);

  if (!ready) return <div>Loading app…</div>;

  return <App />;
}

root.render(<RootApp />);
