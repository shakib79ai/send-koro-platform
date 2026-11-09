import 'package:flutter/material.dart';

import '../main.dart';
import '../theme.dart';
import 'address_form.dart';
import 'sign_in.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});
  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  bool adding = false;

  @override
  Widget build(BuildContext context) {
    final s = AppScope.of(context);
    final me = s.session;
    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: me == null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Text('Sign in to save addresses and see your orders.', textAlign: TextAlign.center, style: TextStyle(color: SK.muted)),
              const SizedBox(height: 12),
              FilledButton(onPressed: () => SignInScreen.open(context), child: const Text('Sign in / Sign up')),
            ])))
          : ListView(padding: const EdgeInsets.all(16), children: [
              Card(
                child: ListTile(
                  leading: CircleAvatar(backgroundColor: SK.orange, foregroundColor: Colors.white, child: Text((me.name?.isNotEmpty ?? false) ? me.name![0] : '?')),
                  title: Text(me.name ?? 'Add your name', style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text([me.phone, if (me.email != null) me.email!].join(' · ')),
                ),
              ),
              const SizedBox(height: 16),
              Row(children: [
                const Expanded(child: Text('Addresses', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17))),
                if (!adding) TextButton.icon(onPressed: () => setState(() => adding = true), icon: const Icon(Icons.add), label: const Text('Add')),
              ]),
              for (final a in s.addresses)
                Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: Icon(a.label == 'home' ? Icons.home_outlined : a.label == 'office' ? Icons.work_outline : Icons.place_outlined, color: SK.orange),
                    title: Row(children: [
                      Text(a.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                      if (a.isDefault) const Padding(padding: EdgeInsets.only(left: 8), child: Text('Default', style: TextStyle(color: SK.muted, fontSize: 12))),
                    ]),
                    subtitle: Text('${a.oneLine}, ${a.state} ${a.postalCode}${a.dropoffInstructions != null ? '\n“${a.dropoffInstructions}”' : ''}'),
                    isThreeLine: a.dropoffInstructions != null,
                    trailing: PopupMenuButton<String>(
                      onSelected: (v) async {
                        if (v == 'default') await s.api.updateAddress(a.id, {'isDefault': true});
                        if (v == 'remove') await s.api.removeAddress(a.id);
                        await s.reloadAddresses();
                      },
                      itemBuilder: (_) => [if (!a.isDefault) const PopupMenuItem(value: 'default', child: Text('Make default')), const PopupMenuItem(value: 'remove', child: Text('Remove'))],
                    ),
                  ),
                ),
              if (adding) Card(child: Padding(padding: const EdgeInsets.all(14), child: AddressForm(onSaved: (_) => setState(() => adding = false)))),
              const SizedBox(height: 16),
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('How our prices work', style: TextStyle(fontWeight: FontWeight.w800)),
                    SizedBox(height: 6),
                    Text('• Restaurants pay a flat monthly plan — \$0 commission on your food.'),
                    Text('• The delivery fee is what delivery costs; many restaurants pay some or all of it.'),
                    Text('• Sales tax is set and paid by the restaurant.'),
                    Text('• 100% of your tip goes to your courier. No card fees, ever.'),
                  ]),
                ),
              ),
              const SizedBox(height: 12),
              const Card(child: ListTile(leading: Icon(Icons.support_agent_outlined), title: Text('Help'), subtitle: Text('info@shlglobal.biz · +1 917-624-8233'))),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: s.signOut, child: const Text('Sign out')),
            ]),
    );
  }
}
