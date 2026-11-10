import json, pathlib
P = pathlib.Path(__file__).parent
G = P.parent / 'prototypes'
css = (P / 'common.css').read_text()
js = {k: (P / f'{k}.js').read_text() for k in ['customer', 'restaurant', 'shared', 'admin', 'driver']}
legal = (P / 'legal.js').read_text()
reviews = (P / 'reviews.js').read_text()
pages = {
    'cweb': ('Send Koro Customer Web', 'customer', {'theme': 'navy', 'layout': 'web', 'label': 'Try: search, add dishes, check out (any 6-digit code signs you in), then watch the order move.'}),
    'cpwa': ('Send Koro Customer PWA', 'customer', {'theme': 'navy', 'layout': 'phone', 'pwa': True, 'note': 'Customer PWA in the phone browser. Install it, sign in with any 6-digit code, order and track.'}),
    'cflutter': ('Send Koro Flutter App', 'customer', {'theme': 'navy', 'layout': 'phone', 'note': 'Customer app for iPhone and Android. Sign in with any 6-digit code, order and track.'}),
    'rweb': ('Send Koro Restaurant Web', 'restaurant', {'theme': 'navy', 'layout': 'web'}),
    'rpwa': ('Send Koro Restaurant PWA', 'restaurant', {'theme': 'navy', 'layout': 'phone', 'note': 'Restaurant PWA. Tap “Simulate a new order”, then accept it before the 5-minute timer runs out.'}),
    'admin-portal': ('Send Koro Admin Portal', 'admin', {'theme': 'navy'}),
    'driver-app': ('Send Koro Driver App', 'driver', {'theme': 'navy', 'layout': 'phone', 'note': 'Own-driver app for iPhone and Android. Go online, accept an offer, run the trip. Any 6-digit code signs you in.'}),
}
for name, (title, app, mode) in pages.items():
    html = f'''<title>{title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Exo+2:ital,wght@1,800;1,900&family=Merriweather:wght@700;900&family=Nunito+Sans:opsz,wght@6..12,600;6..12,700;6..12,800;6..12,900&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Inter:wght@400;500;600;700;800&display=swap">
<style>
{css}
</style>
<div id="app"></div>
<script>window.SK_MODE = {json.dumps(mode)};</script>
<script>
{legal if app in ('customer', 'restaurant', 'driver') else ''}
{reviews if app in ('customer', 'restaurant', 'admin') else ''}
</script>
<script>
{js[app]}
</script>
'''
    (G / f'{name}.html').write_text(html)
    print(name, len(html))
# fresh restaurant portal copy with a visible start-up error message
src = (G / 'rweb.html').read_text()
guard = '''<div id="app"><p style="padding:24px;font-family:Inter,system-ui,sans-serif;color:#5E6560">Loading the restaurant portal…</p></div>
<script>window.addEventListener('error',function(e){var a=document.getElementById('app');if(a&&!a.querySelector('.rw-shell,.web')){a.innerHTML='<div style="padding:24px;font-family:system-ui;color:#7A1A0E;background:#FFF1EE;border-radius:12px;margin:16px">The page hit a problem while starting: <b>'+String(e.message).replace(/</g,'&lt;')+'</b>. Please send me this message.</div>';}});</script>'''
(G / 'restaurant-portal.html').write_text(src.replace('<div id="app"></div>', guard, 1).replace('<title>Send Koro Restaurant Web</title>', '<title>Send Koro Restaurant Portal</title>', 1))
# Keep a single restaurant website: the Restaurant Portal. The plain rweb build is only an intermediate.
(G / 'rweb.html').unlink(missing_ok=True)

# Rename to the published file names used in docs/DESIGNS.md
names = {'cweb': 'customer-web', 'cpwa': 'customer-pwa', 'cflutter': 'customer-app', 'rpwa': 'restaurant-pwa', 'admin-portal': 'admin-console'}
for old, new in names.items():
    (G / f'{old}.html').replace(G / f'{new}.html')
