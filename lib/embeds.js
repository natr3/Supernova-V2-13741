const appHosts = new Set(['www.tiktok.com','tiktok.com','www.instagram.com','instagram.com','www.youtube.com','youtube.com','youtu.be','discord.com','web.snapchat.com','x.com','www.facebook.com','www.messenger.com','web.whatsapp.com','www.reddit.com','www.threads.com','www.pinterest.com','www.twitch.tv','web.telegram.org','bsky.app','www.tumblr.com','www.linkedin.com','bereal.com','open.spotify.com','soundcloud.com','chatgpt.com','drive.google.com']);
export function publicEmbed(value, hostname = 'localhost') {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const host = url.hostname.replace(/^www\./,'');
  if (['youtube.com','youtu.be','m.youtube.com'].includes(host)) {
    const id = host === 'youtu.be' ? url.pathname.split('/')[1] : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
    if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  }
  if (host === 'tiktok.com') {
    const id = url.pathname.match(/\/(?:video|v1)\/(\d{10,25})/)?.[1];
    if (id) return `https://www.tiktok.com/player/v1/${id}`;
  }
  if (host === 'instagram.com') {
    const match = url.pathname.match(/^\/(p|reel)\/([\w-]+)\/?/);
    if (match) return `https://www.instagram.com/${match[1]}/${match[2]}/embed/`;
  }
  if (host === 'open.spotify.com') {
    const match = url.pathname.match(/^\/(?:embed\/)?(track|album|playlist|episode)\/([a-zA-Z0-9]+)\/?/);
    if (match) return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
  }
  if (host === 'twitch.tv' && /^[\w-]+$/.test(url.pathname.slice(1))) return `https://player.twitch.tv/?channel=${encodeURIComponent(url.pathname.slice(1))}&parent=${encodeURIComponent(hostname)}&autoplay=false`;
  return null;
}
export function embedPlan(item, hostname) {
  const embed = publicEmbed(item.url,hostname);
  if (embed) return {url:embed};
  let url;
  try { url = new URL(item.url); } catch { return {blocked:true,reason:'This website link is invalid.'}; }
  if (url.protocol !== 'https:') return {blocked:true,reason:'This site needs a secure HTTPS link to load inside natr.'};
  if (item.kind === 'app' || appHosts.has(url.hostname)) return {blocked:true,reason:`${item.title}’s full app cannot run in an embedded window here. Public YouTube videos, TikTok videos, Instagram posts, Spotify tracks, and Twitch channels can use their official players below.`};
  return {url:item.url};
}
