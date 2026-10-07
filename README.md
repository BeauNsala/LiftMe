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

## Cloud sync (optional)

In the app: Settings, Cloud sync. It copies your data to `lift-data.json` in a private repo you own
(for example `lift-data`), using a fine-grained token that can only touch that repo.
Keep that repo private. On a new phone, install LIFT and tap "New phone? Restore from cloud sync".

## Workout plans

Train tab, Plans. You can build plans in the app, or import one from a PDF, a Word (.docx) file,
a text file, a photo or screenshot, or pasted text. Imported plans open in the editor so you can
check them before saving. Reading PDFs and photos needs signal the first time, because the
reader downloads from a CDN.

## Intermittent fasting

Settings, Intermittent fasting. Pick a schedule (12:12 up to 20:4) and when your eating window
opens. Start and end fasts from the card on the Today and Food tabs.
