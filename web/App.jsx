import React, { useEffect, useState, useMemo } from 'react';
import ProductPicker from './components/ProductPicker.jsx';
import UploadAndAttach from './components/UploadAndAttach.jsx';

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

function toUnifiedAdminUrl(confirmationUrl, shopDomain) {
  if (!confirmationUrl || !shopDomain) return confirmationUrl;
  const store = shopDomain.replace('.myshopify.com', '');
  const classicRoot = `https://${shopDomain}/admin`;
  const unifiedRoot = `https://admin.shopify.com/store/${store}`;
  return confirmationUrl.startsWith(classicRoot)
    ? confirmationUrl.replace(classicRoot, unifiedRoot)
    : confirmationUrl;
}

export default function App() {
  const shop = useMemo(getShopFromUrl, []);
  const [product, setProduct] = useState(null);
  const [billing, setBilling] = useState({
    loading: true,
    active: false,
    error: null,
  });

  // Use session-token fetch if present (injected by main.jsx)
  const tokenFetch =
    (typeof window !== 'undefined' && window.__tokenFetch) || fetch.bind(window);

  useEffect(() => {
    async function run() {
      if (!shop) {
        setBilling({ loading: false, active: false, error: 'No shop detected' });
        return;
      }

      try {
        // ✅ No shop param — backend infers shop from JWT token
        const r = await tokenFetch('/billing/ensure');

        // stale / missing server token → backend returns 401 with { error:'reauth', redirect:'...' }
        if (r.status === 401) {
          const data = await r.json().catch(() => ({}));
          if (data?.redirect) {
            (window.top || window).location.href = data.redirect;
            return;
          }
          throw new Error('Reauthentication required');
        }

        const data = await r.json();

        // Got a confirmation URL → normalize to unified admin and hard-redirect top-level
        if (data?.confirmationUrl) {
          const target = toUnifiedAdminUrl(data.confirmationUrl, shop);
          (window.top || window).location.assign(target);
          return;
        }

        setBilling({ loading: false, active: !!data?.active, error: null });
      } catch (e) {
        setBilling({
          loading: false,
          active: false,
          error: e?.message || 'Failed to fetch',
        });
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop]); // tokenFetch is stable on window, safe to omit

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
