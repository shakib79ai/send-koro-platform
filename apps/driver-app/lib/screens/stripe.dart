import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../main.dart';
import '../theme.dart';
import '../util/format.dart';
import 'widgets.dart';

/// Stripe tab: the driver's own Stripe account. Setup state and what Stripe still needs,
/// balance, payout schedule, bank, recent payouts and weekly statements (pay, 100% of tips,
/// NYC top-ups; never any fee lines). Tax forms (1099-NEC) and bank changes live in the
/// driver's Stripe Dashboard, which opens from here.
class StripeScreen extends StatefulWidget {
  const StripeScreen({super.key});
  @override
  State<StripeScreen> createState() => _StripeScreenState();
}

class _StripeScreenState extends State<StripeScreen> {
  static final dashboard = Uri.parse('https://dashboard.stripe.com');
  StripeOverview? o;
  String? error;
  ApiClient? api;

  Future<void> _load() async {
    final api = this.api;
    if (api == null) return;
    try {
      final x = await api.stripeOverview();
      if (mounted) setState(() { o = x; error = null; });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    api ??= DriverScope.of(context).api;
    if (o == null && error == null) _load();
  }

  Future<void> _setup() async {
    final url = await DriverScope.of(context).payoutsLink();
    if (url != null) await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  static const _setupText = {
    'not_started': ('Not set up', 'Connect a Stripe account to get paid.'),
    'pending': ('Stripe is checking', 'Stripe is reviewing your details. This usually takes a few minutes.'),
    'restricted': ('Action needed', 'Stripe needs more information before it can pay you.'),
    'active': ('Active', 'You get paid to your bank through Stripe.'),
  };

  @override
  Widget build(BuildContext context) {
    final x = o;
    final (label, help) = _setupText[x?.setup] ?? _setupText['not_started']!;
    return Scaffold(
      appBar: AppBar(title: const Text('Stripe')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          if (error != null) ...[ErrorBanner(message: error!), const SizedBox(height: 12)],
          if (x == null && error == null) const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator())),
          if (x != null) ...[
            if (x.error != null) ...[ErrorBanner(message: x.error!), const SizedBox(height: 12)],
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Text('Account setup', style: TextStyle(color: SK.muted)),
                  const SizedBox(height: 4),
                  Row(children: [
                    Expanded(child: Text(label, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
                    if (x.ready) const Chip(label: Text('Ready')),
                  ]),
                  Text(help, style: const TextStyle(color: SK.muted)),
                  for (final r in x.requirementsDue) Padding(padding: const EdgeInsets.only(top: 4), child: Text('• $r')),
                  if (x.setup != 'active') ...[
                    const SizedBox(height: 12),
                    FilledButton(onPressed: _setup, child: Text(x.stripeAccountId == null ? 'Connect Stripe' : 'Continue setup with Stripe')),
                  ],
                ]),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  StatRow('Available in Stripe', x.availableCents == null ? '—' : usd(x.availableCents!)),
                  StatRow('On the way to your bank', x.pendingCents == null ? '—' : usd(x.pendingCents!)),
                  const Divider(),
                  StatRow('Payout schedule', x.payoutSchedule ?? '—'),
                  StatRow('Bank', x.bankLast4 == null ? (x.stripeAccountId == null ? '—' : 'In your Stripe account') : '${x.bankName ?? 'Bank'} •••• ${x.bankLast4}'),
                ]),
              ),
            ),
            const SizedBox(height: 4),
            const Text('Your locked pay and 100% of your tip reach your Stripe balance after each delivery; any NYC minimum top-up comes on Monday. Stripe then pays your bank on the schedule above. No fees are taken from your pay or tips.', style: TextStyle(color: SK.muted, fontSize: 13)),
            const SizedBox(height: 20),
            const Text('Weekly statements', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 8),
            if (x.statement.isEmpty) const Text('No paid trips yet.', style: TextStyle(color: SK.muted)),
            for (final w in x.statement)
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(children: [
                    StatRow('Week of ${w.weekStart} · ${w.trips} trip${w.trips == 1 ? '' : 's'}', usd(w.totalCents), bold: true),
                    StatRow('Locked pay', usd(w.payCents)),
                    StatRow('Tips (100% yours)', usd(w.tipCents)),
                    if (w.topUpCents > 0) StatRow('NYC minimum top-up', usd(w.topUpCents)),
                  ]),
                ),
              ),
            const SizedBox(height: 12),
            const Text('Recent payouts to your bank', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 8),
            if (x.payouts.isEmpty) const Text('No payouts yet.', style: TextStyle(color: SK.muted)),
            for (final p in x.payouts)
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  title: Text(usd(p.amountCents), style: const TextStyle(fontWeight: FontWeight.w800)),
                  subtitle: Text(p.arrivalDate == null ? p.id : 'Arrives ${MaterialLocalizations.of(context).formatMediumDate(p.arrivalDate!)}'),
                  trailing: Text(p.status == 'paid' ? 'Paid' : p.status == 'failed' ? 'Failed' : 'On the way'),
                ),
              ),
          ],
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => launchUrl(dashboard, mode: LaunchMode.externalApplication),
            icon: const Icon(Icons.open_in_new, size: 18),
            label: const Text('Open Stripe Dashboard'),
          ),
          const SizedBox(height: 6),
          const Text('Change your bank, see every transfer and download your 1099-NEC tax form in your Stripe Dashboard. Stripe asks you to sign in.', textAlign: TextAlign.center, style: TextStyle(color: SK.muted, fontSize: 12)),
        ]),
      ),
    );
  }
}
