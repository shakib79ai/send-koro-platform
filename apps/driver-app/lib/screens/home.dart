import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/models.dart';
import '../main.dart';
import '../state/driver_state.dart';
import '../theme.dart';
import '../util/format.dart';
import 'widgets.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final s = DriverScope.of(context);
    final offer = s.currentOffer;
    final blinking = s.online && !s.onTrip && offer != null && s.alert.blink;
    return OfferBlink(
      key: ValueKey(blinking ? offer!.id : 'still'),
      active: blinking,
      child: Scaffold(
      appBar: AppBar(
        title: const Logo(light: true, size: 22),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Row(children: [
              Text(s.online ? 'Online' : 'Offline', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
              const SizedBox(width: 6),
              Switch(
                value: s.online,
                activeTrackColor: SK.green,
                onChanged: s.busy ? null : (v) => v ? s.goOnline() : s.goOffline(),
              ),
            ]),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: s.refreshProfile,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          if (s.error != null) ...[ErrorBanner(message: s.error!, onClose: s.clearError), const SizedBox(height: 12)],
          if (s.onTrip)
            TripView(state: s)
          else if (offer != null)
            OfferCard(key: ValueKey(offer.id), offer: offer, state: s)
          else
            _Idle(state: s),
        ]),
      ),
    ),
    );
  }
}

/// Blinks the whole screen red/white while a new offer waits: 4 quick blinks (2 per second, within
/// photosensitivity guidance), then a soft red pulse until the driver answers.
/// With "Reduce motion" on, it shows a steady red edge instead.
class OfferBlink extends StatefulWidget {
  const OfferBlink({super.key, required this.active, required this.child});
  final bool active;
  final Widget child;
  @override
  State<OfferBlink> createState() => _OfferBlinkState();
}

class _OfferBlinkState extends State<OfferBlink> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1));
  int _cycles = 0;

  @override
  void initState() {
    super.initState();
    _c.addStatusListener((st) {
      if (st == AnimationStatus.completed && mounted && widget.active) {
        _cycles++;
        _c.forward(from: 0);
      }
    });
    if (widget.active) _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) return widget.child;
    final reduce = MediaQuery.of(context).disableAnimations;
    return Stack(children: [
      widget.child,
      Positioned.fill(
        child: IgnorePointer(
          child: reduce
              ? DecoratedBox(decoration: BoxDecoration(border: Border.all(color: SK.red, width: 6)))
              : AnimatedBuilder(
                  animation: _c,
                  builder: (context, _) {
                    final v = _c.value;
                    final wave = v < 0.5 ? v * 2 : (1 - v) * 2; // 0 → 1 → 0 over one second
                    if (_cycles < 4) {
                      // quick blinks: red on the first half, white on the second
                      final color = v < 0.5 ? SK.red : Colors.white;
                      final strength = v < 0.5 ? 0.55 : 0.35;
                      final pulse = v < 0.5 ? (v < 0.25 ? v * 4 : (0.5 - v) * 4) : (v < 0.75 ? (v - 0.5) * 4 : (1 - v) * 4);
                      return ColoredBox(color: color.withValues(alpha: strength * pulse));
                    }
                    return ColoredBox(color: SK.red.withValues(alpha: 0.12 * wave));
                  },
                ),
        ),
      ),
    ]);
  }
}

class _Idle extends StatelessWidget {
  const _Idle({required this.state});
  final DriverState state;
  @override
  Widget build(BuildContext context) {
    final online = state.online;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Card(
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(children: [
            Icon(online ? Icons.radar : Icons.delivery_dining, size: 56, color: online ? SK.orange : SK.muted),
            const SizedBox(height: 12),
            Text(online ? 'Looking for orders near you' : 'You’re offline', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(
              online ? 'Keep the app open. Offers show the distance, total time and your pay before you accept.' : 'Go online to start getting offers from restaurants nearby.',
              textAlign: TextAlign.center, style: const TextStyle(color: SK.muted),
            ),
            const SizedBox(height: 16),
            if (!online) FilledButton(onPressed: state.busy ? null : state.goOnline, child: const Text('Go online')),
          ]),
        ),
      ),
      const SizedBox(height: 12),
      const _Promise(),
    ]);
  }
}

class _Promise extends StatelessWidget {
  const _Promise();
  @override
  Widget build(BuildContext context) => const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Your pay, our promise', style: TextStyle(fontWeight: FontWeight.w800)),
            SizedBox(height: 8),
            Text('• The pay on an offer is locked — it never goes down for traffic or waiting.'),
            Text('• 100% of every tip is yours. We never use tips to make up your pay.'),
            Text('• NYC minimum pay: if a week’s pay is under \$22.13 per hour of trip time, we add the difference.'),
            Text('• No subscription and no fees. Paid weekly to your own Stripe account.'),
          ]),
        ),
      );
}

/// Upfront, locked offer with a countdown. Accepting locks the pay shown.
class OfferCard extends StatefulWidget {
  const OfferCard({super.key, required this.offer, required this.state});
  final Offer offer;
  final DriverState state;
  @override
  State<OfferCard> createState() => _OfferCardState();
}

class _OfferCardState extends State<OfferCard> {
  late Timer timer;
  Duration left = Duration.zero;

  @override
  void initState() {
    super.initState();
    left = widget.offer.expiresAt.difference(DateTime.now());
    timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void _tick() {
    final l = widget.offer.expiresAt.difference(DateTime.now());
    if (l.isNegative) {
      timer.cancel();
      WidgetsBinding.instance.addPostFrameCallback((_) => widget.state.expire(widget.offer));
    }
    if (mounted) setState(() => left = l);
  }

  @override
  void dispose() {
    timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.offer;
    final s = widget.state;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: const BorderSide(color: SK.orange, width: 2)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: const Color(0xFFEAF1F8), borderRadius: BorderRadius.circular(999)),
              child: Text(o.isBatch ? '2 orders · one route' : 'New offer', style: const TextStyle(color: SK.orange, fontWeight: FontWeight.w700)),
            ),
            const Spacer(),
            Text(countdown(left), style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()])),
          ]),
          const SizedBox(height: 16),
          Text(usd(o.payCents), style: const TextStyle(fontSize: 44, fontWeight: FontWeight.w800, letterSpacing: -1)),
          const Text('Locked pay · plus 100% of any tip', style: TextStyle(color: SK.muted)),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: _Fact(icon: Icons.route, label: 'Distance', value: miles(o.distanceMeters))),
            Expanded(child: _Fact(icon: Icons.schedule, label: 'Total time', value: minutes(o.durationSeconds))),
            Expanded(child: _Fact(icon: Icons.storefront, label: 'Stops', value: '${1 + o.orderIds.length}')),
          ]),
          const SizedBox(height: 14),
          LinearProgressIndicator(value: (left.inSeconds / 45).clamp(0, 1).toDouble(), color: SK.orange, backgroundColor: SK.line, minHeight: 6, borderRadius: BorderRadius.circular(6)),
          const SizedBox(height: 16),
          FilledButton(onPressed: s.busy ? null : () => s.accept(o), child: Text('Accept · ${usd(o.payCents)}')),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: s.busy ? null : () => s.decline(o), child: const Text('Decline')),
          const SizedBox(height: 6),
          const Text('Declining doesn’t affect your access to future offers.', textAlign: TextAlign.center, style: TextStyle(color: SK.muted, fontSize: 12)),
        ]),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Column(children: [
        Icon(icon, color: SK.muted),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        Text(label, style: const TextStyle(color: SK.muted, fontSize: 12)),
      ]);
}

/// Current trip: pick up every order first, then drop each one off.
class TripView extends StatelessWidget {
  const TripView({super.key, required this.state});
  final DriverState state;

  Future<void> _navigate(Stop stop) async {
    final uri = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=bicycling');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _call(String phone) async {
    if (phone.isEmpty) return;
    await launchUrl(Uri(scheme: 'tel', path: phone));
  }

  @override
  Widget build(BuildContext context) {
    final trip = state.trip;
    final toPickUp = trip.where((t) => !t.pickedUp).toList();
    final toDrop = trip.where((t) => t.pickedUp).toList();
    final pay = trip.fold<int>(0, (a, t) => a + t.payCents);
    final tips = trip.fold<int>(0, (a, t) => a + t.tipCents);

    Widget stopCard(TripStop t, {required bool pickup}) {
      final stop = pickup ? t.pickup : t.dropoff;
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Icon(pickup ? Icons.storefront : Icons.home_outlined, color: SK.orange),
              const SizedBox(width: 8),
              Expanded(child: Text(pickup ? 'Pick up at ${stop.name}' : 'Deliver to ${stop.name}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
              Text('#${t.code.replaceFirst('SK-', '')}', style: const TextStyle(fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 6),
            Text(stop.address),
            if (stop.instructions != null && stop.instructions!.isNotEmpty) Text('“${stop.instructions}”', style: const TextStyle(color: SK.muted)),
            if (pickup) ...[
              const SizedBox(height: 8),
              for (final i in t.items) Text('${i.quantity}× ${i.name}', style: const TextStyle(color: SK.muted)),
            ],
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: OutlinedButton.icon(onPressed: () => _navigate(stop), icon: const Icon(Icons.navigation_outlined), label: const Text('Navigate'))),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton.icon(onPressed: stop.phone.isEmpty ? null : () => _call(stop.phone), icon: const Icon(Icons.call_outlined), label: const Text('Call'))),
            ]),
            const SizedBox(height: 8),
            if (pickup && t.status == 'assigned')
              FilledButton(onPressed: state.busy ? null : () => state.arrived(t), child: const Text('I’m at the restaurant'))
            else if (pickup)
              FilledButton(onPressed: state.busy ? null : () => state.pickedUp(t), child: Text('Picked up #${t.code.replaceFirst('SK-', '')}'))
            else
              FilledButton(
                onPressed: state.busy ? null : () async {
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (c) => AlertDialog(
                      title: const Text('Delivered?'),
                      content: Text('Confirm you handed order #${t.code.replaceFirst('SK-', '')} to the customer or left it as instructed.'),
                      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Not yet')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Delivered'))],
                    ),
                  );
                  if (ok == true) await state.delivered(t);
                },
                child: const Text('Mark delivered'),
              ),
          ]),
        ),
      );
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Card(
        color: SK.ink,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(trip.length > 1 ? '${trip.length} orders on this trip' : 'Current trip', style: const TextStyle(color: Color(0xFFDCE5EF))),
              Text(usd(pay), style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800)),
            ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              const Text('Tips (100% yours)', style: TextStyle(color: Color(0xFFDCE5EF), fontSize: 12)),
              Text('+ ${usd(tips)}', style: const TextStyle(color: SK.orange, fontWeight: FontWeight.w800, fontSize: 18)),
            ]),
          ]),
        ),
      ),
      const SizedBox(height: 12),
      for (final t in toPickUp) ...[stopCard(t, pickup: true), const SizedBox(height: 12)],
      for (final t in toDrop) ...[stopCard(t, pickup: false), const SizedBox(height: 12)],
      if (toPickUp.isNotEmpty && toDrop.isNotEmpty) const Text('Pick up every order before heading to drop-offs.', textAlign: TextAlign.center, style: TextStyle(color: SK.muted)),
    ]);
  }
}
