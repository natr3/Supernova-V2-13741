# natr

A browser game library with social app shortcuts, a soundboard, media discovery, and small creative tools. The interface uses a pink pixel theme with optional animated stars or waves and honors reduced-motion preferences.

## Libraries and accounts

Anyone can add a public game or link to the community library. Signed-in visitors can also save a private library, favorite games and apps, and sync notes and preferences across devices. Shared items added anonymously remain in the community library; items added while signed in can be removed by their creator. Private rows and profile changes are authorized on the server using the verified account identity.

Games open in a player with minimize, reload, fullscreen, close, and an original-site fallback. Game, app, media, tool, and link selections open an internal player. Official public YouTube, TikTok, Instagram, Spotify, and Twitch embeds are supported. Full apps that prevent embedding display an explanation and a public-link form; opening the original website is an explicit fallback. TV and movie cards link to viewing availability on JustWatch. The default soundboard embeds the actual Sound Buttons World trends page inside natr. A separate Synth lab retains original synthesized effects and browser text-to-speech. Muting or covering the live soundboard unloads the external frame to stop its audio.

## Appearance and privacy

Settings include a scalable 3840 × 2160 Aurora wallpaper and private JPEG, PNG, or WebP background uploads. Uploads keep their pixel dimensions, up to 40 megapixels. Files over 4 MB are optimized to WebP in the browser without resizing; the server validates file type and dimensions, stores the binary in Netlify Blobs, and stores its reference in the account's existing database preferences. Original low-resolution images are not represented as 4K.

The Cloak button changes the tab title and icon using presets or a custom name. Cover displays a reversible, locally generated blocked-page privacy screen. The default U shortcut toggles the cover outside text fields; its key and startup behavior are configurable. These settings can be saved to an account. The cover is not a network filter and cloaking does not hide traffic.

## Development

Install dependencies with `npm install`, then run `netlify dev --port 8889` for the frontend and API together. Netlify Identity handles sign-up, email confirmation, sign-in, and password recovery. The Identity feature marker is included for deployment.

Netlify Database stores library entries, account favorites, private notes, and preferences. Netlify Blobs stores private uploaded background images, served only to the authenticated owner. `db/schema.ts` defines the schema; generated migrations in `netlify/database/migrations/` are applied by the platform at deployment. Do not apply migrations manually.

Run `npm run check` for server TypeScript checks and `npm test` for URL, ownership, and settings validation tests. With the local server running and Playwright Chromium installed, run `npx playwright test` for browser coverage. Browser library tests use a simulated API; actual database writes and account email delivery require a deployed site.

## Assets

Social app marks come from Simple Icons where available, with local monogram fallbacks. The game and media crops were taken from the supplied reference images. Remaining game covers and the natr mark are local SVG artwork.
