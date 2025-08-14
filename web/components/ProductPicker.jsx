import React, { useEffect, useState } from 'react';

export default function ProductPicker({ shop, onPick }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    async function run() {
      try {
        setLoading(true); setErr('');
        const r = await fetch('/api/products?shop=' + encodeURIComponent(shop));
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to load products');
        const list = Array.isArray(data) ? data : [];
        setItems(list);
      } catch (e) {
        setErr(e.message);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
    if (shop) run();
  }, [shop]);

  return (
    <div style={{ margin: '20px 0' }}>
      <h3>Select a product</h3>
      {loading && <div>Loading…</div>}
      {err && <div style={{ color: '#b91c1c' }}>Error: {err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {items.map(p => (
          <button key={p.id} onClick={() => onPick(p)} style={{ textAlign: 'left', border: '1px solid #ddd', borderRadius: 8, padding: 12, background: '#fff', cursor: 'pointer' }}>
            <img src={p.featuredImage?.url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6 }} />
            <div style={{ marginTop: 8, fontWeight: 600 }}>{p.title}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
