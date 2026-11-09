import 'package:flutter/material.dart';

import '../main.dart';
import '../theme.dart';
import 'address_form.dart';
import 'sign_in.dart';

/// Pick a saved address or add a new one.
class AddressSheet extends StatefulWidget {
  const AddressSheet({super.key});
  static Future<void> open(BuildContext context) => showModalBottomSheet(context: context, isScrollControlled: true, useSafeArea: true, showDragHandle: true, builder: (_) => const AddressSheet());
  @override
  State<AddressSheet> createState() => _AddressSheetState();
}

class _AddressSheetState extends State<AddressSheet> {
  bool adding = false;
  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          const Text('Deliver to', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          if (!s.signedIn) ...[
            const Text('Sign in to save Home, Office and other addresses.', style: TextStyle(color: SK.muted)),
            const SizedBox(height: 12),
            FilledButton(onPressed: () async { final nav = Navigator.of(context); await SignInScreen.open(context); nav.pop(); }, child: const Text('Sign in / Sign up')),
          ] else if (adding || s.addresses.isEmpty)
            AddressForm(onSaved: (_) => Navigator.of(context).pop())
          else ...[
            for (final a in s.addresses)
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: s.address?.id == a.id ? SK.orange : SK.line, width: s.address?.id == a.id ? 2 : 1)),
                child: ListTile(
                  leading: Icon(a.label == 'home' ? Icons.home_outlined : a.label == 'office' ? Icons.work_outline : Icons.place_outlined),
                  title: Text(a.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(a.oneLine),
                  onTap: () { s.selectAddress(a.id); Navigator.of(context).pop(); },
                ),
              ),
            OutlinedButton.icon(onPressed: () => setState(() => adding = true), icon: const Icon(Icons.add), label: const Text('Add an address')),
          ],
        ]),
      ),
    );
  }
}
