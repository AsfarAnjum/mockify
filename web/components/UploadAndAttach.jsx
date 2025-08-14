import React, { useState } from 'react';

export default function UploadAndAttach({ shop, product }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('media');
  const [position, setPosition] = useState('last');
  const [replaceAll, setReplaceAll] = useState(false);
  const [where, setWhere] = useState('top');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function attach() {
    try {
      if (!file) return;
      setBusy(true); setMsg('');
      if (mode === 'media') {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('shop', shop);
        fd.append('productId', product.id);
        fd.append('position', position);
        fd.append('replaceAll', String(replaceAll));
        const r = await fetch('/api/attach', { method: 'POST', body: fd });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed');
        setMsg('✅ Attached to product images');
      } else {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('shop', shop);
        fd.append('productId', product.id);
        const r1 = await fetch('/api/attach', { method: 'POST', body: fd });
        const d1 = await r1.json();
        if (!r1.ok) throw new Error(d1.error || 'Upload failed');
        const r2 = await fetch('/api/embed-description', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop, productId: product.id, imageUrl: d1.fileUrl, where }) });
        const d2 = await r2.json();
        if (!r2.ok) throw new Error(d2.error || 'Embed failed');
        setMsg('✅ Inserted image into description');
      }
    } catch (e) {
      setMsg('❌ ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: '1px solid #eee', padding: 16, borderRadius: 8 }}>
      <h3>Attach mockup to: <em>{product.title}</em></h3>

      <div style={{ marginBottom: 12 }}>
        <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          <input type="radio" name="mode" value="media" checked={mode==='media'} onChange={() => setMode('media')} /> Product images
        </label>
        <label>
          <input type="radio" name="mode" value="description" checked={mode==='description'} onChange={() => setMode('description')} /> Product description
        </label>
      </div>

      {mode === 'media' && (
        <div style={{ margin: '8px 0', display: 'flex', gap: 16, alignItems: 'center' }}>
          <label>Position:
            <select value={position} onChange={e => setPosition(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="first">First</option>
              <option value="last">Last</option>
            </select>
          </label>
          <label>
            <input type="checkbox" checked={replaceAll} onChange={e => setReplaceAll(e.target.checked)} /> Replace all existing images
          </label>
        </div>
      )}

      {mode === 'description' && (
        <div style={{ margin: '8px 0' }}>
          <label>Insert at:
            <select value={where} onChange={e => setWhere(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
          </label>
        </div>
      )}

      <button onClick={attach} disabled={!file || busy} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #111', background: '#111', color: '#fff', cursor: 'pointer' }}>
        {busy ? 'Working…' : 'Attach Mockup'}
      </button>

      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
    </div>
  );
}
