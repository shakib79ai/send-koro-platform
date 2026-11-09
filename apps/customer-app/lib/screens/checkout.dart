import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../main.dart';
import '../payments/pay.dart';
import '../state/cart.dart';
import '../theme.dart';
import '../util/format.dart';
import 'address_sheet.dart';
import 'sign_in.dart';
import 'tracking.dart';
import 'widgets.dart';

/// Checkout. Totals come only from the API preview; its receipt is exactly what the card is
/// charged. Placing the order authorises the card on the restaurant's Stripe account; the
/// restaurant accepting charges it.
class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});
  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  int tipPercent = 18;
  int? customTipCents;
  CheckoutPreview? preview;
  bool loading = false;
  bool placing = false;
  String? error;
  String _key = _newKey();
  String? _lastBody;
  Timer? _debounce;

  static String _newKey() {
    final r = Random.secure();
    return List.generate(16, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
  }

  @override
  void dispose() { _debounce?.cancel(); super.dispose(); }

  int _tip(Cart cart, String mode) => mode == 'pickup' ? 0 : (customTipCents ?? tipFor(cart.subtotalCents, tipPercent));

  Map<String, dynamic>? _body() {
    final s = AppScope.read(context);
    final cart = s.cart;
    if (cart == null) return null;
    return {
      'locationId': cart.locationId,
      'fulfilment': s.mode,
      if (s.mode == 'delivery' && s.address != null) 'addressId': s.address!.id,
      'lines': cart.lines.map((l) => l.toOrderLine()).toList(),
      'tipCents': _tip(cart, s.mode),
    };
  }

  void _refresh() {
    final s = AppScope.read(context);
    final body = _body();
    if (!s.signedIn || body == null || (s.mode == 'delivery' && s.address == null)) { setState(() => preview = null); return; }
    final sig = body.toString();
    if (sig == _lastBody) return;
    _lastBody = sig;
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () async {
      setState(() { loading = true; error = null; });
      try {
        final p = await s.api.preview(body);
        if (mounted) setState(() => preview = p);
      } on ApiException catch (e) {
        if (mounted) setState(() { preview = null; error = e.message; });
      } finally {
        if (mounted) setState(() => loading = false);
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    AppScope.of(context); // rebuild + re-price when the cart, address or mode changes
    WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) _refresh(); });
  }

  Future<void> _place() async {
    final s = AppScope.read(context);
    final p = preview;
    final body = _body();
    if (p == null || body == null) return;
    setState(() { placing = true; error = null; });
    try {
      final placed = await s.api.place({...body, 'idempotencyKey': _key, 'expectedTotalCents': p.receipt.totalCents});
      final pay = placed.payment;
      if (pay != null) {
        final r = await payWithStripe(clientSecret: pay.clientSecret, stripeAccount: pay.stripeAccount, merchantName: p.restaurantName);
        if (r.outcome == PayOutcome.cancelled) { setState(() => placing = false); return; }
        if (r.outcome == PayOutcome.failed) { setState(() { placing = false; error = r.message; }); return; }
      }
      try { await s.api.paymentConfirmed(placed.orderId); } catch (_) {}
      s.clearCart();
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => TrackingScreen(orderId: placed.orderId)));
    } on ApiException catch (e) {
      if (e.code == 'price_changed') { _key = _newKey(); _lastBody = null; _refresh(); }
      setState(() { placing = false; error = e.message; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final cart = s.cart;
    if (cart == null || cart.isEmpty) {
      return Scaffold(appBar: AppBar(title: const Text('Checkout')), body: const Center(child: Text('Your cart is empty.')));
    }
    final p = preview;
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (!s.signedIn)
              FilledButton(onPressed: () async { if (await SignInScreen.open(context)) { _lastBody = null; _refresh(); } }, child: const Text('Sign in to check out'))
            else
              FilledButton(onPressed: p == null || placing || loading ? null : _place, child: Text(placing ? 'Placing order…' : p == null ? 'Place order' : 'Place order · ${usd(p.receipt.totalCents)}')),
            const SizedBox(height: 6),
            Text('Charged only when ${cart.restaurantName} accepts. No card fees.', textAlign: TextAlign.center, style: const TextStyle(color: SK.muted, fontSize: 12)),
          ]),
        ),
      ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: Text(cart.restaurantName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17))),
                if (p != null) Text('about ${p.etaMinutes} min', style: const TextStyle(color: SK.muted)),
              ]),
              const SizedBox(height: 6),
              for (final l in cart.lines)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(l.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                      if (l.optionNames.isNotEmpty) Text(l.optionNames.join(' · '), style: const TextStyle(color: SK.muted, fontSize: 12)),
                    ])),
                    IconButton(visualDensity: VisualDensity.compact, onPressed: () => s.setQuantity(l.key, l.quantity - 1), icon: const Icon(Icons.remove_circle_outline)),
                    Text('${l.quantity}', style: const TextStyle(fontWeight: FontWeight.w700)),
                    IconButton(visualDensity: VisualDensity.compact, onPressed: () => s.setQuantity(l.key, l.quantity + 1), icon: const Icon(Icons.add_circle_outline)),
                  ]),
                ),
            ]),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SegmentedButton<String>(
                segments: const [ButtonSegment(value: 'delivery', label: Text('Delivery')), ButtonSegment(value: 'pickup', label: Text('Pickup'))],
                selected: {s.mode},
                onSelectionChanged: (v) => s.setMode(v.first),
              ),
              const SizedBox(height: 10),
              if (s.mode == 'pickup')
                Text('Collect from ${cart.restaurantName}. We’ll tell you when it’s ready.', style: const TextStyle(color: SK.muted))
              else
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.place_outlined, color: SK.orange),
                  title: Text(s.address == null ? 'Add a delivery address' : '${s.address!.title} · ${s.address!.line1}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: s.address == null ? null : Text([s.address!.city, s.address!.postalCode, if (s.address!.dropoffInstructions != null) '“${s.address!.dropoffInstructions}”'].join(' · ')),
                  trailing: const Text('Change', style: TextStyle(color: SK.orange, fontWeight: FontWeight.w700)),
                  onTap: () => AddressSheet.open(context),
                ),
            ]),
          ),
        ),
        if (s.mode == 'delivery') ...[
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Row(children: [Expanded(child: Text('Tip your courier', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16))), Pill('100% goes to them', bg: Color(0xFFE6F5EC), fg: SK.green)]),
                const SizedBox(height: 10),
                Row(children: [
                  for (final pct in const [15, 18, 20]) ...[
                    Expanded(
                      child: ChoiceChip(
                        showCheckmark: false,
                        label: Column(mainAxisSize: MainAxisSize.min, children: [Text('$pct%', style: const TextStyle(fontWeight: FontWeight.w800)), Text(usd(tipFor(cart.subtotalCents, pct)), style: const TextStyle(fontSize: 12))]),
                        selected: customTipCents == null && tipPercent == pct,
                        onSelected: (_) { setState(() { tipPercent = pct; customTipCents = null; }); _refresh(); },
                      ),
                    ),
                    const SizedBox(width: 6),
                  ],
                  Expanded(
                    child: ChoiceChip(
                      showCheckmark: false,
                      label: const Column(mainAxisSize: MainAxisSize.min, children: [Text('No tip', style: TextStyle(fontWeight: FontWeight.w800)), Text('\$0.00', style: TextStyle(fontSize: 12))]),
                      selected: customTipCents == 0,
                      onSelected: (_) { setState(() => customTipCents = 0); _refresh(); },
                    ),
                  ),
                ]),
                const SizedBox(height: 6),
                const Text('Paid in full to your courier after delivery.', style: TextStyle(color: SK.muted, fontSize: 12)),
              ]),
            ),
          ),
        ],
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: !s.signedIn
                ? const Text('Sign in to see your total with tax and delivery.', style: TextStyle(color: SK.muted))
                : p != null
                    ? ReceiptView(p.receipt)
                    : loading
                        ? const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator()))
                        : Text(s.mode == 'delivery' && s.address == null ? 'Add an address to see your total.' : 'Pricing your order…', style: const TextStyle(color: SK.muted)),
          ),
        ),
        if (error != null) ...[const SizedBox(height: 12), ErrorBanner(error!)],
        const SizedBox(height: 8),
        const Text('Pay with card, Apple Pay or Google Pay on the next step. Your card details go straight to Stripe.', textAlign: TextAlign.center, style: TextStyle(color: SK.muted, fontSize: 12)),
      ]),
    );
  }
}
