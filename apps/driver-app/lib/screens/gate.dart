import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/models.dart';
import '../main.dart';
import '../theme.dart';
import 'widgets.dart';

/// Shown until the driver is approved and their Stripe payout account is ready.
class GateScreen extends StatelessWidget {
  const GateScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final s = DriverScope.of(context);
    final p = s.profile!;
    Widget step(bool done, String title, String body, {Widget? action}) => Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(done ? Icons.check_circle : Icons.radio_button_unchecked, color: done ? SK.green : SK.muted),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(body, style: const TextStyle(color: SK.muted)),
                if (action != null) ...[const SizedBox(height: 12), action],
              ])),
            ]),
          ),
        );
    return Scaffold(
      appBar: AppBar(title: Text('Hi ${p.firstName}'), actions: [TextButton(onPressed: s.signOut, child: const Text('Sign out', style: TextStyle(color: Colors.white)))]),
      body: RefreshIndicator(
        onRefresh: s.refreshProfile,
        child: ListView(padding: const EdgeInsets.all(20), children: [
          const Text('Almost ready to drive', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          step(true, 'Application sent', 'Thanks — we have your details.'),
          const SizedBox(height: 10),
          step(
            p.payoutsReady, 'Get paid with Stripe',
            'Your pay and 100% of tips go to your own Stripe account and are paid out weekly. Stripe checks your identity and bank on its secure pages.',
            action: p.payoutsReady ? null : FilledButton(
              onPressed: s.busy ? null : () async {
                final url = await s.payoutsLink();
                if (url != null) await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
              },
              child: const Text('Set up payouts'),
            ),
          ),
          const SizedBox(height: 10),
          step(p.status == DriverStatus.approved, p.status == DriverStatus.suspended ? 'Account on hold' : 'Approval',
              p.status == DriverStatus.suspended ? 'Your account is on hold. Contact support at info@shlglobal.biz.' : 'We review new drivers quickly. We’ll text you when you’re approved.'),
          const SizedBox(height: 18),
          OutlinedButton.icon(onPressed: s.busy ? null : s.refreshProfile, icon: const Icon(Icons.refresh), label: const Text('Check again')),
          if (s.error != null) ...[const SizedBox(height: 12), ErrorBanner(message: s.error!, onClose: s.clearError)],
        ]),
      ),
    );
  }
}
