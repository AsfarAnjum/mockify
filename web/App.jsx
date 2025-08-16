import React, { useEffect, useState, useMemo, useCallback } from 'react';
import ProductPicker from './components/ProductPicker.jsx';
import UploadAndAttach from './components/UploadAndAttach.jsx';
import { apiFetch } from './main.jsx'; // ✅ token-aware fetch

function getShopFromUrl() {
  const url = new URL(window.location.href);
  let shop = url.searchParams.get('shop');
  const host = url.searchParams.get('host');
  if (!shop && host) {
    try {
      const decoded = atob(host); // "<shop>.myshopify.com/admin"
      shop = (decoded.split('/')[0] || '').trim();
    } catch {}
  }
  return shop || '';
}

function getHostFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get('host') || '';
}

function topLevelReauth(shop, fallback) {
  const target = `/auth/exit-iframe?shop=${encodeURIComponent(shop || '')}`;
  const url = fallback || target;
  (window.top || window).location.assign(url);
}

function toUnifiedAdminUrl(confirmationUrl, shopDomain) {
  if (!confirmationUrl || !shopDomain) return confirmationUrl;
  const store = shopDomain.replace('.myshopify.com', '');
  const classicRoot = `https://${shopDomain}/admin`;
  const unifiedRoot = `https://admin.shopify.com/store/${store}`;
  return confirmationUrl.startsWith(classicRoot)
    ? confirmationUrl.replace(classicRoot, unifiedRoot)
    : confirmationUrl;
}

async function parseJsonSafe(res) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    return res.json();
  }
  const text = await res.text();
  // If server returned HTML (e.g., SPA index), surface a short, readable error
  const looksHtml = /^\s*<!doctype html>|<html/i.test(text || '');
  if (looksHtml) {
    throw new Error('Unexpected HTML from server (are you navigating instead of fetch?)');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text?.slice(0, 200) || 'Unexpected non‑JSON response');
  }
}

export default function App() {
  const shop = useMemo(getShopFromUrl, []);
  const host = useMemo(getHostFromUrl, []);
  const [product, setProduct] = useState(null);
  const [billing, setBilling] = useState({ loading: true, active: false, error: null });

  const ensureBilling = useCallback(async () => {
    setBilling((b) => ({ ...b, loading: true, error: null }));
    try {
      // Server derives shop from JWT; no need to pass ?shop=...
      const r = await apiFetch('/billing/ensure', { method: 'GET' });

      // 401 → server tells us to reauth with a JSON body
      if (r.status === 401) {
        const data = await parseJsonSafe(r).catch(() => ({}));
        if (data?.redirect) {
          (window.top || window).location.assign(data.redirect);
          return;
        }
        // Fallback: force top-level reauth using our computed shop
        if (shop) {
          topLevelReauth(shop);
          return;
        }
        throw new Error('Reauthentication required');
      }

      const data = await parseJsonSafe(r);

      if (data?.confirmationUrl) {
        const target = toUnifiedAdminUrl(data.confirmationUrl, shop);
        (window.top || window).location.assign(target);
        return;
      }

      setBilling({ loading: false, active: !!data?.active, error: null });
    } catch (e) {
      setBilling({ loading: false, active: false, error: e?.message || 'Failed to fetch' });
    }
  }, [shop]);

  useEffect(() => {
    if (!shop) {
      setBilling({ loading: false, active: false, error: 'No shop detected' });
      return;
    }
    // If embedded and host is missing (some Admin entry points), fix by top-level hop
    const embedded = window.top !== window.self;
    if (embedded && !host) {
      topLevelReauth(shop);
      return;
    }
    ensureBilling();
  }, [shop, host, ensureBilling]);

  return (
    <div style={{ maxWidth: 960, margin: '40px auto', fontFamily: 'system-ui, -apple-system' }}>
      <h1>Mockup Auto-Embedder</h1>

      {!shop && (
        <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8, marginBottom: 16, background: '#fff' }}>
          <strong>No shop detected.</strong> Please open via Shopify Admin.
        </div>
      )}

      {billing.loading && <div>Checking billing…</div>}

      {!billing.loading && billing.error && (
        <div style={{ border: '1px solid #ef4444', background: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <strong>Billing error:</strong> {String(billing.error)}
          <div style={{ marginTop: 8 }}>
            <button onClick={() => topLevelReauth(shop)} style={{ padding: '6px 12px', marginRight: 8, cursor: 'pointer' }}>
              Reauthenticate
            </button>
            <button onClick={ensureBilling} style={{ padding: '6px 12px', cursor: 'pointer' }}>Try again</button>
          </div>
        </div>
      )}

      {shop && billing.active && !billing.loading && !billing.error && (
        <>
          <p>Upload a mockup and attach it to a product&apos;s media or description.</p>
          <ProductPicker shop={shop} onPick={setProduct} />
          {product && <UploadAndAttach shop={shop} product={product} />}
        </>
      )}
    </div>
  );
}
