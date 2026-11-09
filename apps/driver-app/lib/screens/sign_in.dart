import 'package:flutter/material.dart';

import '../main.dart';
import '../theme.dart';
import '../util/format.dart';
import 'widgets.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});
  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final phone = TextEditingController();
  final code = TextEditingController();
  String? sentTo;

  @override
  void dispose() {
    phone.dispose();
    code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = DriverScope.of(context);
    final e164 = toE164(phone.text);
    return Scaffold(
      backgroundColor: SK.ink,
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(24), children: [
          const SizedBox(height: 24),
          const Logo(light: true, size: 30),
          const Text('DRIVER', style: TextStyle(color: SK.orange, fontWeight: FontWeight.w800, letterSpacing: 2.5, fontSize: 12)),
          const SizedBox(height: 28),
          const Text('Deliver with Send Koro', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800, height: 1.15)),
          const SizedBox(height: 10),
          const Text('See the pay before you accept — it never goes down. 100% of tips are yours. NYC minimum pay guaranteed.', style: TextStyle(color: Color(0xFFDCE5EF), height: 1.4)),
          const SizedBox(height: 28),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (sentTo == null) ...[
                  const Text('Mobile number', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  TextField(controller: phone, keyboardType: TextInputType.phone, autofillHints: const [AutofillHints.telephoneNumber], decoration: const InputDecoration(hintText: '(917) 555-0123'), onChanged: (_) => setState(() {})),
                  const SizedBox(height: 14),
                  FilledButton(
                    onPressed: e164 == null || s.busy ? null : () async { if (await s.requestCode(e164)) setState(() => sentTo = e164); },
                    child: const Text('Text me a code'),
                  ),
                ] else ...[
                  Text('Enter the 6-digit code sent to $sentTo', style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: code, keyboardType: TextInputType.number, maxLength: 6, autofillHints: const [AutofillHints.oneTimeCode], autofocus: true,
                    textAlign: TextAlign.center, style: const TextStyle(fontSize: 26, letterSpacing: 10, fontWeight: FontWeight.w700),
                    decoration: const InputDecoration(counterText: ''), onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 14),
                  FilledButton(onPressed: code.text.length != 6 || s.busy ? null : () => s.verify(sentTo!, code.text), child: const Text('Continue')),
                  TextButton(onPressed: () => setState(() { sentTo = null; code.clear(); }), child: const Text('Use a different number')),
                ],
                if (s.error != null) ...[const SizedBox(height: 12), ErrorBanner(message: s.error!, onClose: s.clearError)],
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}
