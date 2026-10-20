# HQ

Daily training, drinks, weight and to-do in one place. Single-file app (`index.html`), works offline, all data stays in your browser's local storage.

Live at https://scottjmodra-droid.github.io/hq/

## Releasing a change
Bump `APP_VERSION` in `index.html` **and** `version` in `version.json` to the same value. Open copies of HQ check `version.json` when they come back to the front and reload (or show an update banner) when it differs.
