import 'package:flutter/material.dart';

import '../main.dart';
import 'account.dart';
import 'home.dart';
import 'orders.dart';

/// Browsing works signed out; signing in is asked for at checkout, orders and account.
class Root extends StatefulWidget {
  const Root({super.key});
  @override
  State<Root> createState() => _RootState();
}

class _RootState extends State<Root> {
  int tab = 0;
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    if (!s.loaded) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    return Scaffold(
      body: IndexedStack(index: tab, children: const [HomeScreen(), OrdersScreen(), AccountScreen()]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (i) => setState(() => tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Orders'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Account'),
        ],
      ),
    );
  }
}
