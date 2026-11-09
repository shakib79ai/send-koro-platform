import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../main.dart';
import '../theme.dart';
import '../util/format.dart';
import 'address_form.dart';
import 'widgets.dart';

/// One flow for sign in and sign up: phone → code → (new customers) name → first address.
/// Pops with `true` once signed in.
class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});
  static Future<bool> open(BuildContext context) async =>
      (await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const SignInScreen(), fullscreenDialog: true))) ?? false;
  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  String step = 'phone';
  final phone = TextEditingController();
  final code = TextEditingController();
  final name = TextEditingController();
  final email = TextEditingController();
  String? e164;
  bool busy = false;
  String? error;

  @override
  void dispose() { phone.dispose(); code.dispose(); name.dispose(); email.dispose(); super.dispose(); }

  Future<void> _run(Future<void> Function() fn) async {
    setState(() { busy = true; error = null; });
    try { await fn(); } on ApiException catch (e) { setState(() => error = e.message); } finally { if (mounted) setState(() => busy = false); }
  }

  void _done() => Navigator.of(context).pop(true);

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final valid = toE164(phone.text);
    Widget body;
    switch (step) {
      case 'phone':
        body = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Sign in or create an account', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          const Text('One step for both. We’ll text you a code.', style: TextStyle(color: SK.muted)),
          const SizedBox(height: 20),
          TextField(controller: phone, keyboardType: TextInputType.phone, autofillHints: const [AutofillHints.telephoneNumber], decoration: const InputDecoration(labelText: 'Mobile number', hintText: '(917) 555-0123'), onChanged: (_) => setState(() {})),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: valid == null || busy ? null : () => _run(() async { await state.api.requestCode(valid); setState(() { e164 = valid; step = 'code'; }); }),
            child: const Text('Text me a code'),
          ),
          const SizedBox(height: 10),
          const Text('By continuing you agree to the Terms and Privacy Policy. Message and data rates may apply.', style: TextStyle(color: SK.muted, fontSize: 12)),
        ]);
      case 'code':
        body = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Enter the code', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text('Sent to $e164', style: const TextStyle(color: SK.muted)),
          const SizedBox(height: 20),
          TextField(controller: code, keyboardType: TextInputType.number, maxLength: 6, autofocus: true, autofillHints: const [AutofillHints.oneTimeCode], textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 26, letterSpacing: 10, fontWeight: FontWeight.w700), decoration: const InputDecoration(counterText: ''), onChanged: (_) => setState(() {})),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: code.text.length != 6 || busy ? null : () => _run(() async {
              final r = await state.api.verify(e164!, code.text);
              await state.signedInNow();
              if (r.isNew) { setState(() => step = 'profile'); } else { _done(); }
            }),
            child: const Text('Continue'),
          ),
          TextButton(onPressed: () => setState(() { step = 'phone'; code.clear(); }), child: const Text('Use a different number')),
        ]);
      case 'profile':
        body = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Welcome to Send Koro', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          const Text('Your name tells the restaurant and courier who the order is for.', style: TextStyle(color: SK.muted)),
          const SizedBox(height: 20),
          TextField(controller: name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Your name'), onChanged: (_) => setState(() {})),
          const SizedBox(height: 10),
          TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email for receipts (optional)')),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: name.text.trim().length < 2 || busy ? null : () => _run(() async { await state.api.updateProfile(name: name.text.trim(), email: email.text.trim()); setState(() => step = 'address'); }),
            child: const Text('Continue'),
          ),
        ]);
      default:
        body = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Where should we deliver?', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          const Text('Add Home now — Office and other places any time.', style: TextStyle(color: SK.muted)),
          const SizedBox(height: 16),
          AddressForm(onSaved: (_) => _done(), saveLabel: 'Save and start ordering', makeDefault: true),
          TextButton(onPressed: _done, child: const Text('Skip for now')),
        ]);
    }
    return Scaffold(
      appBar: AppBar(title: const Logo(light: true, size: 22)),
      body: SafeArea(child: ListView(padding: const EdgeInsets.all(20), children: [body, if (error != null) ...[const SizedBox(height: 12), ErrorBanner(error!)]])),
    );
  }
}
