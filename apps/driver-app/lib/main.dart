import 'package:flutter/material.dart';

import 'api/api_client.dart';
import 'screens/root.dart';
import 'state/driver_state.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final state = DriverState(ApiClient())..start();
  runApp(DriverApp(state: state));
}

class DriverApp extends StatelessWidget {
  const DriverApp({super.key, required this.state});
  final DriverState state;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Send Koro Driver',
      debugShowCheckedModeBanner: false,
      theme: SK.theme(),
      home: DriverScope(state: state, child: const Root()),
    );
  }
}

/// Gives every screen access to [DriverState] and rebuilds them when it changes.
class DriverScope extends InheritedNotifier<DriverState> {
  const DriverScope({super.key, required DriverState state, required super.child}) : super(notifier: state);

  static DriverState of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<DriverScope>()!.notifier!;
}
