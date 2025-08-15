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
      shop = decoded.split('/')[0];
    } catch {}
  }
  return shop;
}

export default function App() {
  const shop = useMemo(getShopFromUrl, []);
  const [product, setProduct] = useState(null);
  const [billing, setBilling] = useState({ loading: true, active: false, confirmationUrl: null, error: null });

  useEffect(() => {
    async function checkBilling() {
      if (!shop) return setBilling(b => ({ ...b, loading: false }));
      try {
        const r = await fetch('/billing/ensure?shop=' + encodeURIComponent(shop));
        const data = await r.json();
        if (!r.ok || data.error) throw new Error(data.error || 'Billing check failed');

        if (data.confirmationUrl) {
          // ✅ Automatically redirect for billing
          window.top.location.href = data.confirmationUrl;
          return;
        }

        setBilling({ loading: false, active: !!data.active, confirmationUrl: null, error: null });
      } catch (e) {
        setBilling({ loading: false, active: false, confirmationUrl: null, error: e.message });
      }
    }

    checkBilling();
  }, [shop]);

  return (
    <div style={{ maxWidth: 960, margin: '40px auto', fontFamily: 'system-ui, -apple-system' }}>
      <h1>Mockup Auto-Embedder</h1>

      {!shop && (
        <div style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8, marginBottom: 16, background: '#fff' }}>
          <strong>No shop detected.</strong> Open via Shopify Admin, or append
          <code> ?shop=&lt;your-store&gt;.myshopify.com</code> to the URL.
        </div>
      )}

      {billing.loading && <div>Checking billing…</div>}

      {!billing.loading && billing.error && (
        <div style={{ border: '1px solid #ef4444', background: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <strong>Billing error:</strong> {billing.error}
        </div>
      )}

      {/* Only show product UI after billing is active */}
      {shop && billing.active && (
        <>
          <p>Upload a mockup and attach it to a product's media or description.</p>
          <ProductPicker shop={shop} onPick={setProduct} />
          {product && <UploadAndAttach shop={shop} product={product} />}
        </>
      )}
    </div>
  );
}
