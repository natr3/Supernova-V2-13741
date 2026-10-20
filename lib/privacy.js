const icons = {
  notes: '<rect x="13" y="8" width="38" height="48" rx="5" fill="#eee9dc"/><path d="M22 23h21M22 32h21M22 41h15" stroke="#747d89" stroke-width="4"/>',
  calculator: '<rect x="13" y="6" width="38" height="52" rx="6" fill="#666b76"/><rect x="20" y="14" width="24" height="12" fill="#d0dccb"/><path d="M21 35h7m8 0h7m-22 11h7m8 0h7" stroke="#eee" stroke-width="5"/>',
  classroom: '<rect x="7" y="12" width="50" height="38" rx="4" fill="#498b6c" stroke="#e8c67c" stroke-width="5"/><circle cx="32" cy="27" r="6" fill="#e8e8de"/><path d="M20 43c0-13 24-13 24 0" fill="#e8e8de"/>',
};
let onCover = () => {};
let onReveal = () => {};
let beforeCoverFocus;
let blockedHost = '';
export function configurePrivacy(cover, reveal) { onCover = cover; onReveal = reveal; }
export function applyTab(settings, route = 'home') {
  const covered = document.getElementById('privacy-cover')?.open;
  const title = settings.cloakEnabled ? settings.cloakTitle || 'Class notes' : route === 'home' ? 'natr' : `${route} / natr`;
  document.title = covered ? 'Website blocked' : title;
  const favicon = document.querySelector('link[rel=icon]');
  const selected = settings.cloakEnabled ? settings.cloakIcon || 'notes' : 'default';
  favicon.href = icons[selected] ? 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${icons[selected]}</svg>`) : '/assets/natr.svg';
}
export function showCover(settings, host = location.hostname) {
  const dialog = document.getElementById('privacy-cover');
  if (dialog.open) return;
  beforeCoverFocus = document.activeElement;
  blockedHost = host;
  document.getElementById('cover-host').textContent = blockedHost;
  document.getElementById('cover-shortcut').textContent = settings.panicEnabled ? `Press ${String(settings.panicKey || 'u').toUpperCase()} to return` : 'Your page is waiting where you left it.';
  onCover();
  dialog.showModal();
  document.body.classList.add('covered');
  applyTab(settings);
}
export function hideCover(settings, route) {
  document.getElementById('privacy-cover').close();
  document.body.classList.remove('covered');
  onReveal(); applyTab(settings,route);
  if (beforeCoverFocus?.isConnected) beforeCoverFocus.focus();
}
