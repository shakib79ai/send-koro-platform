#!/usr/bin/env bash
# Creates the android/ and ios/ folders (once) and adds the permissions the driver app needs.
# Run from apps/driver-app:  ./tool/bootstrap.sh
# Safe to re-run: `flutter create` never overwrites lib/ or test/, and the patches check first.
set -euo pipefail
cd "$(dirname "$0")/.."

flutter create --org com.sendkoro --project-name send_koro_driver --platforms=android,ios --no-pub . >/dev/null

python3 - <<'PY'
import re, pathlib

# ── Android ──
m = pathlib.Path('android/app/src/main/AndroidManifest.xml')
s = m.read_text()
perms = ['android.permission.INTERNET', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION', 'android.permission.VIBRATE']
for p in perms:
    if p not in s:
        s = s.replace('<application', f'<uses-permission android:name="{p}" />\n    <application', 1)
if '<queries>' in s and 'android.intent.action.DIAL' not in s:
    s = s.replace('<queries>', '''<queries>
        <intent><action android:name="android.intent.action.VIEW" /><data android:scheme="https" /></intent>
        <intent><action android:name="android.intent.action.DIAL" /><data android:scheme="tel" /></intent>''', 1)
s = s.replace('android:label="send_koro_driver"', 'android:label="SK Driver"')
m.write_text(s)

# Debug builds may talk to a local API over http (http://10.0.2.2:3001 from the emulator).
d = pathlib.Path('android/app/src/debug/AndroidManifest.xml')
ds = d.read_text()
if 'usesCleartextTraffic' not in ds:
    ds = ds.replace('</manifest>', '    <application android:usesCleartextTraffic="true" />\n</manifest>')
    d.write_text(ds)

# ── iOS ──
p = pathlib.Path('ios/Runner/Info.plist')
ps = p.read_text()
adds = {
    'NSLocationWhenInUseUsageDescription': 'Send Koro uses your location while you are online to offer nearby orders and show customers where their order is.',
    'CFBundleDisplayName': None,
}
if 'NSLocationWhenInUseUsageDescription' not in ps:
    ps = ps.replace('<dict>', '<dict>\n\t<key>NSLocationWhenInUseUsageDescription</key>\n\t<string>%s</string>' % adds['NSLocationWhenInUseUsageDescription'], 1)
if 'NSCameraUsageDescription' not in ps:
    ps = ps.replace('<dict>', '<dict>\n\t<key>NSCameraUsageDescription</key>\n\t<string>Send Koro flashes the camera light when a new delivery offer arrives, and uses the camera for delivery photos.</string>', 1)
if 'LSApplicationQueriesSchemes' not in ps:
    ps = ps.replace('<dict>', '<dict>\n\t<key>LSApplicationQueriesSchemes</key>\n\t<array>\n\t\t<string>tel</string>\n\t\t<string>comgooglemaps</string>\n\t</array>', 1)
ps = re.sub(r'(<key>CFBundleDisplayName</key>\s*<string>)[^<]*(</string>)', r'\1SK Driver\2', ps)
p.write_text(ps)
print('Platform folders ready: android/ and ios/ with location permissions.')
PY

# App icon from the brand kit (assets/icon). Never fails the bootstrap: a missing package only skips the icon.
if flutter pub get >/dev/null 2>&1 && dart run flutter_launcher_icons >/dev/null 2>&1; then
  echo 'App icon set (assets/icon).'
else
  echo 'Note: app icon not applied; run "dart run flutter_launcher_icons" after "flutter pub get".'
fi
