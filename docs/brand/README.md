# Send Koro brand (v1, November 2026)

Logo: navy ring and fork, with a red arrow breaking out of the ring. Tagline: "Order food from local restaurants".

- **Colours:** Koro Navy `#0B3B6E`, Send Red `#E3242B`, White, Ice Blue `#EEF3F8` (plus Deep Navy `#082D55`, Muted `#5B6B80`, Line `#DCE5EF` in the apps).
- **Files here:** master SVGs (text outlined, no font needed): `sendkoro-mark-*`, `sendkoro-logo-horizontal-*`, `-no-tagline-*`, `sendkoro-logo-stacked-*`, `sendkoro-wordmark-*`, in `color`, `reversed` (navy backgrounds), `white`, `navy`, `black`. Rules: `send-koro-brand-guide.pdf`.
- **Where it is used:**
  - Web apps: `apps/*-web/components/BrandLogo.tsx` (reads `public/brand/`), favicons in `public/`, install icons in `public/icons/` (customer ice blue; restaurant and admin navy).
  - Flutter apps: `lib/screens/brand_mark.dart` draws the mark; the launcher icon comes from `assets/icon/` through `flutter_launcher_icons` (run by `tool/bootstrap.sh`). Customer icon ice blue, driver icon red.
