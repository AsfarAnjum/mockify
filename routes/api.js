import express from 'express';
import multer from 'multer';
import { getDB } from '../db.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

async function getAccessToken(shop) {
  const db = await getDB();
  const row = await db.get('SELECT access_token FROM shops WHERE shop = ?', [shop]);
  if (!row) throw new Error('Shop not installed');
  return row.access_token;
}

async function gql(shop, token, query, variables = {}) {
  const res = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    const msg = json?.errors?.map(e => e.message).join('; ') || res.statusText;
    throw new Error(msg || 'GraphQL error');
  }
  return json.data;
}

function gidToId(gid) {
  // e.g. gid://shopify/Product/1234567890 -> 1234567890
  return String(gid).split('/').pop();
}

/** GET /api/products */
router.get('/products', async (req, res) => {
  try {
    const { shop } = req.query;
    if (!shop) return res.status(400).json({ error: 'Missing shop' });
    const token = await getAccessToken(shop);

    const data = await gql(
      shop,
      token,
      `query {
        products(first: 50) {
          edges { node { id title handle featuredImage { url } } }
        }
      }`
    );
    const items = (data?.products?.edges || []).map(e => e.node);
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/attach
 * body: { shop, productId, position: 'first'|'last', replaceAll: boolean, file }
 */
router.post('/attach', upload.single('file'), async (req, res) => {
  try {
    const { shop, productId, position = 'last', replaceAll = false } = req.body;
    if (!shop || !productId || !req.file) {
      return res.status(400).json({ error: 'Missing params' });
    }

    const token = await getAccessToken(shop);

    // 1) Stage upload as IMAGE
    const staged = await gql(
      shop,
      token,
      `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }`,
      {
        input: [{
          resource: 'IMAGE',
          filename: req.file.originalname,
          mimeType: req.file.mimetype || 'image/jpeg',
          httpMethod: 'POST',
        }]
      }
    );
    const target = staged?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) throw new Error('No staged upload target');

    // Upload file to staged URL
    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append(
      'file',
      new Blob([req.file.buffer], { type: req.file.mimetype || 'application/octet-stream' }),
      req.file.originalname
    );
    const up = await fetch(target.url, { method: 'POST', body: form });
    if (!up.ok) throw new Error(`Staged upload failed (${up.status})`);

    // 2) Create File in Shopify; resolve a cdn URL via fragments + retries
    const created = await gql(
      shop,
      token,
      `mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            __typename
            id
            ... on MediaImage { image { url } }
            ... on GenericFile { url }
          }
          userErrors { field message }
        }
      }`,
      { files: [{ alt: 'Mockup', originalSource: target.resourceUrl }] }
    );
    const f = created.fileCreate.files?.[0];
    if (!f) throw new Error('File create returned no file');

    let fileUrl = f.image?.url || f.url || null;
    const fileId = f.id;
    for (let i = 0; !fileUrl && i < 8; i++) {
      await new Promise(r => setTimeout(r, 500));
      const q = await gql(
        shop,
        token,
        `query($ids: [ID!]!) {
          nodes(ids: $ids) {
            __typename id
            ... on MediaImage { image { url } }
            ... on GenericFile { url }
          }
        }`,
        { ids: [fileId] }
      );
      const node = q?.nodes?.[0];
      fileUrl = node?.image?.url || node?.url || null;
    }
    if (!fileUrl) throw new Error(`No URL on created file (type ${f.__typename})`);

    // 3) Attach to product via REST (2024-07)
    const pid = gidToId(productId);

    // Replace all existing images if requested
    if (String(replaceAll) === 'true' || replaceAll === true) {
      const imgsRes = await fetch(`https://${shop}/admin/api/2024-07/products/${pid}/images.json`, {
        headers: { 'X-Shopify-Access-Token': token }
      });
      const imgs = await imgsRes.json();
      const list = imgs?.images || [];
      for (const img of list) {
        await fetch(`https://${shop}/admin/api/2024-07/products/${pid}/images/${img.id}.json`, {
          method: 'DELETE',
          headers: { 'X-Shopify-Access-Token': token }
        });
      }
    }

    // Create the image (position 1 puts it first)
    const body = {
      image: {
        src: fileUrl,
        ...(position === 'first' ? { position: 1 } : {})
      }
    };
    const createImg = await fetch(`https://${shop}/admin/api/2024-07/products/${pid}/images.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!createImg.ok) {
      const t = await createImg.text();
      throw new Error(`Image create failed (${createImg.status}): ${t}`);
    }
    const createdImage = (await createImg.json())?.image;

    return res.json({ ok: true, productId, fileUrl, image: createdImage });
  } catch (e) {
    console.error('[/api/attach] error:', e);
    res.status(500).json({ error: e.message });
  }
});

/** POST /api/embed-description */
router.post('/embed-description', async (req, res) => {
  try {
    const { shop, productId, imageUrl, where = 'top' } = req.body;
    if (!shop || !productId || !imageUrl) {
      return res.status(400).json({ error: 'Missing params' });
    }
    const token = await getAccessToken(shop);

    const prod = await gql(
      shop,
      token,
      `query($id: ID!) { product(id: $id) { id title descriptionHtml } }`,
      { id: productId }
    );
    const current = prod.product.descriptionHtml || '';
    const snippet = `<p><img src="${imageUrl}" alt="Mockup"/></p>`;
    const next = where === 'top' ? snippet + current : current + snippet;

    const upd = await gql(
      shop,
      token,
      `mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product { id }
          userErrors { field message }
        }
      }`,
      { input: { id: productId, descriptionHtml: next } }
    );
    const uerr = upd?.productUpdate?.userErrors?.[0]?.message;
    if (uerr) throw new Error(uerr);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
