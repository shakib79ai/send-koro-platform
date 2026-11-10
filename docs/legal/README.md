# Send Koro legal documents

**DRAFT for review by a licensed attorney before launch.** Bracketed items (legal entity name, address, dispute terms, insurance) are completed by the company. Last updated November 10, 2026.

These texts are shown in every app (source: `designs/source/legal.js`; regenerate with `node designs/source/legal-to-md.js docs/legal`). They are original drafts written for Send Koro’s business model, organised the way large delivery marketplaces organise theirs.

| Document | For | File |
|---|---|---|
| Terms of Service | Customer | [terms.md](terms.md) |
| Refund and Cancellation Policy | Customer, Restaurant | [refunds.md](refunds.md) |
| Privacy Policy | Customer, Restaurant, Driver | [privacy.md](privacy.md) |
| Community Guidelines and Acceptable Use Policy | Customer, Restaurant, Driver | [usage.md](usage.md) |
| Text Message Terms | Customer, Restaurant, Driver | [sms.md](sms.md) |
| Restaurant Partner Agreement | Restaurant | [restaurantTerms.md](restaurantTerms.md) |
| Courier Agreement | Driver | [driverTerms.md](driverTerms.md) |

## Where each document appears

- **Customers (web, PWA, iOS and Android apps):** Terms of Service, Privacy Policy, Refund and Cancellation Policy, Community Guidelines and Acceptable Use Policy, Text Message Terms
- **Restaurants (portal web and PWA):** Restaurant Partner Agreement, Privacy Policy, Refund and Cancellation Policy, Community Guidelines and Acceptable Use Policy, Text Message Terms
- **Couriers (driver app):** Courier Agreement, Privacy Policy, Community Guidelines and Acceptable Use Policy, Text Message Terms

- Customers: sign-in consent line, checkout (“By placing your order…”), website footer, Account → Legal, Account → Privacy center (marketing choices, cookies, download data, delete account).
- Restaurants: sign-up “Agree” step, portal footer, Licenses and legal page, More / sidebar → Legal documents.
- Couriers: sign-in consent line, application agreement step, Account → Legal and Your data, Help → Legal.
