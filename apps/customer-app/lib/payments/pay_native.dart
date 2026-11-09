import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';

import '../config.dart';
import 'pay_result.dart';

export 'pay_result.dart';

/// Orders are direct charges on the RESTAURANT's Stripe account, so the SDK is pointed at that
/// account before the sheet opens. The card is authorised now and charged when the restaurant accepts.
Future<PayResult> payWithStripe({required String clientSecret, required String stripeAccount, required String merchantName}) async {
  if (Config.stripePublishableKey.isEmpty) {
    return const PayResult(PayOutcome.failed, 'Payments aren’t configured in this build (STRIPE_PUBLISHABLE_KEY).');
  }
  try {
    Stripe.publishableKey = Config.stripePublishableKey;
    Stripe.stripeAccountId = stripeAccount;
    if (Config.appleMerchantId.isNotEmpty) Stripe.merchantIdentifier = Config.appleMerchantId;
    await Stripe.instance.applySettings();
    await Stripe.instance.initPaymentSheet(
      paymentSheetParameters: SetupPaymentSheetParameters(
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: merchantName,
        style: ThemeMode.light,
        appearance: const PaymentSheetAppearance(colors: PaymentSheetAppearanceColors(primary: Color(0xFFFF7A00))),
        googlePay: const PaymentSheetGooglePay(merchantCountryCode: 'US', currencyCode: 'USD', testEnv: !bool.fromEnvironment('dart.vm.product')),
        applePay: Config.appleMerchantId.isEmpty ? null : const PaymentSheetApplePay(merchantCountryCode: 'US'),
      ),
    );
    await Stripe.instance.presentPaymentSheet();
    return const PayResult(PayOutcome.paid);
  } on StripeException catch (e) {
    if (e.error.code == FailureCode.Canceled) return const PayResult(PayOutcome.cancelled);
    return PayResult(PayOutcome.failed, e.error.localizedMessage ?? 'Your card was not accepted.');
  } catch (e) {
    return const PayResult(PayOutcome.failed, 'Payment couldn’t start. Please try again.');
  }
}
