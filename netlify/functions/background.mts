import type { Config } from '@netlify/functions';
import { getUser } from '@netlify/identity';
import { getStore } from '@netlify/blobs';
import { imageSize } from 'image-size';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { database } from '../../db/index.js';
import { profiles } from '../../db/schema.js';

export default async (req: Request) => {
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control':'private, no-store' } });
  try {
    const user = await getUser();
    if (!user) return json({ error:'Sign in to save or load your private background.' },401);
    const store = getStore({ name:'natr-backgrounds',consistency:'strong' });
    if (req.method === 'GET') {
      const key = new URL(req.url).searchParams.get('key') || '';
      if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key)) return json({error:'Invalid background.'},400);
      const image = await store.get(`${user.id}/${key}`, { type:'arrayBuffer' });
      if (!image) return json({error:'Background not found.'},404);
      const extension = key.split('.').pop();
      return new Response(image, { headers: {
        'Content-Type':extension === 'jpg' ? 'image/jpeg' : `image/${extension}`,
        'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff',
      } });
    }
    if (req.method !== 'POST') return json({error:'Method not allowed.'},405);
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin) return json({error:'Request origin is not allowed.'},403);
    if (!['image/jpeg','image/png','image/webp'].includes(req.headers.get('content-type') || '')) return json({error:'Choose a JPEG, PNG, or WebP image.'},415);
    if (Number(req.headers.get('content-length')) > 4 * 1024 * 1024) return json({error:'Use an image under 4 MB. Large images can be exported as JPEG or WebP.'},413);
    // Bound streamed bodies as well as Content-Length; keep uploads within the function request limit.
    const reader = req.body?.getReader();
    if (!reader) return json({error:'Choose an image to upload.'},400);
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const {value,done} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4 * 1024 * 1024) { await reader.cancel(); return json({error:'Use an image under 4 MB.'},413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
    let size;
    try { size = imageSize(bytes); } catch { return json({error:'This image could not be read. Try JPEG, PNG, or WebP.'},400); }
    if (!size.width || !size.height || size.width * size.height > 40000000 || !['jpg','png','webp'].includes(size.type || '')) return json({error:'Use a JPEG, PNG, or WebP image up to 40 megapixels.'},400);
    const actualType = size.type === 'jpg' ? 'image/jpeg' : `image/${size.type}`;
    if (actualType !== req.headers.get('content-type')) return json({error:'The image contents do not match its file type.'},400);
    const key = `${randomUUID()}.${size.type}`;
    const backgroundImage = { key,width:size.width,height:size.height };
    await store.set(`${user.id}/${key}`, bytes.buffer);
    try {
      const db = database();
      const patch = { background:'custom',backgroundImage };
      await db.insert(profiles).values({userId:user.id,settings:patch}).onConflictDoUpdate({target:profiles.userId,set:{settings:sql`${profiles.settings} || ${JSON.stringify(patch)}::jsonb`}});
    } catch {
      await store.delete(`${user.id}/${key}`);
      return json({error:'The image could not be saved to your account. Please try again.'},503);
    }
    return json({ backgroundImage },201);
  } catch { return json({error:'Background storage is unavailable. Please try again.'},503); }
};
export const config: Config = { path:'/api/background' };
