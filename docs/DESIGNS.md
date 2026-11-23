# Send Koro — approved screen designs

The approved designs are **clickable prototypes**. Every screen, button and flow works with demo data. They are the source of truth for layout, wording and states. The real apps in `apps/` must match them.

Two ways to open them:

1. **In this repo** (works offline, nothing to sign in to): open the files in `designs/prototypes/` in a browser.
2. **On claude.ai** (owner sign-in): the links below.

| App | File in this repo | claude.ai link | Real app to match |
|---|---|---|---|
| Customer web | `designs/prototypes/customer-web.html` | https://claude.ai/artifact/X2i3ZiwSpnmfLDqdX2nRft | `apps/customer-web` (desktop) |
| Customer PWA | `designs/prototypes/customer-pwa.html` | https://claude.ai/artifact/AwVDngTNS2hUpb8kFv3ZGV | `apps/customer-web` (phone) |
| Customer app (iOS + Android) | `designs/prototypes/customer-app.html` | https://claude.ai/artifact/KwU9YEmqULMaFRV57DpdRW | `apps/customer-app` (Flutter) |
| Driver app (iOS + Android) | `designs/prototypes/driver-app.html` | https://claude.ai/artifact/2opyrx6pynjcFboMfcstgY | `apps/driver-app` (Flutter) |
| Restaurant portal | `designs/prototypes/restaurant-portal.html` | https://claude.ai/artifact/EdqLBukQehDyArqNH7ascv | `apps/restaurant-web` (desktop) |
| Restaurant PWA | `designs/prototypes/restaurant-pwa.html` | https://claude.ai/artifact/NuEdowmfy4DKToDCo7CDuw | `apps/restaurant-web` (tablet/phone) |
| Admin console | `designs/prototypes/admin-console.html` | https://claude.ai/artifact/MmWGYQ7qrkYHg669nQvEk1 | `apps/admin-web` |

Brand colours (use only these): navy `#0B3B6E` / `#082D55`, red `#E3242B` / `#C81E24`, light `#EEF3F8` `#EAF1F8` `#DCE5EF` `#C9D6E4`, grey `#5B6B80`, ink `#0E1E33`, white `#FFFFFF`. Logo files: `docs/brand/`.

Rules for building from a design:

- Match the design's layout, wording and states (empty, loading, error, success).
- Totals and money always come from the API; the prototypes compute them only for demo.
- Card logos (Visa, Mastercard, Apple Pay, Google Pay) come from Stripe's Payment Element / payment sheet and the official Apple Pay and Google Pay buttons; never draw them by hand.
- If the code needs something the design doesn't show, ask before inventing it.

The design source (`designs/source/`) rebuilds the prototype files: `cd designs/source && python3 build.py`. Colour check: `node colorscan.js driver-app 390 844` must report 0 off-palette colours.

Food photos used by the customer and restaurant prototypes are local JPEGs in `designs/prototypes/img/`, so the demos work without fetching images at runtime. They are sourced from Unsplash under its free license: [hero bowl](https://images.unsplash.com/photo-1546069901-ba9599a7e63c), [chicken bowl](https://images.unsplash.com/photo-1512621776951-a57141f2eefd), [salad](https://images.unsplash.com/photo-1490645935967-10de6ba17061), [wings](https://images.unsplash.com/photo-1527477396000-e27163b481c2), [biryani](https://images.unsplash.com/photo-1589302168068-964664d93dc0), [ramen](https://images.unsplash.com/photo-1569718212165-3a8278d5f624), [burger](https://images.unsplash.com/photo-1568901346375-23c9450c58cd), [second burger](https://images.unsplash.com/photo-1550547660-d9450f859349), and [pizza](https://images.unsplash.com/photo-1579751626657-72bc17010498). See the [Unsplash license](https://unsplash.com/license).
