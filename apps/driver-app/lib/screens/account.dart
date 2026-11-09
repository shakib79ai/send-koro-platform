import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../main.dart';
import '../theme.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});
  static const vehicles = {'bike': 'Bike', 'ebike': 'E-bike', 'car': 'Car', 'walk': 'On foot'};

  @override
  Widget build(BuildContext context) {
    final s = DriverScope.of(context);
    final p = s.profile!;
    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Card(
          child: ListTile(
            leading: CircleAvatar(backgroundColor: SK.orange, foregroundColor: Colors.white, child: Text(p.firstName.isEmpty ? '?' : p.firstName[0])),
            title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text('${s.api.session?.phone ?? ''} · ${vehicles[p.vehicle] ?? p.vehicle}'),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Column(children: [
            ListTile(
              leading: const Icon(Icons.account_balance_outlined),
              title: const Text('Payouts (Stripe)'),
              subtitle: const Text('Bank account, tax info and payout history'),
              trailing: const Icon(Icons.open_in_new, size: 18),
              onTap: () async {
                final url = await s.payoutsLink();
                if (url != null) await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
              },
            ),
            const Divider(height: 1),
            const ListTile(leading: Icon(Icons.support_agent_outlined), title: Text('Support'), subtitle: Text('info@shlglobal.biz · +1 917-624-8233')),
          ]),
        ),
        const SizedBox(height: 12),
        ListenableBuilder(
          listenable: s.alert,
          builder: (context, _) => Card(
            child: Column(children: [
              SwitchListTile(
                secondary: const Icon(Icons.notifications_active_outlined),
                title: const Text('Sound for new offers'),
                value: s.alert.sound,
                onChanged: s.alert.setSound,
              ),
              const Divider(height: 1),
              SwitchListTile(
                secondary: const Icon(Icons.vibration),
                title: const Text('Vibrate for new offers'),
                value: s.alert.vibrate,
                onChanged: s.alert.setVibrate,
              ),
              const Divider(height: 1),
              SwitchListTile(
                secondary: const Icon(Icons.flashlight_on_outlined),
                title: const Text('Flash light for new offers'),
                value: s.alert.flash,
                onChanged: s.alert.setFlash,
              ),
              const Divider(height: 1),
              SwitchListTile(
                secondary: const Icon(Icons.light_mode_outlined),
                title: const Text('Blink the screen for new offers'),
                value: s.alert.blink,
                onChanged: s.alert.setBlink,
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.play_circle_outline),
                title: const Text('Play the offer sound'),
                subtitle: const Text('Rings, vibrates and flashes every 4 seconds until you accept or decline'),
                onTap: s.alert.test,
              ),
            ]),
          ),
        ),
        const SizedBox(height: 12),
        const Card(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Text('Send Koro never charges drivers a subscription or fees, and never takes any part of your tips.', style: TextStyle(color: SK.muted)),
          ),
        ),
        const SizedBox(height: 20),
        OutlinedButton(onPressed: s.signOut, child: const Text('Sign out')),
      ]),
    );
  }
}
