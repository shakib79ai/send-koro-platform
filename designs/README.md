# Designs

- `prototypes/` — the 7 approved clickable prototypes (open any `.html` file in a browser). See `docs/DESIGNS.md` for which app each one belongs to.
- `source/` — the code that builds the prototypes:
  - `common.css`, `customer.js`, `restaurant.js`, `driver.js`, `admin.js`, `shared.js`
  - `build.py` writes `../prototypes/*.html` (`python3 build.py`)
  - `colorscan.js` checks the brand palette; `dtest.js` clicks through the driver flows (both need Playwright)

These are design references, not production code. Production code lives in `apps/` and `services/`. Change a design here first, rebuild, then update the matching app.
