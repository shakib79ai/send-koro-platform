import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:send_koro_customer/api/api_client.dart';
import 'package:send_koro_customer/main.dart';
import 'package:send_koro_customer/state/app_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('opens on Home signed out; Account asks to sign in', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final state = AppState(ApiClient(baseUrl: 'http://localhost:1/v1'));
    await state.start();
    await tester.pumpWidget(CustomerApp(state: state));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Restaurants keep 100% of food sales'), findsOneWidget);
    await tester.tap(find.byIcon(Icons.person_outline));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Sign in to save addresses and see your orders.'), findsOneWidget);
  });
}
