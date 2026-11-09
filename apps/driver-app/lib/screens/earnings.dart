import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../main.dart';
import '../theme.dart';
import '../util/format.dart';
import 'widgets.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});
  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  WeekEarnings? week;
  List<PastDelivery> history = const [];
  String? error;
  ApiClient? api;

  Future<void> _load() async {
    final api = this.api;
    if (api == null) return;
    try {
      final w = await api.earnings();
      final h = await api.history();
      if (mounted) setState(() { week = w; history = h; error = null; });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    api ??= DriverScope.of(context).api;
    if (week == null && error == null) _load();
  }

  @override
  Widget build(BuildContext context) {
    final w = week;
    return Scaffold(
      appBar: AppBar(title: const Text('Earnings')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          if (error != null) ...[ErrorBanner(message: error!), const SizedBox(height: 12)],
          if (w == null && error == null) const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator())),
          if (w != null) ...[
            Card(
              color: SK.ink,
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('This week · from ${w.weekStart}', style: const TextStyle(color: Color(0xFFDCE5EF))),
                  const SizedBox(height: 4),
                  Text(usd(w.totalCents), style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w800)),
                  Text('${w.trips} trips · ${hours(w.tripSeconds)} on trips', style: const TextStyle(color: Color(0xFFDCE5EF))),
                ]),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  StatRow('Locked offer pay', usd(w.payCents)),
                  StatRow('Tips (100% yours)', usd(w.tipsCents)),
                  StatRow('NYC minimum top-up', usd(w.nycTopUpCents)),
                  const Divider(),
                  StatRow('Total', usd(w.totalCents), bold: true),
                ]),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('NYC minimum pay check', style: TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Text('${hours(w.tripSeconds)} of trip time × \$22.13/hour = ${usd(w.nycMinimumCents)} minimum. '
                      '${w.nycTopUpCents > 0 ? 'Your offer pay is ${usd(w.payCents)}, so ${usd(w.nycTopUpCents)} is added to Monday’s payout.' : 'Your offer pay is above the minimum.'} Tips never count toward it.',
                      style: const TextStyle(color: SK.muted)),
                ]),
              ),
            ),
            const SizedBox(height: 12),
            const Text('Payouts go to your Stripe account every Monday.', style: TextStyle(color: SK.muted)),
          ],
          const SizedBox(height: 20),
          const Text('Recent deliveries', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 8),
          if (history.isEmpty && w != null) const Text('No deliveries yet.', style: TextStyle(color: SK.muted)),
          for (final d in history)
            Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text('#${d.code.replaceFirst('SK-', '')} · ${miles(d.distanceMeters)}'),
                subtitle: Text(d.deliveredAt == null ? '' : MaterialLocalizations.of(context).formatMediumDate(d.deliveredAt!)),
                trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(usd(d.payCents + d.tipCents), style: const TextStyle(fontWeight: FontWeight.w800)),
                  if (d.tipCents > 0) Text('incl. ${usd(d.tipCents)} tip', style: const TextStyle(color: SK.muted, fontSize: 12)),
                ]),
              ),
            ),
        ]),
      ),
    );
  }
}
