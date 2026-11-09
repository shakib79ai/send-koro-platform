import 'package:flutter/material.dart';

import '../main.dart';
import 'widgets.dart';

class ApplyScreen extends StatefulWidget {
  const ApplyScreen({super.key});
  @override
  State<ApplyScreen> createState() => _ApplyScreenState();
}

class _ApplyScreenState extends State<ApplyScreen> {
  final name = TextEditingController();
  final email = TextEditingController();
  String vehicle = 'ebike';
  static const vehicles = {'bike': 'Bike', 'ebike': 'E-bike', 'car': 'Car', 'walk': 'On foot'};

  @override
  void dispose() { name.dispose(); email.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final s = DriverScope.of(context);
    final valid = name.text.trim().length >= 2 && email.text.contains('@');
    return Scaffold(
      appBar: AppBar(title: const Text('Become a driver'), actions: [TextButton(onPressed: s.signOut, child: const Text('Sign out', style: TextStyle(color: Colors.white)))]),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        const Text('Tell us about you', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('No subscription and no fees. You’ll set up payouts with Stripe next, and we review your application.'),
        const SizedBox(height: 20),
        TextField(controller: name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Full legal name'), onChanged: (_) => setState(() {})),
        const SizedBox(height: 12),
        TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email'), onChanged: (_) => setState(() {})),
        const SizedBox(height: 18),
        const Text('How will you deliver?', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final e in vehicles.entries) ChoiceChip(label: Text(e.value), selected: vehicle == e.key, onSelected: (_) => setState(() => vehicle = e.key)),
        ]),
        const SizedBox(height: 24),
        if (s.error != null) ...[ErrorBanner(message: s.error!, onClose: s.clearError), const SizedBox(height: 12)],
        FilledButton(onPressed: !valid || s.busy ? null : () => s.apply(name.text.trim(), email.text.trim(), vehicle), child: const Text('Submit application')),
      ]),
    );
  }
}
