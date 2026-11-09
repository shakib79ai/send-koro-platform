import 'dart:async';

import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../main.dart';
import '../theme.dart';
import 'widgets.dart';

/// Live order status. Refreshes every 10 seconds. Never names the courier company.
class TrackingScreen extends StatefulWidget {
  const TrackingScreen({super.key, required this.orderId});
  final String orderId;
  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  CustomerOrder? order;
  String? error;
  Timer? timer;
  bool cancelling = false;

  static const _deliverySteps = [('placed', 'Order sent to the restaurant'), ('accepted', 'Restaurant accepted · card charged'), ('preparing', 'Preparing your food'), ('picked_up', 'On the way'), ('delivered', 'Delivered')];
  static const _pickupSteps = [('placed', 'Order sent to the restaurant'), ('accepted', 'Restaurant accepted · card charged'), ('preparing', 'Preparing your food'), ('ready', 'Ready for pickup'), ('completed', 'Picked up')];
  static const _rank = {'pending_payment': 0.0, 'placed': 1.0, 'accepted': 2.0, 'preparing': 3.0, 'ready': 3.5, 'picked_up': 4.0, 'delivered': 5.0, 'completed': 5.0};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    timer = Timer.periodic(const Duration(seconds: 10), (_) => _load());
  }

  @override
  void dispose() { timer?.cancel(); super.dispose(); }

  Future<void> _load() async {
    try {
      final o = await AppScope.read(context).api.order(widget.orderId);
      if (mounted) setState(() { order = o; error = null; });
      if (!o.isLive && o.status != 'pending_payment') timer?.cancel();
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  Future<void> _cancel() async {
    setState(() => cancelling = true);
    try {
      final o = await AppScope.read(context).api.cancel(widget.orderId);
      if (mounted) setState(() => order = o);
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = order;
    return Scaffold(
      appBar: AppBar(title: Text(o == null ? 'Your order' : 'Order ${o.code}')),
      body: o == null
          ? (error != null ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(error!)) : const Center(child: CircularProgressIndicator()))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.all(16), children: [
                Text(o.restaurantName, style: const TextStyle(color: SK.muted)),
                Text(o.statusText, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, height: 1.15)),
                const SizedBox(height: 16),
                if (o.status == 'declined' || o.status == 'cancelled')
                  Card(child: Padding(padding: const EdgeInsets.all(16), child: Text(o.status == 'declined' ? 'The restaurant couldn’t take this order. Your card was not charged — the hold is released.' : 'This order was cancelled. Any hold on your card is released.')))
                else
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(children: [
                        for (final (key, label) in (o.fulfilment == 'pickup' ? _pickupSteps : _deliverySteps))
                          _Step(label: label, done: (_rank[o.status] ?? 0) >= (_rank[key] ?? 9), now: (_rank[o.status] ?? 0) < (_rank[key] ?? 9) && (_rank[o.status] ?? 0) >= (_rank[key] ?? 9) - 1),
                      ]),
                    ),
                  ),
                if (o.courierFirstName != null) ...[
                  const SizedBox(height: 12),
                  Card(child: ListTile(leading: const Icon(Icons.delivery_dining, color: SK.orange), title: Text('Your courier ${o.courierFirstName}'), subtitle: Text(o.status == 'picked_up' ? 'On the way to you' : 'Heading to the restaurant'))),
                ],
                if (o.status == 'placed' || o.status == 'pending_payment') ...[
                  const SizedBox(height: 12),
                  OutlinedButton(onPressed: cancelling ? null : _cancel, child: const Text('Cancel order')),
                ],
                const SizedBox(height: 16),
                const Text('Receipt', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
                const SizedBox(height: 6),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      for (final i in o.items) Text('${i.quantity}× ${i.name}${i.optionNames.isEmpty ? '' : ' · ${i.optionNames.join(', ')}'}'),
                      const SizedBox(height: 8),
                      if (o.receipt != null) ReceiptView(o.receipt!),
                    ]),
                  ),
                ),
                if (error != null) ...[const SizedBox(height: 12), ErrorBanner(error!)],
              ]),
            ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.label, required this.done, required this.now});
  final String label;
  final bool done;
  final bool now;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(children: [
          Container(
            width: 22, height: 22,
            decoration: BoxDecoration(shape: BoxShape.circle, color: done ? SK.orange : Colors.white, border: Border.all(color: done || now ? SK.orange : SK.line, width: 2)),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: TextStyle(color: done || now ? SK.ink : SK.muted, fontWeight: done ? FontWeight.w600 : FontWeight.w400))),
        ]),
      );
}
