#!/usr/bin/env bash
# Creates android/ and ios/ (once) and applies what Stripe's payment sheet and the app need.
# Run from apps/customer-app:  ./tool/bootstrap.sh   (safe to re-run)
set -euo pipefail
cd "$(dirname "$0")/.."

flutter create --org com.sendkoro --project-name send_koro_customer --platforms=android,ios --no-pub . >/dev/null

python3 - <<'PY'
import pathlib, re

# ── Android ──
m = pathlib.Path('android/app/src/main/AndroidManifest.xml')
s = m.read_text()
if 'android.permission.INTERNET' not in s:
    s = s.replace('<application', '<uses-permission android:name="android.permission.INTERNET" />\n    <application', 1)
if '<queries>' in s and 'android.intent.action.DIAL' not in s:
    s = s.replace('<queries>', '<queries>\n        <intent><action android:name="android.intent.action.VIEW" /><data android:scheme="https" /></intent>\n        <intent><action android:name="android.intent.action.DIAL" /><data android:scheme="tel" /></intent>', 1)
s = s.replace('android:label="send_koro_customer"', 'android:label="Send Koro"')
m.write_text(s)

d = pathlib.Path('android/app/src/debug/AndroidManifest.xml')
ds = d.read_text()
if 'usesCleartextTraffic' not in ds:
    d.write_text(ds.replace('</manifest>', '    <application android:usesCleartextTraffic="true" />\n</manifest>'))

# Stripe's payment sheet needs a FragmentActivity and an AppCompat/MaterialComponents theme.
for act in pathlib.Path('android/app/src/main').rglob('MainActivity.kt'):
    t = act.read_text()
    t = t.replace('import io.flutter.embedding.android.FlutterActivity', 'import io.flutter.embedding.android.FlutterFragmentActivity')
    t = re.sub(r':\s*FlutterActivity\(\)', ': FlutterFragmentActivity()', t)
    act.write_text(t)
for styles in pathlib.Path('android/app/src/main/res').glob('values*/styles.xml'):
    t = styles.read_text()
    t = re.sub(r'parent="@android:style/Theme\.[A-Za-z.]*"', 'parent="Theme.MaterialComponents.DayNight.NoActionBar"', t)
    styles.write_text(t)
g = pathlib.Path('android/app/build.gradle.kts')
if g.exists():
    t = g.read_text()
    if 'com.google.android.material:material' not in t:
        t += '\ndependencies {\n    implementation("com.google.android.material:material:1.12.0")\n}\n'
    g.write_text(t)

# ── iOS ──
p = pathlib.Path('ios/Runner/Info.plist')
ps = p.read_text()
if 'LSApplicationQueriesSchemes' not in ps:
    ps = ps.replace('<dict>', '<dict>\n\t<key>LSApplicationQueriesSchemes</key>\n\t<array>\n\t\t<string>tel</string>\n\t</array>', 1)
ps = re.sub(r'(<key>CFBundleDisplayName</key>\s*<string>)[^<]*(</string>)', r'\1Send Koro\2', ps)
p.write_text(ps)
print('Platform folders ready. iOS: set the deployment target to 13.0 (Stripe) — Podfile `platform :ios, \'13.0\'`.')
PY

# App icon from the brand kit (assets/icon). Never fails the bootstrap: a missing package only skips the icon.
if flutter pub get >/dev/null 2>&1 && dart run flutter_launcher_icons >/dev/null 2>&1; then
  echo 'App icon set (assets/icon).'
else
  echo 'Note: app icon not applied; run "dart run flutter_launcher_icons" after "flutter pub get".'
fi
