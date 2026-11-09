import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'screens/root.dart';
import 'state/app_state.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final state = AppState(ApiClient())..start();
  runApp(CustomerApp(state: state));
}

class CustomerApp extends StatelessWidget {
  const CustomerApp({super.key, required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) => AppScope(
        state: state,
        child: MaterialApp(title: 'Send Koro', debugShowCheckedModeBanner: false, theme: SK.theme(), home: const Root()),
      );
}

/// Gives every screen access to [AppState] and rebuilds them when it changes.
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child}) : super(notifier: state);
  static AppState of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;
  static AppState read(BuildContext context) => context.getInheritedWidgetOfExactType<AppScope>()!.notifier!;
}
