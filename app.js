import { createIcons, Home, Gamepad2, Wrench, UsersRound, MonitorPlay, Link, NotebookPen, Settings, Terminal, Volume2, VolumeX, UserRound, Search, Plus, X, Heart, ExternalLink, Play, ArrowUpRight, AudioLines, PanelBottomClose, RotateCw, Expand, Maximize2, Calculator, Timer, Paintbrush, Bot, FileText, Puzzle, Monitor, ChartSpline, BookOpen, Trash2, Download, Save, Check, Square, Sparkles, LogOut, Copy, SlidersHorizontal } from 'lucide';
import { getUser, login, signup, logout, getSettings, handleAuthCallback, onAuthChange, requestPasswordRecovery, updateUser } from '@netlify/identity';
import { games, apps, media, tools, sounds } from './lib/catalog.js';
import { audioState, playSound, stopSounds, setVolume, speak } from './lib/audio.js';
import { configurePrivacy, applyTab, showCover, hideCover } from './lib/privacy.js';
import { embedPlan, publicEmbed } from './lib/embeds.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (text = '') => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const icon = name => `<i data-lucide="${name}"></i>`;
const icons = { Home, Gamepad2, Wrench, UsersRound, MonitorPlay, Link, NotebookPen, Settings, Terminal, Volume2, VolumeX, UserRound, Search, Plus, X, Heart, ExternalLink, Play, ArrowUpRight, AudioLines, PanelBottomClose, RotateCw, Expand, Maximize2, Calculator, Timer, Paintbrush, Bot, FileText, Puzzle, Monitor, ChartSpline, BookOpen, Trash2, Download, Save, Check, Square, Sparkles, LogOut, Copy, SlidersHorizontal };
const refreshIcons = () => createIcons({ icons, attrs: { 'aria-hidden': 'true', 'stroke-width': 1.65 } });
const sections = [
  ['home', 'Home', 'home'], ['games', 'Games', 'gamepad-2'], ['tools', 'Tools', 'wrench'],
  ['apps', 'Apps & social', 'users-round'], ['media', 'Media', 'monitor-play'], ['links', 'Links', 'link'],
  ['notes', 'Notes', 'notebook-pen'], ['settings', 'Settings', 'settings'], ['terminal', 'Command line', 'terminal'],
];
const defaultSettings = () => ({ background: 'stars', motion: true, volume: .7, backgroundImage: null, cloakTitle: 'Class notes', cloakIcon: 'notes', cloakEnabled: false, panicEnabled: true, panicKey: 'u', startupCover: false });
const state = {
  user: null, entries: [], favorites: new Set(), notes: '', loading: true, error: '',
  settings: defaultSettings(),
  route: location.pathname.endsWith('apps.html') ? 'apps' : 'home',
  query: '', filter: 'All', mediaFilter: 'TV Shows', soundFavorites: false, soundSource: 'real', signupAllowed: true,
};
let loadSequence = 0;
let toastTimeout;
let activePlayer = null;
let playerTrigger;
let timerEnd = null;
let timerMinutes = 25;
let timerRemaining = timerMinutes * 60;
let timerTick;
let paintDrawing = false;
let notesDirty = false;
let notesDraft = '';
const main = $('#main');
let backgroundDraft = null;
let backgroundPreview = '';
let embedTimeout;
let lastEmbedUrl = '';
let suspendedSoundboard = '';
let startupChecked = false;

function toast(message) {
  clearTimeout(toastTimeout);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 4500);
}
async function request(method = 'GET', body) {
  const response = await fetch('/api/library', {
    method, credentials: 'same-origin', cache: 'no-store',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('The library is unavailable. Please try again.'); }
  if (!response.ok) throw new Error(result.error || 'Could not save. Please try again.');
  return result;
}
function syncStatus() {
  const el = $('#sync-state');
  el.textContent = state.loading ? 'Connecting library' : state.error ? 'Library offline' : state.user ? 'Library synced' : 'Community library';
  el.classList.toggle('failed', Boolean(state.error));
}
async function loadLibrary({ render = true } = {}) {
  const sequence = ++loadSequence;
  state.loading = true; syncStatus();
  try {
    const result = await request();
    if (sequence !== loadSequence) return;
    state.entries = result.entries;
    state.favorites = new Set(result.favorites);
    state.notes = result.profile?.notes || '';
    if (!notesDirty) notesDraft = state.notes;
    if (result.profile?.settings && Object.keys(result.profile.settings).length) state.settings = { ...state.settings, ...result.profile.settings };
    if (backgroundDraft) state.settings.background = 'custom';
    state.error = ''; applySettings();
  } catch (error) {
    if (sequence !== loadSequence) return;
    state.error = error.message;
  } finally {
    if (sequence === loadSequence) {
      state.loading = false; syncStatus();
      if (render && !['paint', 'calculator', 'timer', 'terminal'].includes(state.route) && !(state.route === 'notes' && notesDirty) && !(state.route === 'soundboard' && state.soundSource === 'real')) renderPage();
    }
  }
}
function applySettings() {
  document.body.dataset.background = state.settings.background;
  document.body.dataset.motion = state.settings.motion ? 'on' : 'off';
  setVolume(state.settings.volume);
  const layer = $('#custom-background');
  const src = backgroundPreview || (state.settings.backgroundImage?.key ? `/api/background?key=${encodeURIComponent(state.settings.backgroundImage.key)}` : '');
  layer.style.backgroundImage = src ? `url(${JSON.stringify(src)})` : '';
  applyTab(state.settings, state.route);
}

function allGames() {
  return [...games, ...state.entries.filter(e => e.kind === 'game').map(customItem)];
}
function customItem(entry) {
  return { ...entry, key: `saved:${entry.id}`, color: entry.visibility === 'private' ? '#976f9f' : '#b37b98', monogram: entry.title.slice(0, 2).toUpperCase(), category: entry.visibility === 'private' ? 'Private' : 'Community', saved: true };
}
function findItem(key) {
  return [...allGames(), ...apps, ...media, ...state.entries.filter(e => e.kind === 'link').map(customItem)].find(item => item.key === key);
}
function heading(title, description, number, action = '') {
  return `<div class="page-heading"><div><span class="eyebrow">NATR / ${esc(title.toUpperCase())}</span><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action || `<span class="page-number">[ ${number} ]</span>`}</div>`;
}
function search(placeholder, id = 'catalog-search', value = state.query) {
  return `<div class="search-box"><input id="${id}" type="search" autocomplete="off" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" value="${esc(value)}">${icon('search')}</div>`;
}
function chips(labels, active = state.filter) {
  return labels.map(label => `<button class="filter ${label === active ? 'active' : ''}" data-filter="${esc(label)}" aria-pressed="${label === active}">${label === 'Favorites' ? icon('heart') : ''}${esc(label)}</button>`).join('');
}
function libraryNotice() {
  if (state.error) return `<div class="notice"><p>${esc(state.error)} Built-in games are still available.</p><button class="subtle-button" data-action="retry">Retry</button></div>`;
  if (state.loading) return '<div class="loading-row"><span></span>Loading saved games…</div>';
  return '';
}
function empty(title, description, action = '') {
  return `<div class="empty-state">${icon('sparkles')}<h3>${esc(title)}</h3><p>${esc(description)}</p>${action}</div>`;
}
function artwork(item) {
  const png = ['1v1', '2048', 'pool', 'adofai'].includes(item.id) && item.kind === 'game';
  const image = png ? `/assets/games/${item.id}.png` : item.image;
  if (image) return `<img class="card-art" src="${esc(image)}" alt="${esc(item.title)}" loading="lazy" width="400" height="${item.kind === 'media' ? 600 : 225}">`;
  return `<div class="card-art monogram-art" style="--art:${esc(item.color)}">${item.logo ? `<img src="${esc(item.logo)}" alt="" width="52" height="52">` : `<b>${esc(item.monogram || item.title.slice(0, 2).toUpperCase())}</b>`}<small>${esc(item.kind === 'app' ? item.category : item.saved ? new URL(item.url).hostname : 'NATR COLLECTION')}</small></div>`;
}
function card(item) {
  const favorite = state.favorites.has(item.key);
  const label = item.kind === 'media' ? 'View options' : item.kind === 'app' ? 'Open app' : 'Play';
  return `<article class="card" style="--art:${esc(item.color || '#71435f')}">
    <button class="favorite ${favorite ? 'is-favorite' : ''}" data-favorite="${esc(item.key)}" aria-label="${favorite ? 'Unfavorite' : 'Favorite'} ${esc(item.title)}" aria-pressed="${favorite}">${icon('heart')}</button>
    ${artwork(item)}<div class="card-info"><h3 title="${esc(item.title)}">${esc(item.title)}</h3><div class="card-meta"><span>${esc(item.category)}</span>${item.canDelete ? `<button class="delete-entry" data-delete="${item.id}" aria-label="Remove ${esc(item.title)}">Remove</button>` : '<span>↗</span>'}</div></div>
    <button class="play-button" data-play="${esc(item.key)}">${label} ${icon(item.kind === 'game' ? 'play' : 'maximize-2')}</button>
  </article>`;
}
function renderHome() {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const date = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  return `<div class="home-layout"><section class="home-intro"><span class="eyebrow">WELCOME TO YOUR ORBIT</span><h1 class="day">${weekday}</h1><p class="date-line">${date}</p><form id="home-search">${search('Find your next game…', 'home-query', '')}</form><p class="home-message">A few games. A little escape.</p><div class="social-shortcuts">${apps.filter(a => ['tiktok','youtube','discord','instagram'].includes(a.id)).map(a => `<button class="social-shortcut" data-play="${a.key}" title="${a.title}" aria-label="${a.title}"><img src="${a.logo}" alt=""></button>`).join('')}</div></section><section class="home-main" aria-label="Featured games"><div class="section-label"><h2>IN THE SPOTLIGHT</h2><a class="text-link" href="#games">All games ↗</a></div><div class="featured-grid">${[games[5], games[11], games[6]].map(card).join('')}</div><div class="home-banner"><div><h2>Make room for one more.</h2><p>Paste a game link and save it for everyone,<br>or keep a private collection of your own.</p></div><button class="primary" data-action="add-game">${icon('plus')} Add game</button></div><div class="home-links"><a class="home-tile" href="#apps">${icon('users-round')}<span><b>Your social corner</b><small>TikTok, Discord + more ↗</small></span></a><a class="home-tile" href="#soundboard">${icon('audio-lines')}<span><b>Make some noise</b><small>Soundboard & text-to-speech ↗</small></span></a></div></section></div><div class="home-bottom"><span>Built for the tabs you actually want open.</span><span class="line"></span><b>${allGames().length} GAMES / ${apps.length} APPS / ENDLESS DETOURS</b></div>`;
}
function catalogContent() {
  if (state.route === 'games') {
    let list = allGames();
    if (state.filter === 'Favorites') list = list.filter(item => state.favorites.has(item.key));
    else if (state.filter === 'Community') list = list.filter(item => item.saved && item.visibility === 'public');
    else if (state.filter === 'My library') list = list.filter(item => item.saved && item.visibility === 'private');
    else if (state.filter !== 'All') list = list.filter(item => item.category === state.filter);
    list = list.filter(item => item.title.toLowerCase().includes(state.query.toLowerCase()));
    return { list, className: '', emptyTitle: state.filter === 'My library' && !state.user ? 'Your own collection' : state.filter === 'Favorites' ? 'Keep the good ones close.' : 'No games found.', emptyText: state.filter === 'My library' && !state.user ? 'Sign in to save games privately and find them on every device.' : state.query ? 'Try a different name or add a game link.' : 'Add a game, or tap a heart to save a favorite.' };
  }
  if (state.route === 'apps') {
    let list = apps.filter(item => state.filter === 'All' || (state.filter === 'Favorites' ? state.favorites.has(item.key) : item.category === state.filter));
    return { list: list.filter(item => item.title.toLowerCase().includes(state.query.toLowerCase())), className: 'app-grid', emptyTitle: 'No apps here yet.', emptyText: state.filter === 'Favorites' ? 'Tap a heart to add apps to your favorites.' : 'Try a different search or category.' };
  }
  let list = media.filter(item => item.category === state.mediaFilter && (state.filter !== 'Favorites' || state.favorites.has(item.key)));
  return { list: list.filter(item => item.title.toLowerCase().includes(state.query.toLowerCase())), className: 'poster-grid', emptyTitle: 'Nothing in this orbit.', emptyText: 'Try another search, category, or favorite some titles.' };
}
function renderCatalog() {
  const isGames = state.route === 'games', isApps = state.route === 'apps';
  const title = isGames ? 'Games' : isApps ? 'Apps & social' : 'Watch. Read. Listen.';
  const description = isGames ? 'Old favorites, new obsessions, and whatever you bring next.' : isApps ? 'Open an in-app window, or watch a public video with an official player.' : 'Titles from your screenshots. Find streaming availability, manga, and music.';
  const filters = isGames ? ['All', 'Favorites', 'Community', 'My library', 'Arcade', 'Puzzle', 'Action', 'Multiplayer', 'Sandbox', 'Sports', 'Rhythm', 'Adventure'] : isApps ? ['All', 'Favorites', 'Social', 'Messaging', 'Video', 'Music', 'Tools'] : ['TV Shows', 'Movies', 'Manga', 'Music'];
  return `${heading(title, description, isGames ? '02' : isApps ? '04' : '05', isGames ? `<button class="primary" data-action="add-game">${icon('plus')} Add game</button>` : '')}<div class="search-row">${search(isGames ? 'Search games…' : isApps ? 'Search apps…' : 'Search titles…')}</div><div class="filters">${chips(filters, state.route === 'media' ? state.mediaFilter : state.filter)}${state.route === 'media' ? `<button class="filter ${state.filter === 'Favorites' ? 'active' : ''}" data-action="media-favorites" aria-pressed="${state.filter === 'Favorites'}">${icon('heart')} Favorites</button>` : ''}<span class="count" id="catalog-count"></span></div>${isGames ? libraryNotice() : ''}${state.route === 'media' ? '<p class="muted" style="font-size:11px">TV and movie cards show viewing options on JustWatch. Availability and subscriptions vary by region.</p>' : ''}<div id="catalog-grid"></div>`;
}
function updateCatalog() {
  const { list, className, emptyTitle, emptyText } = catalogContent();
  $('#catalog-grid').className = `grid ${className}`;
  $('#catalog-grid').innerHTML = list.length ? list.map(card).join('') : empty(emptyTitle, emptyText, !state.user && ['My library','Favorites'].includes(state.filter) ? '<button class="subtle-button" data-action="account">Sign in</button>' : '');
  $('#catalog-count').textContent = `${list.length} ${state.route === 'games' ? 'games' : state.route === 'apps' ? 'apps' : 'titles'}`;
  refreshIcons();
}
function renderTools() {
  return `${heading('Tools', 'Useful things, creative detours, and a little nostalgia.', '03')}<div class="search-row">${search('Search tools…')}</div><div class="tool-grid" id="tools-grid"></div>`;
}
function updateTools() {
  const list = tools.filter(tool => `${tool.title} ${tool.description}`.toLowerCase().includes(state.query.toLowerCase()));
  $('#tools-grid').innerHTML = list.length ? list.map(tool => `<a class="tool-card" href="${tool.route ? `#${tool.route}` : tool.url}" ${tool.url ? 'target="_blank" rel="noopener noreferrer"' : ''} style="--art:${tool.color}"><div class="tool-icon">${icon(tool.icon)}</div><h3>${esc(tool.title)} ${tool.url ? '↗' : ''}</h3><p>${esc(tool.description)}</p></a>`).join('') : empty('No tools found.', 'Try a different search.');
  refreshIcons();
}
function renderLinks() {
  const links = state.entries.filter(item => item.kind === 'link').map(customItem);
  return `${heading('Links', 'Good places to end up. Save a shortcut for later.', '06', `<button class="primary" data-action="add-link">${icon('plus')} Add link</button>`)}${libraryNotice()}<div class="tool-grid">${[
    ['GitHub', 'Code, projects, and open-source discoveries.', 'https://github.com/', 'terminal'],
    ['Internet Archive', 'A library of internet history.', 'https://archive.org/', 'book-open'],
    ['itch.io', 'Find your next indie game.', 'https://itch.io/games/html5', 'gamepad-2'],
    ['Coolmath Games', 'Puzzles and browser games.', 'https://www.coolmathgames.com/', 'puzzle'],
  ].map(([title, text, url, image]) => `<a class="tool-card" href="${url}" target="_blank" rel="noopener noreferrer" style="--art:#c18dad"><div class="tool-icon">${icon(image)}</div><h3>${title} ↗</h3><p>${text}</p></a>`).join('')}${links.map(item => `<article class="tool-card" style="--art:#c18dad"><div class="tool-icon">${icon('link')}</div><h3>${esc(item.title)}</h3><p>${esc(new URL(item.url).hostname)} / ${esc(item.visibility)}</p><a class="text-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Open link ↗</a>${item.canDelete ? `<button class="delete-entry" style="float:right" data-delete="${item.id}">Remove</button>` : ''}</article>`).join('')}</div>`;
}
function signInNotice(message) {
  return `<div class="notice"><p>${esc(message)}</p><button class="subtle-button" data-action="account">Sign in</button></div>`;
}
function renderNotes() {
  return `${heading('Notes', 'Ideas, reminders, and things you don’t want to forget.', '07')}${!state.user ? signInNotice('Sign in to save your notes privately and sync them across devices.') : ''}${state.error ? `<p class="error">${esc(state.error)} Your edits stay on this page until you retry saving.</p>` : ''}<div class="panel"><label class="eyebrow" for="notes-area">YOUR SPACE / PRIVATE TO YOUR ACCOUNT</label><textarea class="notes-area" id="notes-area" maxlength="20000" placeholder="Start somewhere…" ${!state.user ? 'disabled' : ''}>${esc(notesDraft)}</textarea><div class="notes-toolbar"><span id="notes-status">${notesDirty ? 'Unsaved changes' : state.user ? 'Ready to write' : 'Sign-in required'}</span><button class="primary" data-action="save-notes" ${!state.user || state.loading ? 'disabled' : ''}>${icon('save')} Save notes</button></div></div>`;
}
function backgroundSettings() {
  const image = backgroundDraft || state.settings.backgroundImage;
  const resolution = image ? `${image.width} × ${image.height}${image.width >= 3840 && image.height >= 2160 ? ' · 4K-ready' : ' · native resolution'}` : 'No uploaded background';
  return `<section class="panel"><h2>Appearance</h2><p>Sharp at 4K. Built-in backgrounds scale with your screen; uploads keep their pixel dimensions.</p><div class="settings-row"><div><strong>Background</strong><small>Choose your atmosphere.</small></div><select id="background-select" aria-label="Background">${[['stars','Floating stars'],['waves','Pink waves'],['aurora','4K Aurora'],...(image ? [['custom','Uploaded image']] : []),['off','Solid dark']].map(([v,l]) => `<option value="${v}" ${state.settings.background === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="settings-row"><div><strong>Moving backgrounds</strong><small>Respects your device’s reduced-motion setting.</small></div><input id="motion-toggle" type="checkbox" aria-label="Moving backgrounds" ${state.settings.motion ? 'checked' : ''}></div><div class="background-upload"><h3>Your background</h3><p>JPEG, PNG, or WebP. Upload a 3840 × 2160 image or larger for 4K. Large files are optimized to fit 4 MB without resizing.</p><input id="background-file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload background"><div class="background-preview" id="background-preview"><span id="background-dimensions">${esc(resolution)}</span></div><p id="background-error" class="error" role="alert"></p><div class="button-row"><button class="primary" data-action="upload-background" ${!backgroundDraft ? 'disabled' : ''}>${icon('save')} Save background</button><button class="subtle-button" data-action="clear-background" ${!image ? 'disabled' : ''}>Remove image</button></div><p style="margin:14px 0 0">${state.user ? 'Saved uploads stay private to your account.' : 'Preview now. Sign in to save your upload across visits.'}</p></div><div class="settings-row"><div><strong>Synth lab volume</strong><small>The live soundboard has its own sound controls.</small></div><input id="settings-volume" type="range" min="0" max="1" step=".01" value="${state.settings.volume}" aria-label="Soundboard volume"></div><button class="primary" style="margin-top:20px" data-action="save-settings" ${!state.user ? 'disabled' : ''}>${icon('save')} Save preferences</button></section>`;
}
function renderSettings() {
  return `${heading('Make it yours.', 'Your background, your tab, your little corner.', '08')}${!state.user ? signInNotice('Preview changes now. Sign in to keep preferences and uploads across visits.') : ''}<div class="settings-grid">${backgroundSettings()}<section class="panel"><h2>Cloaking & cover</h2><p>Change your tab’s name and icon, or put a blocked-page cover over natr.</p><div class="settings-row"><div><strong>Tab cloaking</strong><small>${esc(state.settings.cloakEnabled ? state.settings.cloakTitle : 'Keep the natr title and icon.')}</small></div><button class="subtle-button" data-action="open-cloak">Configure</button></div><label class="settings-field"><input type="checkbox" id="panic-toggle" ${state.settings.panicEnabled ? 'checked' : ''}>Enable privacy shortcut</label><label class="settings-field">Shortcut key<input class="input" id="panic-key" maxlength="1" value="${esc(state.settings.panicKey)}" aria-label="Privacy shortcut key"></label><p>Press the key while natr has focus, outside a text field. When an embedded app has focus, use the Cover button.</p><label class="settings-field"><input type="checkbox" id="startup-cover" ${state.settings.startupCover ? 'checked' : ''}>Show blocked-page cover on startup</label><div class="privacy-actions"><button class="primary" data-action="show-cover">Preview cover</button><button class="subtle-button" data-action="save-settings" ${!state.user ? 'disabled' : ''}>Save privacy settings</button></div><p style="margin-top:20px">The cover is a local privacy screen, styled like a web filter. It does not change any network filtering.</p></section><section class="panel"><h2>Your account</h2><p>${state.user ? `Signed in as ${esc(state.user.email)}. Your private games, notes, favorites, and preferences follow you across devices.` : 'Sign in for a private game library, synced favorites, backgrounds, and notes. The community library is open to everyone.'}</p><button class="subtle-button" data-action="account">${icon('user-round')} ${state.user ? 'Manage account' : 'Sign in / Create account'}</button><div class="settings-row"><div><strong>Take your library with you</strong><small>Download game links as a CSV file.</small></div><button class="icon-button" data-action="export-library" title="Download library" aria-label="Download library">${icon('download')}</button></div><p class="muted" style="margin-top:22px">natr / made for a little escape.</p></section></div>`;
}
function renderSoundboard() {
  const tabs = `<div class="sound-source-tabs"><button class="filter ${state.soundSource === 'real' ? 'active' : ''}" data-sound-source="real" aria-pressed="${state.soundSource === 'real'}">Sound Buttons World</button><button class="filter ${state.soundSource === 'synth' ? 'active' : ''}" data-sound-source="synth" aria-pressed="${state.soundSource === 'synth'}">Synth lab & speech</button></div>`;
  if (state.soundSource === 'real') return `${heading('Soundboard', 'The actual trending sound buttons, right here in natr.', '03 / A')}${tabs}<p class="source-description">Live from Sound Buttons World. Play the original clips using the buttons below; the website stays inside this page.</p><div class="real-sound-host"><iframe id="real-soundboard" class="real-soundboard" title="Sound Buttons World trending soundboard" src="${audioState.muted ? 'about:blank' : 'https://soundbuttonsworld.com/trends?page=1'}" allow="autoplay" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads" ${audioState.muted ? 'hidden' : ''}></iframe><div id="real-sound-muted" class="empty-state" ${audioState.muted ? '' : 'hidden'}>${icon('volume-x')}<h3>Soundboard muted.</h3><p>Unmute in the sidebar to load the live soundboard again.</p></div></div><div class="sound-source-note"><p>Provided by Sound Buttons World · audio and availability are managed by the source.</p><div class="toolbar-group"><button class="subtle-button" data-action="stop-live-sounds">${icon('square')} Stop audio</button><button class="icon-button" data-action="reload-soundboard" aria-label="Reload soundboard">${icon('rotate-cw')}</button></div></div>`;
  return `${heading('Soundboard', 'Original synth effects and browser voices.', '03 / A')}${tabs}<div class="sound-panel"><div class="sound-controls"><button class="filter ${state.soundFavorites ? 'active' : ''}" data-action="sound-favorites" aria-pressed="${state.soundFavorites}">${icon('heart')} Favorites: ${state.soundFavorites ? 'ON' : 'OFF'}</button><button class="filter ${audioState.overlap ? 'active' : ''}" data-action="overlap" aria-pressed="${audioState.overlap}">Overlap: ${audioState.overlap ? 'ON' : 'OFF'}</button><button class="filter" data-action="stop-sounds">${icon('square')} Stop all sounds</button><input id="sound-search" type="search" placeholder="Search sounds…" aria-label="Search sounds"><button class="filter" data-action="focus-tts">Text-to-speech</button></div><div id="sound-grid" class="sound-grid"></div><div class="sound-footer"><label>${icon('volume-2')}<input id="sound-volume" type="range" min="0" max="1" step=".01" value="${state.settings.volume}" aria-label="Soundboard volume"><span id="sound-volume-label">${Math.round(state.settings.volume * 100)}%</span></label><p>Original synthesized effects & browser voices.</p></div><form class="tts-panel" id="tts-form"><input id="tts-text" class="input" maxlength="500" placeholder="Give your thoughts a voice…" aria-label="Text to speak" required><button class="primary" type="submit">${icon('audio-lines')} Speak</button></form></div>`;
}
function updateSounds() {
  const q = $('#sound-search')?.value.toLowerCase() || '';
  const list = sounds.filter(sound => sound.title.toLowerCase().includes(q) && (!state.soundFavorites || state.favorites.has(sound.key)));
  $('#sound-grid').innerHTML = list.length ? list.map(sound => `<div class="sound-item"><button class="sound-pad" data-sound="${sound.id}" style="--pad:${sound.color}" aria-label="Play ${esc(sound.title)}"></button><span class="sound-label">${esc(sound.title)}</span><button class="sound-favorite ${state.favorites.has(sound.key) ? 'selected' : ''}" data-favorite="${sound.key}" aria-label="${state.favorites.has(sound.key) ? 'Unfavorite' : 'Favorite'} ${esc(sound.title)}" aria-pressed="${state.favorites.has(sound.key)}">${state.favorites.has(sound.key) ? '♥' : '♡'}</button></div>`).join('') : empty('A quieter corner.', 'Search another sound or add a few favorites.');
}
function renderTerminal() {
  return `${heading('Command line', 'A shortcut to wherever you want to go.', '09')}<div class="terminal"><pre id="terminal-output" class="terminal-output">natr / command line\n\nType help to see available commands.\nThis is a navigation terminal; it does not run system commands.</pre><form id="terminal-form"><label for="terminal-command">natr &gt;</label><input id="terminal-command" autocomplete="off" spellcheck="false" aria-label="Command"><button class="icon-button" aria-label="Run command">${icon('arrow-up-right')}</button></form></div><p class="terminal-help">Try: games · apps · soundboard · background waves · clear</p>`;
}
function renderCalculator() {
  return `${heading('Calculator', 'Keep the numbers simple.', '03 / B')}<div class="panel calculator"><output id="calc-output" aria-live="polite">${esc(calcValue)}</output><div class="calculator-keys">${['C','⌫','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','±','0','.','='].map(key => `<button data-calc="${key}" class="${key === '=' ? 'equals' : ''}">${key}</button>`).join('')}</div></div>`;
}
function renderTimer() {
  return `${heading('Focus timer', 'One small stretch of uninterrupted time.', '03 / C')}<div class="panel timer-panel"><span class="eyebrow">A MOMENT TO FOCUS</span><div class="timer-display" id="timer-display" aria-live="off"></div><div class="timer-input"><label for="timer-minutes">Minutes</label><input class="input" id="timer-minutes" type="number" min="1" max="180" value="${timerMinutes}" ${timerEnd ? 'disabled' : ''}></div><div class="timer-actions"><button class="primary" data-action="toggle-timer">${timerEnd ? 'Pause' : 'Start'}</button><button class="subtle-button" data-action="reset-timer">Reset</button></div><p id="timer-status">${timerEnd ? 'Timer is running. It continues as you browse natr.' : 'Pick a length and settle in.'}</p></div>`;
}
function renderPaint() {
  return `${heading('Pixel canvas', 'Leave a little color behind.', '03 / D')}<div class="panel"><div class="paint-toolbar"><label>Color <input id="paint-color" type="color" value="#df6dac"></label><label>Brush <input id="paint-size" type="range" min="1" max="40" value="8"></label><button class="filter" data-action="clear-canvas">Clear</button><button class="filter" data-action="save-canvas">${icon('download')} Download PNG</button><span class="muted">Download your drawing before leaving this page.</span></div><canvas id="paint-canvas" width="1000" height="550" aria-label="Drawing canvas"></canvas></div>`;
}
function renderPage() {
  if (!main) return;
  const titles = { home: 'home', games: 'games', apps: 'apps', tools: 'tools', media: 'media', links: 'links', notes: 'notes', settings: 'settings', terminal: 'terminal', soundboard: 'soundboard', calculator: 'calculator', timer: 'timer', paint: 'canvas' };
  if (!titles[state.route]) state.route = 'home';
  $('#section-name').textContent = titles[state.route];
  applyTab(state.settings, state.route);
  $$('#navigation a').forEach(a => { const active = a.hash === `#${state.route}` || (a.hash === '#tools' && ['soundboard','calculator','timer','paint'].includes(state.route)); a.classList.toggle('active', active); if (active) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  const pages = { home: renderHome, games: renderCatalog, apps: renderCatalog, media: renderCatalog, tools: renderTools, links: renderLinks, notes: renderNotes, settings: renderSettings, soundboard: renderSoundboard, terminal: renderTerminal, calculator: renderCalculator, timer: renderTimer, paint: renderPaint };
  main.innerHTML = pages[state.route]();
  if (['games','apps','media'].includes(state.route)) updateCatalog();
  if (state.route === 'tools') updateTools();
  if (state.route === 'soundboard' && state.soundSource === 'synth') updateSounds();
  if (state.route === 'timer') updateTimerDisplay();
  if (state.route === 'paint') initCanvas();
  if (state.route === 'settings') updateBackgroundPreview();
  refreshIcons();
}
function navigate(route, query = '') {
  state.route = route; state.query = query; state.filter = 'All';
  renderPage(); window.scrollTo({ top: 0, behavior: 'instant' });
}
window.addEventListener('hashchange', () => {
  if (location.hash.includes('token=')) return;
  const route = location.hash.slice(1) || 'home';
  if (route !== state.route) navigate(route);
});

function openAdd(kind = 'game') {
  const dialog = $('#add-dialog');
  $('#add-form').reset(); $('#add-error').textContent = '';
  dialog.dataset.kind = kind;
  $('#add-title').textContent = kind === 'game' ? 'Add a game' : 'Add a link';
  $('#add-form button[type=submit]').innerHTML = `${kind === 'game' ? 'Add game' : 'Add link'} ${icon('plus')}`;
  dialog.showModal(); refreshIcons();
}
$('#add-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const value = Object.fromEntries(new FormData(form));
  if (value.visibility === 'private' && !state.user) { $('#add-error').textContent = 'Sign in using the account button first, then save to your private library.'; return; }
  try {
    const url = new URL(value.url.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an http:// or https:// link without login details.');
  } catch { $('#add-error').textContent = 'Paste a complete public website link starting with https://.'; return; }
  const submit = $('button[type=submit]', form);
  submit.disabled = true; submit.textContent = 'Saving…'; $('#add-error').textContent = '';
  try {
    const item = await request('POST', { ...value, kind: $('#add-dialog').dataset.kind });
    state.entries.unshift(item);
    $('#add-dialog').close();
    toast(item.visibility === 'private' ? 'Saved to your private library.' : 'Added to the community library.');
    renderPage();
  } catch (error) { $('#add-error').textContent = error.message; }
  finally { submit.disabled = false; submit.innerHTML = `Add ${$('#add-dialog').dataset.kind} ${icon('plus')}`; refreshIcons(); }
});
async function toggleFavorite(key, button) {
  if (!state.user) { openAuth(); return; }
  const enabled = !state.favorites.has(key);
  button.disabled = true;
  try {
    await request('PUT', { action: 'favorite', key, enabled });
    if (enabled) state.favorites.add(key); else state.favorites.delete(key);
    if (['games','apps','media'].includes(state.route)) updateCatalog();
    else if (state.route === 'soundboard' && state.soundSource === 'synth') updateSounds();
    else renderPage();
    toast(enabled ? 'Added to your favorites.' : 'Removed from favorites.');
  } catch (error) { toast(error.message); button.disabled = false; }
}
async function deleteEntry(id, button) {
  // Two clicks make removal deliberate without a blocking browser confirmation.
  if (!button.dataset.confirm) { button.dataset.confirm = 'yes'; button.textContent = 'Remove? Click again'; return; }
  button.disabled = true;
  try { await request('DELETE', { id: Number(id) }); state.entries = state.entries.filter(item => item.id !== Number(id)); renderPage(); toast('Removed from the library.'); }
  catch (error) { button.disabled = false; toast(error.message); }
}
function embedNotice(reason) {
  clearTimeout(embedTimeout);
  const panel = document.createElement('div'); panel.className = 'embed-notice';
  panel.innerHTML = `${icon('monitor')}<h2>Stay in natr.</h2><p>${esc(reason)}</p><form id="public-embed-form" class="public-embed-form"><label for="public-embed-url">Try a public video, post, track, or channel link</label><div><input id="public-embed-url" class="input" type="url" placeholder="https://www.youtube.com/watch?v=…" required><button class="primary" type="submit">Load player</button></div><p id="public-embed-error" class="error" role="alert"></p></form><p class="embed-small">Full social feeds and sign-in pages may require the original app. Your natr library stays open here.</p><button class="subtle-button" data-action="retry-embed">Try original inside natr</button>`;
  $('#player-screen').replaceChildren(panel); refreshIcons();
}
function mountEmbed(url) {
  clearTimeout(embedTimeout); lastEmbedUrl = url;
  const screen = $('#player-screen'); screen.replaceChildren();
  const loading = document.createElement('div'); loading.className = 'embed-loading'; loading.innerHTML = '<span>Opening inside natr…</span>'; screen.append(loading);
  const frame = document.createElement('iframe');
  frame.src = url; frame.title = activePlayer?.title || 'Embedded website';
  frame.setAttribute('allow', 'fullscreen; gamepad; autoplay; encrypted-media; picture-in-picture');
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads allow-presentation');
  frame.allowFullscreen = true;
  frame.addEventListener('load', () => loading.remove());
  frame.addEventListener('error', () => embedNotice('This website could not load inside an embedded player. Try a supported public link instead.'));
  screen.append(frame);
  // Cross-origin pages do not expose reliable frame-blocking errors. Always keep an explicit help control.
  embedTimeout = setTimeout(() => loading.remove(), 9000);
}
function openPlayer(item) {
  playerTrigger = document.activeElement; activePlayer = item;
  $('#player-title').textContent = item.title;
  $('#player-original').href = item.url; $('#player-fallback').href = item.url;
  $('#restore-player').hidden = true;
  if (!$('#player').open) $('#player').showModal();
  const plan = embedPlan(item,location.hostname);
  if (plan.blocked) embedNotice(plan.reason); else mountEmbed(plan.url);
}
async function closePlayer() {
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  clearTimeout(embedTimeout);
  $('#player-screen').replaceChildren(); activePlayer = null; lastEmbedUrl = '';
  $('#player').close(); $('#restore-player').hidden = true;
  playerTrigger?.focus();
}
$('#close-player').addEventListener('click', closePlayer);
$('#player').addEventListener('cancel', event => { event.preventDefault(); void closePlayer(); });
$('#minimize-player').addEventListener('click', async () => {
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  $('#player').close(); $('#restore-player').hidden = false;
});
$('#restore-player').addEventListener('click', () => { $('#player').showModal(); $('#restore-player').hidden = true; });
$('#reload-player').addEventListener('click', () => { if (activePlayer) openPlayer(activePlayer); });
$('#fullscreen-player').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('.player-window').requestFullscreen(); }
  catch { toast('Fullscreen is unavailable in this browser.'); }
});

function authShell(content, label = 'YOUR NATR ACCOUNT') {
  return `<div class="dialog-heading"><span class="eyebrow">${label}</span><button class="icon-button" data-close="auth-dialog" aria-label="Close">${icon('x')}</button></div>${content}`;
}
function openAuth(mode = state.user ? 'account' : 'login') {
  const container = $('#auth-content');
  container.dataset.mode = mode;
  if (mode === 'account' && state.user) {
    container.innerHTML = authShell(`<h2>Your orbit.</h2><p>${esc(state.user.email)}</p><p>Your private library, favorites, notes, and preferences are saved to your account.</p><button class="primary full-width" data-action="logout">${icon('log-out')} Sign out</button>`);
  } else {
    const title = { login: 'Welcome back.', signup: 'Make yourself at home.', recover: 'Forgot your password?', reset: 'A fresh start.' }[mode];
    container.innerHTML = authShell(`<h2>${title}</h2><p>${mode === 'recover' ? 'Enter your email for a password reset link.' : mode === 'reset' ? 'Choose a new password for your account.' : 'Save your favorites and private library across devices.'}</p>${['login','signup'].includes(mode) ? `<div class="auth-tabs"><button class="filter ${mode === 'login' ? 'active' : ''}" data-auth="login">Sign in</button>${state.signupAllowed ? `<button class="filter ${mode === 'signup' ? 'active' : ''}" data-auth="signup">Create account</button>` : ''}</div>` : ''}<form id="auth-form">${mode === 'signup' ? '<label>Name<input name="name" maxlength="80" autocomplete="nickname" placeholder="What should we call you?" required></label>' : ''}${mode !== 'reset' ? '<label>Email<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>' : ''}${mode !== 'recover' ? `<label>Password<input name="password" type="password" minlength="8" maxlength="128" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required placeholder="At least 8 characters"></label>` : ''}<p class="error" id="auth-error" role="alert"></p><p id="auth-success" role="status"></p><button class="primary full-width" type="submit">${mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'recover' ? 'Send reset link' : 'Update password'}</button></form><div class="auth-foot"><button class="auth-text-button" data-auth="${mode === 'login' ? 'recover' : 'login'}">${mode === 'login' ? 'Forgot password?' : 'Back to sign in'}</button></div>`);
  }
  if (!$('#auth-dialog').open) $('#auth-dialog').showModal();
  refreshIcons();
}
async function updateAccount() {
  state.user = await getUser();
  $('#account-button span').textContent = state.user?.name || (state.user ? 'My account' : 'Sign in');
}
async function authSubmit(form) {
  const mode = $('#auth-content').dataset.mode;
  const values = Object.fromEntries(new FormData(form));
  const button = $('button[type=submit]', form); button.disabled = true;
  $('#auth-error').textContent = ''; $('#auth-success').textContent = '';
  try {
    if (mode === 'recover') { await requestPasswordRecovery(values.email); $('#auth-success').textContent = 'If the address has an account, check its inbox for a reset link.'; }
    else if (mode === 'reset') { await updateUser({ password: values.password }); $('#auth-dialog').close(); toast('Password updated.'); }
    else if (mode === 'signup') {
      const user = await signup(values.email, values.password, { full_name: values.name });
      if (user.emailVerified) { $('#auth-dialog').close(); toast('Welcome to natr.'); }
      else $('#auth-success').textContent = 'Check your inbox to confirm your account, then sign in.';
    } else { await login(values.email, values.password); $('#auth-dialog').close(); toast('Welcome back.'); }
    await updateAccount();
    if (!['recover','signup'].includes(mode) || state.user) await loadLibrary();
  } catch (error) {
    $('#auth-error').textContent = error.status === 401 ? 'Check your email and password, and confirm your email if needed.' : error.status === 403 ? 'Account creation is currently closed. An invitation may be required.' : error.message || 'Unable to sign in. Please try again.';
  } finally { if (button.isConnected) button.disabled = false; }
}
let calcValue = '0', calcPrevious = null, calcOperator = null, calcFresh = true;
function calculate(key) {
  const operations = { '+': (a,b) => a+b, '−': (a,b) => a-b, '×': (a,b) => a*b, '÷': (a,b) => b === 0 ? NaN : a/b };
  if (key === 'C') { calcValue = '0'; calcPrevious = null; calcOperator = null; calcFresh = true; }
  else if (key === '⌫') { calcValue = calcValue.length > 1 ? calcValue.slice(0,-1) : '0'; }
  else if (key === '±') { calcValue = String(-Number(calcValue)); }
  else if (key === '%') { calcValue = String(Number(calcValue) / 100); }
  else if (operations[key] || key === '=') {
    if (calcOperator && calcPrevious !== null && !calcFresh) {
      const result = operations[calcOperator](calcPrevious, Number(calcValue));
      calcValue = Number.isFinite(result) ? String(Number(result.toPrecision(12))) : 'Error';
    }
    calcPrevious = Number(calcValue); calcOperator = key === '=' ? null : key; calcFresh = true;
  } else {
    if (calcValue === 'Error' || calcFresh) { calcValue = '0'; calcFresh = false; }
    if (key === '.') { if (!calcValue.includes('.')) calcValue += '.'; }
    else if (calcValue.replace('-','').length < 14) calcValue = calcValue === '0' ? key : calcValue + key;
  }
  $('#calc-output').textContent = calcValue;
}
function updateTimerDisplay() {
  if (!$('#timer-display')) return;
  const seconds = timerEnd ? Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000)) : timerRemaining;
  $('#timer-display').textContent = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
}
function startTimer() {
  if (timerEnd) { timerRemaining = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000)); timerEnd = null; clearInterval(timerTick); }
  else {
    if (timerRemaining <= 0) timerRemaining = Math.max(1, Math.min(180, Number($('#timer-minutes').value) || 25)) * 60;
    timerEnd = Date.now() + timerRemaining * 1000;
    timerTick = setInterval(() => {
      if (timerEnd && Date.now() >= timerEnd) {
        timerEnd = null; timerRemaining = 0; clearInterval(timerTick);
        playSound({ type: 'chime' }); toast('Time’s up. Take a little break.');
        if (state.route === 'timer') { renderPage(); $('#timer-status').textContent = 'Time’s up. Take a break!'; }
      } else updateTimerDisplay();
    }, 250);
  }
  renderPage();
}
function initCanvas() {
  const canvas = $('#paint-canvas'); const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f3e6ed'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return [(event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height];
  };
  canvas.addEventListener('pointerdown', event => {
    paintDrawing = true; canvas.setPointerCapture(event.pointerId);
    ctx.strokeStyle = $('#paint-color').value; ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = Number($('#paint-size').value); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const [x,y] = point(event); ctx.beginPath(); ctx.arc(x,y,ctx.lineWidth / 2,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x,y);
  });
  canvas.addEventListener('pointermove', event => { if (!paintDrawing) return; ctx.lineTo(...point(event)); ctx.stroke(); });
  const stop = () => { paintDrawing = false; ctx.closePath(); };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
}
function download(blob, name) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportLibrary() {
  const csv = value => `"${String(value).replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g,'""')}"`;
  const rows = [['Name','URL','Library'], ...allGames().map(g => [g.title,g.url,g.visibility || 'Built-in'])];
  download(new Blob([rows.map(row => row.map(csv).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'natr-games.csv');
}
async function saveNotes(button) {
  if (!state.user) return openAuth();
  button.disabled = true;
  const value = $('#notes-area').value;
  try {
    await request('PUT', { action:'notes', notes:value });
    state.notes = value;
    notesDirty = notesDraft !== value;
    $('#notes-status').textContent = notesDirty ? 'Unsaved changes' : 'Saved to your account';
    toast('Notes saved.');
  } catch (error) { toast(error.message); $('#notes-status').textContent = 'Not saved — try again'; }
  finally { button.disabled = false; }
}
async function saveSettings(button) {
  if (!state.user) return openAuth();
  button.disabled = true;
  try {
    if (backgroundDraft && !(await uploadBackground(button))) return;
    await request('PUT', { action:'settings', settings:state.settings }); toast('Preferences saved to your account.');
  }
  catch (error) { toast(error.message); }
  finally { button.disabled = false; }
}
async function action(name, target) {
  switch (name) {
    case 'open-cloak': openCloak(); break;
    case 'show-cover': await displayCover(); break;
    case 'upload-background': await uploadBackground(target); break;
    case 'clear-background': clearBackgroundDraft(); state.settings.backgroundImage = null; state.settings.background = 'stars'; applySettings(); renderPage(); toast('Image removed from your preferences. Save preferences to keep this change.'); break;
    case 'stop-live-sounds': stopSounds(); resetLiveSoundboard(); break;
    case 'reload-soundboard': resetLiveSoundboard(); break;
    case 'retry-embed': if (activePlayer) mountEmbed(activePlayer.url); break;
    case 'embed-help': if (activePlayer) embedNotice('The website may block embedding or require a sign-in outside the player. Try a supported public video or post link.'); break;
    case 'add-game': openAdd('game'); break;
    case 'add-link': openAdd('link'); break;
    case 'account': openAuth(); break;
    case 'retry': await loadLibrary(); break;
    case 'save-notes': await saveNotes(target); break;
    case 'save-settings': await saveSettings(target); break;
    case 'export-library': exportLibrary(); break;
    case 'logout':
      target.disabled = true;
      try { await logout(); state.entries = []; state.favorites.clear(); state.notes = ''; notesDraft = ''; notesDirty = false; state.settings = defaultSettings(); clearBackgroundDraft(); applySettings(); $('#auth-dialog').close(); await updateAccount(); await loadLibrary(); renderPage(); toast('Signed out.'); }
      catch (error) { toast(error.message); }
      finally { target.disabled = false; }
      break;
    case 'media-favorites': state.filter = state.filter === 'Favorites' ? 'All' : 'Favorites'; renderPage(); break;
    case 'sound-favorites': state.soundFavorites = !state.soundFavorites; renderPage(); break;
    case 'overlap': audioState.overlap = !audioState.overlap; target.textContent = `Overlap: ${audioState.overlap ? 'ON' : 'OFF'}`; target.classList.toggle('active', audioState.overlap); target.setAttribute('aria-pressed', audioState.overlap); break;
    case 'stop-sounds': stopSounds(); break;
    case 'focus-tts': $('#tts-text').focus(); break;
    case 'toggle-timer': startTimer(); break;
    case 'reset-timer': timerEnd = null; clearInterval(timerTick); timerRemaining = Math.max(1,Math.min(180,Number($('#timer-minutes').value) || 25))*60; renderPage(); break;
    case 'clear-canvas': { const canvas = $('#paint-canvas'), ctx = canvas.getContext('2d'); ctx.fillStyle = '#f3e6ed'; ctx.fillRect(0,0,canvas.width,canvas.height); break; }
    case 'save-canvas': $('#paint-canvas').toBlob(blob => { if (blob) download(blob,'natr-drawing.png'); }); break;
  }
}
document.addEventListener('click', event => {
  const button = event.target.closest('button, a[data-action]');
  if (!button) return;
  if (button.dataset.close) $(`#${button.dataset.close}`).close();
  else if (button.dataset.action) void action(button.dataset.action, button);
  else if (button.dataset.soundSource) { state.soundSource = button.dataset.soundSource; stopSounds(); renderPage(); }
  else if (button.dataset.play) { const item = findItem(button.dataset.play); if (item) openPlayer(item); }
  else if (button.dataset.favorite) void toggleFavorite(button.dataset.favorite, button);
  else if (button.dataset.delete) void deleteEntry(button.dataset.delete, button);
  else if (button.dataset.auth) openAuth(button.dataset.auth);
  else if (button.dataset.sound) { try { playSound(sounds.find(sound => sound.id === button.dataset.sound)); } catch (error) { toast(error.message); } }
  else if (button.dataset.calc) calculate(button.dataset.calc);
  else if (button.dataset.filter) {
    if (state.route === 'media') state.mediaFilter = button.dataset.filter;
    else state.filter = button.dataset.filter;
    $$('.filters [data-filter]').forEach(item => { const selected = item === button; item.classList.toggle('active',selected); item.setAttribute('aria-pressed',selected); });
    updateCatalog();
  }
});
document.addEventListener('input', event => {
  const input = event.target;
  if (input.id === 'catalog-search') { state.query = input.value; if (state.route === 'tools') updateTools(); else updateCatalog(); }
  else if (input.id === 'sound-search') updateSounds();
  else if (input.id === 'notes-area') { notesDraft = input.value; notesDirty = notesDraft !== state.notes; $('#notes-status').textContent = notesDirty ? `${input.value.length.toLocaleString()} / 20,000 · Unsaved changes` : 'All changes saved'; }
  else if (input.id === 'panic-toggle') state.settings.panicEnabled = input.checked;
  else if (input.id === 'panic-key') { const key = input.value.toLowerCase(); if (/^[a-z0-9]$/.test(key)) state.settings.panicKey = key; }
  else if (input.id === 'startup-cover') state.settings.startupCover = input.checked;
  else if (input.id === 'background-file') void previewBackground(input.files?.[0]);
  else if (input.id === 'background-select') { state.settings.background = input.value; applySettings(); }
  else if (input.id === 'motion-toggle') { state.settings.motion = input.checked; applySettings(); }
  else if (['sound-volume','settings-volume'].includes(input.id)) { state.settings.volume = Number(input.value); setVolume(state.settings.volume); if ($('#sound-volume-label')) $('#sound-volume-label').textContent = `${Math.round(input.value * 100)}%`; }
  else if (input.id === 'timer-minutes' && !timerEnd) { timerMinutes = Math.max(1,Math.min(180,Number(input.value)||25)); timerRemaining = timerMinutes*60; updateTimerDisplay(); }
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (form.id === 'auth-form') { event.preventDefault(); void authSubmit(form); }
  if (form.id === 'public-embed-form') {
    event.preventDefault(); const url = publicEmbed($('#public-embed-url').value,location.hostname);
    if (!url) $('#public-embed-error').textContent = 'Use a public YouTube or TikTok video, Instagram post/reel, Spotify track/album/playlist/episode, or Twitch channel URL.';
    else mountEmbed(url);
  }
  if (form.id === 'tts-form') { event.preventDefault(); try { speak($('#tts-text').value); } catch (error) { toast(error.message); } }
  if (form.id === 'home-search') { event.preventDefault(); const query = $('#home-query').value; state.route = 'games'; state.query = query; state.filter = 'All'; location.hash = 'games'; renderPage(); }
  if (form.id === 'terminal-form') {
    event.preventDefault();
    const command = $('#terminal-command').value.trim().toLowerCase(); $('#terminal-command').value = '';
    const output = $('#terminal-output');
    const routes = ['home','games','apps','tools','media','links','notes','settings','soundboard','calculator','timer','paint'];
    if (routes.includes(command)) { location.hash = command; return; }
    if (command === 'clear') { output.textContent = ''; return; }
    let result = 'Unknown command. Type help for a list.';
    if (command === 'help') result = `go to: ${routes.join(' · ')}\nbackground stars | waves | off\nadd · mute · unmute · date · clear`;
    else if (command === 'add') { openAdd(); result = 'Opening Add Game…'; }
    else if (command === 'date') result = new Date().toLocaleString();
    else if (command.startsWith('background ')) { const background = command.split(' ')[1]; if (['stars','waves','off'].includes(background)) { state.settings.background = background; applySettings(); result = `Background: ${background}. Save in Settings to keep it.`; } }
    else if (command === 'mute' || command === 'unmute') { setMuted(command === 'mute'); result = command === 'mute' ? 'Soundboard muted.' : 'Soundboard unmuted.'; }
    output.textContent += `\n\n> ${command}\n${result}`;
  }
});
function setMuted(muted) {
  setVolume(state.settings.volume, muted);
  $('#mute-button').innerHTML = icon(muted ? 'volume-x' : 'volume-2');
  $('#mute-button').title = muted ? 'Unmute soundboard' : 'Mute soundboard';
  $('#mute-button').setAttribute('aria-label', $('#mute-button').title);
  $('#mute-button').setAttribute('aria-pressed', muted);
  if (state.soundSource === 'real') resetLiveSoundboard();
  refreshIcons();
}
$('#mute-button').addEventListener('click', () => setMuted(!audioState.muted));
$('#account-button').addEventListener('click', () => openAuth());
window.addEventListener('beforeunload', event => { if (notesDirty) { event.preventDefault(); event.returnValue = ''; } });

async function init() {
  for (let i = 0; i < 70; i++) {
    const particle = document.createElement('span'); particle.className = 'particle';
    particle.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;--duration:${18+Math.random()*30}s;--delay:-${Math.random()*30}s;width:${1+Math.random()*4}px;height:${1+Math.random()*4}px`;
    $('#background').append(particle);
  }
  $('#navigation').innerHTML = sections.map(([route,label,name],i) => `${[3,5,7].includes(i) ? '<div class="nav-divider"></div>' : ''}<a class="nav-button" href="#${route}" title="${label}" aria-label="${label}">${icon(name)}</a>`).join('');
  $('#footer-date').textContent = new Date().toLocaleDateString('en-US',{ month:'short',day:'numeric',year:'numeric' });
  applySettings();
  const authCallback = /(?:confirmation_token|recovery_token|invite_token|access_token)=/.test(location.hash);
  if (!authCallback && location.hash) state.route = location.hash.slice(1);
  renderPage();
  try {
    if (authCallback) {
      const result = await handleAuthCallback();
      if (result?.type === 'recovery' || result?.type === 'invite') openAuth('reset');
      else if (result) toast('Account confirmed. Welcome to natr.');
    }
  } catch { toast('This account link could not be verified. Try signing in or requesting a new reset link.'); }
  await updateAccount();
  await loadLibrary();
  if (!startupChecked) { startupChecked = true; if (state.settings.startupCover) showCover(state.settings); }
  // Keep account-owned data isolated when the session changes in another tab.
  onAuthChange(async (event) => {
    if (event === 'token_refresh') return;
    const previousId = state.user?.id;
    await updateAccount();
    if (previousId !== state.user?.id) {
      state.entries = []; state.favorites.clear(); state.notes = ''; notesDraft = ''; notesDirty = false;
      state.settings = defaultSettings();
      if (!state.user) clearBackgroundDraft();
      if (backgroundDraft) state.settings.background = 'custom';
      applySettings(); renderPage();
    }
    await loadLibrary();
    if (event === 'recovery') openAuth('reset');
  });
  try { state.signupAllowed = !(await getSettings()).disableSignup; } catch { /* Login remains available with a clear API error if offline. */ }
}
function clearBackgroundDraft() {
  if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
  backgroundDraft = null; backgroundPreview = '';
}
function updateBackgroundPreview() {
  const preview = $('#background-preview');
  if (!preview) return;
  const image = backgroundDraft || state.settings.backgroundImage;
  const src = backgroundPreview || (image?.key ? `/api/background?key=${encodeURIComponent(image.key)}` : '');
  preview.style.backgroundImage = src ? `url(${JSON.stringify(src)})` : '';
}
async function previewBackground(file) {
  if (!file) return;
  const error = $('#background-error'); error.textContent = '';
  try {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
    if (file.size > 30 * 1024 * 1024) throw new Error('Choose an image under 30 MB to prepare for upload.');
    const bitmap = await createImageBitmap(file);
    const {width,height} = bitmap;
    if (width * height > 40000000) { bitmap.close(); throw new Error('Choose an image up to 40 megapixels. 4K and 8K backgrounds are supported.'); }
    let prepared = file;
    if (file.size > 4 * 1024 * 1024) {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(bitmap,0,0);
      let blob;
      for (const quality of [.95,.88,.8,.7]) {
        blob = await new Promise(resolve => canvas.toBlob(resolve,'image/webp',quality));
        if (blob && blob.size <= 4 * 1024 * 1024) break;
      }
      if (!blob || blob.size > 4 * 1024 * 1024) { bitmap.close(); throw new Error('This image is too large. Export it as JPEG or WebP under 4 MB.'); }
      prepared = new File([blob],'background.webp',{type:'image/webp'});
    }
    bitmap.close(); clearBackgroundDraft();
    backgroundDraft = { file:prepared,width,height }; backgroundPreview = URL.createObjectURL(prepared);
    state.settings.background = 'custom'; applySettings(); renderPage();
    toast(`${width} × ${height} preview ready. ${state.user ? 'Save it to your account.' : 'Sign in to save it.'}`);
  } catch (reason) { if (error.isConnected) error.textContent = reason.message; else toast(reason.message); }
}
async function uploadBackground(button) {
  if (!backgroundDraft) return;
  if (!state.user) { openAuth(); return; }
  button.disabled = true; const oldLabel = button.innerHTML; button.textContent = 'Uploading…';
  $('#background-error').textContent = '';
  try {
    const file = backgroundDraft.file;
    const response = await fetch('/api/background',{method:'POST',headers:{'Content-Type':file.type},credentials:'same-origin',body:file});
    const result = await response.json().catch(() => ({error:'Background upload failed. Try again.'}));
    if (!response.ok) throw new Error(result.error || 'Background upload failed.');
    state.settings.backgroundImage = result.backgroundImage; state.settings.background = 'custom';
    clearBackgroundDraft(); applySettings(); renderPage(); toast('Background saved to your account at its native resolution.');
    return true;
  } catch (error) { if ($('#background-error')) $('#background-error').textContent = error.message; else toast(error.message); return false; }
  finally { if (button.isConnected) { button.disabled = false; button.innerHTML = oldLabel; refreshIcons(); } }
}
function resetLiveSoundboard() {
  const frame = $('#real-soundboard'), muted = $('#real-sound-muted');
  if (!frame) return;
  frame.src = audioState.muted ? 'about:blank' : 'https://soundbuttonsworld.com/trends?page=1';
  frame.hidden = audioState.muted;
  if (muted) muted.hidden = !audioState.muted;
}
function openCloak() {
  $('#cloak-form').innerHTML = `<div class="dialog-heading"><span class="eyebrow">TAB CLOAKING</span><button class="icon-button" type="button" data-close="cloak-dialog" aria-label="Close cloaking">${icon('x')}</button></div><h2 id="cloak-heading">A quieter tab.</h2><p>Change this tab’s name and icon. Your natr pages stay right here.</p><label>Preset<select id="cloak-preset" class="full-width" aria-label="Preset"><option value="custom">Custom</option><option value="notes">Class notes</option><option value="classroom">Home – Classroom</option><option value="calculator">Calculator</option></select></label><label>Tab name<input id="cloak-title" name="title" value="${esc(state.settings.cloakTitle)}" maxlength="80" required></label><label>Tab icon<select name="icon" id="cloak-icon" class="full-width" aria-label="Tab icon">${[['notes','Notes'],['classroom','Classroom'],['calculator','Calculator'],['default','natr']].map(([value,label])=>`<option value="${value}" ${state.settings.cloakIcon === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><div class="cloak-preview" id="cloak-preview">Preview: ${esc(state.settings.cloakTitle)}</div><p>Changes tab title and icon only. Use Cover for the blocked-page privacy screen.</p><p id="cloak-error" class="error" role="alert"></p><div class="privacy-actions"><button class="subtle-button" type="button" id="reset-cloak">Reset tab</button><button class="primary" type="submit">Apply cloaking</button></div>`;
  $('#cloak-dialog').showModal(); refreshIcons();
}
$('#cloak-button').addEventListener('click',openCloak);
$('#cover-button').addEventListener('click',() => void displayCover());
async function displayCover() {
  if (document.fullscreenElement) await document.exitFullscreen().catch(()=>{});
  showCover(state.settings, activePlayer ? new URL(activePlayer.url).hostname : location.hostname);
}
$('#reveal-button').addEventListener('click',()=>hideCover(state.settings,state.route));
$('#privacy-cover').addEventListener('cancel',event=>{event.preventDefault();hideCover(state.settings,state.route);});
configurePrivacy(()=>{
  stopSounds();
  const live = $('#real-soundboard');
  if (live) { suspendedSoundboard = live.src; live.src = 'about:blank'; }
  if ($('#player-screen iframe')) { lastEmbedUrl = $('#player-screen iframe').src; $('#player-screen').replaceChildren(); }
},()=>{
  const live = $('#real-soundboard');
  if (live && suspendedSoundboard && !audioState.muted) live.src = suspendedSoundboard;
  suspendedSoundboard = '';
  if (activePlayer && lastEmbedUrl && !$('#player-screen').children.length) mountEmbed(lastEmbedUrl);
});
document.addEventListener('keydown',event=>{
  if (!state.settings.panicEnabled || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  if (event.target.closest('input,textarea,select,[contenteditable=true]')) return;
  if (event.key.toLowerCase() !== state.settings.panicKey) return;
  event.preventDefault();
  if ($('#privacy-cover').open) hideCover(state.settings,state.route); else void displayCover();
});
document.addEventListener('change',event=>{
  const input = event.target;
  if (input.id !== 'cloak-preset') return;
  const presets = {notes:['Class notes','notes'],classroom:['Home – Classroom','classroom'],calculator:['Calculator','calculator']};
  if (presets[input.value]) { $('#cloak-title').value = presets[input.value][0]; $('#cloak-icon').value = presets[input.value][1]; $('#cloak-preview').textContent = `Preview: ${$('#cloak-title').value}`; }
});
document.addEventListener('input',event=>{
  if (event.target.id === 'cloak-title') $('#cloak-preview').textContent = `Preview: ${event.target.value}`;
});
$('#cloak-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const title = $('#cloak-title').value.trim();
  if (!title) { $('#cloak-error').textContent = 'Enter a tab name.'; return; }
  state.settings.cloakTitle = title; state.settings.cloakIcon = $('#cloak-icon').value; state.settings.cloakEnabled = true;
  applyTab(state.settings,state.route); $('#cloak-dialog').close();
  if (state.route === 'settings') renderPage();
  toast('Tab cloaking applied. Save preferences in Settings to keep it across visits.');
});
document.addEventListener('click',event=>{
  if (event.target.closest('#reset-cloak')) { state.settings.cloakEnabled = false; applyTab(state.settings,state.route); $('#cloak-dialog').close(); if (state.route === 'settings') renderPage(); toast('Tab title and icon restored.'); }
  const anchor = event.target.closest('a[target="_blank"]');
  if (!anchor || anchor.closest('#player')) return;
  event.preventDefault();
  const title = anchor.querySelector('h3')?.textContent || anchor.textContent.trim() || 'Website';
  openPlayer({title,url:anchor.href,kind:'link'});
});

void init();
