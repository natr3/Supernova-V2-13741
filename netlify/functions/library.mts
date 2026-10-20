import type { Config } from '@netlify/functions';
import { getUser } from '@netlify/identity';
import { and, desc, eq, or } from 'drizzle-orm';
import { database } from '../../db/index.js';
import { entries, favorites, profiles } from '../../db/schema.js';
import { InputError, validateEntry, validateSettings } from '../../lib/validation.js';

export default async (req: Request) => {
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
  try {
    const user = await getUser();
    const db = database();
    if (req.method === 'GET') {
      const visible = user ? or(eq(entries.visibility, 'public'), eq(entries.ownerId, user.id)) : eq(entries.visibility, 'public');
      const [items, saved, profile] = await Promise.all([
        db.select().from(entries).where(visible).orderBy(desc(entries.createdAt)),
        user ? db.select().from(favorites).where(eq(favorites.userId, user.id)) : Promise.resolve([]),
        user ? db.select().from(profiles).where(eq(profiles.userId, user.id)) : Promise.resolve([]),
      ]);
      // Ownership IDs remain server-side; clients only need to know whether they can delete.
      return json({ entries: items.map(({ ownerId, ...item }) => ({ ...item, canDelete: Boolean(user && ownerId === user.id) })), favorites: saved.map(f => f.itemKey), profile: profile[0] ? { notes: profile[0].notes, settings: profile[0].settings } : null });
    }
    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return json({ error: 'Method not allowed.' }, 405);
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin) return json({ error: 'Request origin is not allowed.' }, 403);
    if (!req.headers.get('content-type')?.includes('application/json')) return json({ error: 'Send JSON data.' }, 415);
    const raw = await req.text();
    if (raw.length > 30000) return json({ error: 'This request is too large.' }, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request.' }, 400);
    if (req.method === 'POST') {
      const value = validateEntry(body, user?.id);
      const [inserted] = await db.insert(entries).values(value).returning();
      const { ownerId, ...item } = inserted;
      return json({ ...item, canDelete: Boolean(user && ownerId === user.id) }, 201);
    }
    if (!user) return json({ error: 'Sign in to save your personal library.' }, 401);
    if (req.method === 'DELETE') {
      if (!Number.isSafeInteger(body.id) || Number(body.id) <= 0) throw new InputError('Invalid entry.');
      const removed = await db.delete(entries).where(and(eq(entries.id, Number(body.id)), eq(entries.ownerId, user.id))).returning({ id: entries.id });
      return removed.length ? json({ ok: true }) : json({ error: 'Entry not found in your library.' }, 404);
    }
    if (body.action === 'favorite') {
      if (typeof body.key !== 'string' || body.key.length > 150 || !body.key || typeof body.enabled !== 'boolean') throw new InputError('Invalid favorite.');
      if (body.enabled) await db.insert(favorites).values({ userId: user.id, itemKey: body.key }).onConflictDoNothing();
      else await db.delete(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.itemKey, body.key)));
    } else if (body.action === 'notes') {
      if (typeof body.notes !== 'string' || body.notes.length > 20000) throw new InputError('Notes can contain up to 20,000 characters.');
      await db.insert(profiles).values({ userId: user.id, notes: body.notes }).onConflictDoUpdate({ target: profiles.userId, set: { notes: body.notes } });
    } else if (body.action === 'settings') {
      const settings = validateSettings(body.settings);
      await db.insert(profiles).values({ userId: user.id, settings }).onConflictDoUpdate({ target: profiles.userId, set: { settings } });
    } else throw new InputError('Unknown action.');
    return json({ ok: true });
  } catch (error) {
    if (error instanceof InputError) return json({ error: error.message }, 400);
    return json({ error: 'The library is unavailable right now. Please try again.' }, 503);
  }
};
export const config: Config = { path: '/api/library' };
