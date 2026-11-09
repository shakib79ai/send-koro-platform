# Send Koro customer app (Flutter, iOS + Android)

The customer app for the iPhone and Android stores. It has the same features as the customer web/PWA and matches the Customer iOS and Android designs in `docs/DESIGNS.md`.

## Run it

You need Flutter 3.29 or newer.

```bash
cd apps/customer-app
./tool/bootstrap.sh            # once: creates android/ and ios/, applies Stripe's Android requirements
flutter pub get
flutter run \
  --dart-define=API_URL=http://10.0.2.2:3001/v1 \
  --dart-define=STRIPE_PUBLISHABLE_KEY=pk_test_…          # sandbox key
# Apple Pay (iOS): add --dart-define=APPLE_MERCHANT_ID=merchant.com.sendkoro and the Apple Pay capability in Xcode.
```

**iOS:** Stripe needs iOS 13 or newer. Set `platform :ios, '13.0'` in `ios/Podfile` after the first `flutter build ios`.

## Screens

| Screen | What it does |
|---|---|
| Home | "Deliver now to" address picker, search, delivery/pickup, cravings, free-delivery deals near you, all restaurants |
| Restaurant | Menu by category. The restaurant's fees are shown before ordering, along with the tax note. Sold-out items are greyed out |
| Item options | Required and optional groups, special instructions, quantity |
| Checkout | Cart quantities, Home/Office/Other address, tip (15/18/20%, 100% to the courier), and the receipt from the API, which always shows Send Koro commission $0.00 |
| Payment | Stripe payment sheet with cards, Apple Pay and Google Pay. The card is authorised now and charged when the restaurant accepts |
| Tracking | Status steps, courier first name, cancel before acceptance, receipt |
| Orders | History with reorder |
| Account | Profile, addresses (add, make default, remove), how prices work, help |
| Sign in | One flow: phone → code → name → first address |

## Rules this app follows

- **Totals come only from `POST /v1/orders/preview`.** The app never adds its own fees.
- **Stripe is pointed at the restaurant's account** (`Stripe.stripeAccountId`), because orders are direct charges.
- **No courier company names, and no card fees.**

## Checks

GitHub Actions runs `flutter analyze`, `flutter test` and a debug APK build on every push (job "customer-app").
