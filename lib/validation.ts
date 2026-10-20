import type { Preferences } from './preferences.js';

export class InputError extends Error {}

export function validateUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw new InputError('Paste a valid game or website link.');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new InputError('Use a complete link starting with https://.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) {
    throw new InputError('Use a public http:// or https:// link without login details.');
  }
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || /^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new InputError('Use a public website link.');
  }
  return url.href;
}

export function validateEntry(body: Record<string, unknown>, userId?: string) {
  const url = validateUrl(body.url);
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (title.length > 80) throw new InputError('Keep the name under 80 characters.');
  const visibility = body.visibility === 'private' ? 'private' : 'public';
  if (visibility === 'private' && !userId) throw new InputError('Sign in to save to your private library.');
  return {
    title: title || new URL(url).hostname.replace(/^www\./, ''), url,
    kind: body.kind === 'link' ? 'link' : 'game', visibility, ownerId: userId || null,
  };
}

export function validateSettings(value: unknown) {
  if (!value || typeof value !== 'object') throw new InputError('Invalid settings.');
  const v = value as Record<string, unknown>;
  if (!['stars', 'waves', 'aurora', 'custom', 'off'].includes(String(v.background)) || typeof v.motion !== 'boolean' || typeof v.volume !== 'number' || !Number.isFinite(v.volume) || v.volume < 0 || v.volume > 1) {
    throw new InputError('Invalid background or volume settings.');
  }
  const result: Preferences = { background: String(v.background), motion: v.motion, volume: v.volume };
  if (v.backgroundImage !== undefined) {
    if (v.backgroundImage === null) result.backgroundImage = null;
    else {
      const image = v.backgroundImage as Record<string, unknown>;
      if (!image || typeof image.key !== 'string' || !/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(image.key) ||
          typeof image.width !== 'number' || typeof image.height !== 'number' ||
          !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 1 || image.height < 1 || image.width * image.height > 40000000) throw new InputError('Invalid background image.');
      result.backgroundImage = { key: image.key, width: image.width, height: image.height };
    }
  }
  for (const name of ['cloakEnabled', 'panicEnabled', 'startupCover'] as const) {
    if (v[name] !== undefined) {
      if (typeof v[name] !== 'boolean') throw new InputError('Invalid privacy setting.');
      result[name] = v[name];
    }
  }
  if (v.cloakTitle !== undefined) {
    if (typeof v.cloakTitle !== 'string' || !v.cloakTitle.trim() || v.cloakTitle.length > 80) throw new InputError('Use a tab name between 1 and 80 characters.');
    result.cloakTitle = v.cloakTitle.trim();
  }
  if (v.cloakIcon !== undefined) {
    if (!['notes','calculator','classroom','default'].includes(String(v.cloakIcon))) throw new InputError('Invalid tab icon.');
    result.cloakIcon = String(v.cloakIcon);
  }
  if (v.panicKey !== undefined) {
    if (typeof v.panicKey !== 'string' || !/^[a-z0-9]$/i.test(v.panicKey)) throw new InputError('Choose one letter or number for the privacy shortcut.');
    result.panicKey = v.panicKey.toLowerCase();
  }
  return result;
}
