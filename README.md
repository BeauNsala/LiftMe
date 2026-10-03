# LIFT

Workout tracker, calorie tracker and on-device coach. Runs fully offline once installed.

## Put it on GitHub Pages

1. Create a repo (or use your existing one) and upload every file in this folder to the root.
2. In the repo, go to Settings, then Pages. Set the source to the `main` branch, root folder.
3. Open `https://<your-username>.github.io/<repo-name>/` on your phone.
4. iPhone: Safari, Share, Add to Home Screen. Android: Chrome menu, Install app.

Open it once with signal so it can cache itself. After that it works with no connection.

## Updating the app

When you change any file, open `sw.js` and bump the version in `CACHE` (for example `lift3-v3.0.1`).
Phones will show "A new version is ready" the next time the app opens online.

## Your data

Everything is stored on the phone only. Use Settings, Back up data every few weeks,
and Restore from backup if you change phones.

## Files

- `index.html` app shell and styles
- `app.js` all the logic: programmes, coach, food tracker, calculator
- `sw.js` offline caching
- `manifest.webmanifest` makes it installable
- `icon-*.png`, `apple-touch-icon.png` home screen icons
