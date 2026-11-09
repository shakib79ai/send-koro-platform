import 'package:flutter/material.dart';

import '../api/models.dart';
import '../main.dart';
import 'account.dart';
import 'apply.dart';
import 'earnings.dart';
import 'gate.dart';
import 'home.dart';
import 'sign_in.dart';
import 'stripe.dart';

/// Signed out → sign in. No profile → apply. Not approved or no payouts → gate. Otherwise the app.
class Root extends StatelessWidget {
  const Root({super.key});

  @override
  Widget build(BuildContext context) {
    final s = DriverScope.of(context);
    if (!s.loaded) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (!s.signedIn) return const SignInScreen();
    final p = s.profile;
    if (p == null) return const ApplyScreen();
    if (p.status != DriverStatus.approved || !p.payoutsReady) return const GateScreen();
    return const Shell();
  }
}

class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int tab = 0;
  @override
  Widget build(BuildContext context) {
    const pages = [HomeScreen(), EarningsScreen(), StripeScreen(), AccountScreen()];
    return Scaffold(
      body: IndexedStack(index: tab, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (i) => setState(() => tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.delivery_dining_outlined), selectedIcon: Icon(Icons.delivery_dining), label: 'Drive'),
          NavigationDestination(icon: Icon(Icons.payments_outlined), selectedIcon: Icon(Icons.payments), label: 'Earnings'),
          NavigationDestination(icon: Icon(Icons.account_balance_outlined), selectedIcon: Icon(Icons.account_balance), label: 'Stripe'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Account'),
        ],
      ),
    );
  }
}
