import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../main.dart';
import '../state/cart.dart';
import '../theme.dart';
import '../util/format.dart';
import 'checkout.dart';
import 'sign_in.dart';
import 'tracking.dart';
import 'widgets.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  List<CustomerOrder>? orders;
  String? error;
  String? _loadedFor;

  Future<void> _load() async {
    try {
      final o = await AppScope.read(context).api.orders();
      if (mounted) setState(() { orders = o; error = null; });
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final s = AppScope.of(context);
    final who = s.session?.userId;
    if (who != null && who != _loadedFor) { _loadedFor = who; _load(); }
  }

  void _reorder(CustomerOrder o) {
    final s = AppScope.read(context);
    for (final i in o.items) {
      s.addToCart(o.locationId, o.restaurantName, CartLine(itemId: i.itemId, name: i.name, quantity: i.quantity, optionIds: i.optionIds, optionNames: i.optionNames, unitCents: i.unitCents, note: i.note));
    }
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CheckoutScreen()));
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: !s.signedIn
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Text('Sign in to see your orders.', style: TextStyle(color: SK.muted)),
              const SizedBox(height: 12),
              FilledButton(onPressed: () => SignInScreen.open(context), child: const Text('Sign in / Sign up')),
            ])))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.all(16), children: [
                if (error != null) ErrorBanner(error!),
                if (orders == null && error == null) const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator())),
                if (orders != null && orders!.isEmpty) const Text('No orders yet.', style: TextStyle(color: SK.muted)),
                for (final o in orders ?? const <CustomerOrder>[])
                  Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TrackingScreen(orderId: o.id))),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Expanded(child: Text(o.restaurantName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
                            o.isLive ? Pill(o.statusText.length > 24 ? 'In progress' : o.statusText) : Pill(o.statusText.length > 24 ? o.status : o.statusText, bg: const Color(0xFFEFEEE9), fg: SK.muted),
                          ]),
                          const SizedBox(height: 4),
                          Text(o.items.map((i) => '${i.quantity}× ${i.name}').join(', '), style: const TextStyle(color: SK.muted)),
                          const SizedBox(height: 4),
                          Row(children: [
                            Expanded(child: Text('${o.code} · ${MaterialLocalizations.of(context).formatMediumDate(o.createdAt)} · ${usd(o.totalCents)}', style: const TextStyle(fontSize: 12, color: SK.muted))),
                            if (!o.isLive && o.items.isNotEmpty) TextButton(onPressed: () => _reorder(o), child: const Text('Reorder')),
                          ]),
                        ]),
                      ),
                    ),
                  ),
              ]),
            ),
    );
  }
}
