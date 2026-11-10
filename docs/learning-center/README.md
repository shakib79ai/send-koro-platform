# Send Koro Learning Center (restaurants)

Short guides with a short video each. They appear on the restaurant welcome page (web and PWA) under **Learning center**, and inside the portal (sidebar → Learning center; PWA → More → Learning center).

Source of truth for the content: the `LESSONS` list in `designs/source/restaurant.js`. These files are generated from it: edit the source, then run `node designs/source/learning-center-to-md.js <file with the LESSONS block> docs/learning-center`.

**Needs confirmation before launch:** the lessons state that a restaurant’s delivery share is limited to 15% of the food on an order in NYC. The business model lists this as a proposed rule that needs a lawyer’s confirmation and isn’t enforced in the API yet.

Each video is an animated walkthrough (scenes, captions, optional read-aloud). Each lesson also has a video script below, so a recorded or produced video can replace the animation later.

## Get started

| # | Lesson | Video | File |
|---|---|---|---|
| 1 | How to get started | 0:36 | [01-start.md](01-start.md) |
| 2 | Licenses you need | 0:26 | [02-licenses.md](02-licenses.md) |
| 3 | Store setup | 0:24 | [03-setup.md](03-setup.md) |
| 4 | Locations (branches) | 0:20 | [04-branches.md](04-branches.md) |
| 5 | Sales tax setup | 0:26 | [05-tax.md](05-tax.md) |
| 6 | Connect Stripe | 0:24 | [06-stripe.md](06-stripe.md) |

## Menu and prices

| # | Lesson | Video | File |
|---|---|---|---|
| 7 | Set up your menu | 0:27 | [07-menusetup.md](07-menusetup.md) |
| 8 | Edit your menu | 0:28 | [08-menuedit.md](08-menuedit.md) |
| 9 | Food pricing | 0:28 | [09-pricing.md](09-pricing.md) |

## Orders and delivery

| # | Lesson | Video | File |
|---|---|---|---|
| 10 | Delivery fee: who pays and how | 0:36 | [10-delivery.md](10-delivery.md) |
| 11 | Managing orders | 0:24 | [11-ordersmgmt.md](11-ordersmgmt.md) |
| 12 | Accepting an order | 0:25 | [12-accept.md](12-accept.md) |
| 13 | Handing the order to the courier | 0:27 | [13-handoff.md](13-handoff.md) |
| 14 | Refunds | 0:29 | [14-refunds.md](14-refunds.md) |

## Money

| # | Lesson | Video | File |
|---|---|---|---|
| 15 | Card processing fees | 0:28 | [15-processing.md](15-processing.md) |
| 16 | Getting paid (payouts) | 0:26 | [16-payouts.md](16-payouts.md) |
| 17 | Subscription plans | 0:28 | [17-plans.md](17-plans.md) |
| 18 | Paying your subscription | 0:26 | [18-billing.md](18-billing.md) |
| 19 | Referral and promo credit | 0:30 | [19-credit.md](19-credit.md) |

