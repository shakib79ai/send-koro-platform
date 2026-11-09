import 'pay_result.dart';

export 'pay_result.dart';

/// The web preview can't show Stripe's native payment sheet.
Future<PayResult> payWithStripe({required String clientSecret, required String stripeAccount, required String merchantName}) async =>
    const PayResult(PayOutcome.failed, 'Payment works in the iPhone and Android apps. This web preview can’t take payments.');
