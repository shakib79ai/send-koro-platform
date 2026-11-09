import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:send_koro_driver/api/api_client.dart';
import 'package:send_koro_driver/main.dart';
import 'package:send_koro_driver/state/driver_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('signed-out drivers see the sign-in screen with the pay promise', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final state = DriverState(ApiClient(baseUrl: 'http://localhost:1/v1'));
    await state.start();
    await tester.pumpWidget(DriverApp(state: state));
    await tester.pumpAndSettle();
    expect(find.text('Deliver with Send Koro'), findsOneWidget);
    expect(find.text('Text me a code'), findsOneWidget);
    // The button stays disabled until the number is valid.
    final button = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Text me a code'));
    expect(button.onPressed, isNull);
    await tester.enterText(find.byType(TextField), '9175550400');
    await tester.pump();
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Text me a code')).onPressed, isNotNull);
  });
}
