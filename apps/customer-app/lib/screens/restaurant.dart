import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../main.dart';
import '../state/cart.dart';
import '../theme.dart';
import '../util/format.dart';
import 'cart_bar.dart';
import 'widgets.dart';

class RestaurantScreen extends StatefulWidget {
  const RestaurantScreen({super.key, required this.locationId, required this.name});
  final String locationId;
  final String name;
  @override
  State<RestaurantScreen> createState() => _RestaurantScreenState();
}

class _RestaurantScreenState extends State<RestaurantScreen> {
  RestaurantPage? page;
  String? error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final p = await AppScope.read(context).api.restaurant(widget.locationId);
      if (mounted) setState(() => page = p);
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  Future<void> _openItem(RestaurantPage p, MenuItem item) async {
    final line = await showModalBottomSheet<CartLine>(context: context, isScrollControlled: true, useSafeArea: true, showDragHandle: true, builder: (_) => ItemSheet(item: item));
    if (line == null || !mounted) return;
    final replaced = AppScope.read(context).addToCart(p.locationId, p.name, line);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(replaced ? 'Started a new cart at ${p.name}' : 'Added ${line.quantity}× ${line.name}'), duration: const Duration(seconds: 2)));
  }

  @override
  Widget build(BuildContext context) {
    final p = page;
    return Scaffold(
      appBar: AppBar(title: Text(widget.name)),
      bottomNavigationBar: const CartBar(),
      body: error != null
          ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(error!))
          : p == null
              ? const Center(child: CircularProgressIndicator())
              : ListView(padding: const EdgeInsets.all(16), children: [
                  Text(p.name, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
                  Text([if (p.cuisine != null) p.cuisine!, p.address].join(' · '), style: const TextStyle(color: SK.muted)),
                  const SizedBox(height: 10),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    p.open ? Pill('Open · ${p.prepMinutes} min prep', bg: const Color(0xFFE6F5EC), fg: SK.green) : const Pill('Closed now', bg: Color(0xFFEFEEE9), fg: SK.muted),
                    if (p.busy) const Pill('Busy — a little slower', bg: Color(0xFFFDECEA), fg: SK.red),
                    if (deliveryOffer(p.deliveryRule) != null) Pill(deliveryOffer(p.deliveryRule)!),
                  ]),
                  if (p.fees.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: Colors.white, border: Border.all(color: SK.line), borderRadius: BorderRadius.circular(12)),
                      child: Text('Fees set by ${p.name}: ${p.fees.map((f) => f.describe()).join(' · ')}', style: const TextStyle(fontSize: 13)),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Text(p.taxNote, style: const TextStyle(color: SK.muted, fontSize: 12)),
                  for (final s in p.sections) ...[
                    const SizedBox(height: 20),
                    Text(s.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    for (final i in s.items) ...[
                      Card(
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: i.soldOut || !p.open ? null : () => _openItem(p, i),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Opacity(
                              opacity: i.soldOut ? 0.5 : 1,
                              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(i.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                                  if (i.description != null) Padding(padding: const EdgeInsets.only(top: 3), child: Text(i.description!, style: const TextStyle(color: SK.muted))),
                                  const SizedBox(height: 6),
                                  Text(i.soldOut ? 'Sold out' : usd(i.priceCents), style: TextStyle(fontWeight: FontWeight.w600, color: i.soldOut ? SK.muted : SK.ink)),
                                ])),
                                if (i.imageUrl != null) ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.network(i.imageUrl!, width: 84, height: 84, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink())),
                                if (!i.soldOut && p.open) const Padding(padding: EdgeInsets.only(left: 8), child: Icon(Icons.add_circle, color: SK.orange)),
                              ]),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                  ],
                ]),
    );
  }
}

/// Item options: required groups pre-pick their first option; returns a [CartLine] or null.
class ItemSheet extends StatefulWidget {
  const ItemSheet({super.key, required this.item});
  final MenuItem item;
  @override
  State<ItemSheet> createState() => _ItemSheetState();
}

class _ItemSheetState extends State<ItemSheet> {
  late final Map<String, List<String>> picked = {
    for (final g in widget.item.groups) g.id: g.minSelect == 1 && g.maxSelect == 1 && g.options.isNotEmpty && g.options.first.available ? [g.options.first.id] : <String>[],
  };
  int qty = 1;
  final note = TextEditingController();

  @override
  void dispose() { note.dispose(); super.dispose(); }

  void _toggle(ModifierGroup g, ModifierOption o) => setState(() {
        final cur = picked[g.id]!;
        if (g.maxSelect == 1) {
          picked[g.id] = [o.id];
        } else if (cur.contains(o.id)) {
          cur.remove(o.id);
        } else if (cur.length < g.maxSelect) {
          cur.add(o.id);
        }
      });

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    var unit = item.priceCents;
    var valid = true;
    final ids = <String>[], names = <String>[];
    for (final g in item.groups) {
      final sel = picked[g.id]!;
      if (sel.length < g.minSelect || sel.length > g.maxSelect) valid = false;
      for (final o in g.options.where((o) => sel.contains(o.id))) { unit += o.priceCents; ids.add(o.id); names.add(o.name); }
    }
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Flexible(
          child: ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(20, 0, 20, 12), children: [
            Text(item.name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            if (item.description != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(item.description!, style: const TextStyle(color: SK.muted))),
            if (item.dietary.isNotEmpty || item.allergens.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final d in item.dietary) Pill(d, bg: const Color(0xFFE6F5EC), fg: SK.green),
                for (final a in item.allergens) Pill('Contains $a', bg: const Color(0xFFEFEEE9), fg: SK.muted),
              ]),
            ],
            for (final g in item.groups) ...[
              const SizedBox(height: 16),
              Row(children: [
                Expanded(child: Text(g.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
                Text(g.minSelect > 0 ? 'Required · choose ${g.minSelect == g.maxSelect ? g.minSelect : '${g.minSelect}–${g.maxSelect}'}' : 'Optional · up to ${g.maxSelect}', style: const TextStyle(color: SK.muted, fontSize: 12)),
              ]),
              for (final o in g.options)
                InkWell(
                  onTap: o.available ? () => _toggle(g, o) : null,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(children: [
                      Icon(
                        g.maxSelect == 1
                            ? (picked[g.id]!.contains(o.id) ? Icons.radio_button_checked : Icons.radio_button_unchecked)
                            : (picked[g.id]!.contains(o.id) ? Icons.check_box : Icons.check_box_outline_blank),
                        color: o.available ? SK.orange : SK.line,
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: Text(o.available ? o.name : '${o.name} (unavailable)')),
                      if (o.priceCents > 0) Text('+${usd(o.priceCents)}', style: const TextStyle(color: SK.muted)),
                    ]),
                  ),
                ),
            ],
            const SizedBox(height: 14),
            TextField(controller: note, maxLength: 200, decoration: const InputDecoration(labelText: 'Special instructions', hintText: 'No onions, extra spicy…', counterText: '')),
          ]),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: Row(children: [
              IconButton.outlined(onPressed: qty > 1 ? () => setState(() => qty--) : null, icon: const Icon(Icons.remove)),
              SizedBox(width: 36, child: Text('$qty', textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700))),
              IconButton.outlined(onPressed: qty < 50 ? () => setState(() => qty++) : null, icon: const Icon(Icons.add)),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: !valid ? null : () => Navigator.of(context).pop(CartLine(itemId: item.id, name: item.name, quantity: qty, optionIds: ids, optionNames: names, unitCents: unit, note: note.text.trim().isEmpty ? null : note.text.trim())),
                  child: Text('Add $qty · ${usd(unit * qty)}'),
                ),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}
