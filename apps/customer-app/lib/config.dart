/// Build-time configuration (--dart-define):
///   API_URL                 core API, e.g. https://api.sendkoro.com/v1
///   STRIPE_PUBLISHABLE_KEY  pk_test_… while developing, pk_live_… at launch
///   APPLE_MERCHANT_ID       merchant.com.sendkoro (enables Apple Pay on iOS)
class Config {
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:3001/v1');
  static const stripePublishableKey = String.fromEnvironment('STRIPE_PUBLISHABLE_KEY');
  static const appleMerchantId = String.fromEnvironment('APPLE_MERCHANT_ID');

  /// Shown until the customer saves an address (Flatiron, Manhattan).
  static const fallbackLat = 40.7411;
  static const fallbackLng = -73.9897;
}
