import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../main.dart';
import '../theme.dart';
import 'widgets.dart';

/// Home / Office / Other address. "Find" looks the address up so we have coordinates
/// (needed for the delivery area and the courier).
class AddressForm extends StatefulWidget {
  const AddressForm({super.key, required this.onSaved, this.saveLabel = 'Save address', this.makeDefault = false});
  final void Function(Address) onSaved;
  final String saveLabel;
  final bool makeDefault;
  @override
  State<AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends State<AddressForm> {
  String label = 'home';
  final custom = TextEditingController();
  final query = TextEditingController();
  final line2 = TextEditingController();
  final notes = TextEditingController();
  List<GeocodeMatch> matches = const [];
  GeocodeMatch? picked;
  bool busy = false;
  String? error;

  @override
  void dispose() { custom.dispose(); query.dispose(); line2.dispose(); notes.dispose(); super.dispose(); }

  Future<void> _find() async {
    setState(() { busy = true; error = null; picked = null; });
    try {
      final r = await AppScope.read(context).api.geocode(query.text.trim());
      setState(() { matches = r; if (r.length == 1) picked = r.first; if (r.isEmpty) error = 'We couldn’t find that address. Include the street number, city and ZIP.'; });
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _save() async {
    final p = picked;
    if (p == null) return;
    final state = AppScope.read(context);
    setState(() { busy = true; error = null; });
    try {
      final a = await state.api.addAddress({
        'label': label, if (label == 'other') 'customLabel': custom.text.trim().isEmpty ? 'Other' : custom.text.trim(),
        'line1': p.line1, if (line2.text.trim().isNotEmpty) 'line2': line2.text.trim(), 'city': p.city, 'state': p.state, 'postalCode': p.postalCode.length > 5 ? p.postalCode.substring(0, 5) : p.postalCode,
        'lat': p.lat, 'lng': p.lng, if (notes.text.trim().isNotEmpty) 'dropoffInstructions': notes.text.trim(), if (widget.makeDefault) 'isDefault': true,
      });
      await state.reloadAddresses();
      await state.selectAddress(a.id);
      widget.onSaved(a);
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SegmentedButton<String>(
        segments: const [ButtonSegment(value: 'home', label: Text('Home')), ButtonSegment(value: 'office', label: Text('Office')), ButtonSegment(value: 'other', label: Text('Other'))],
        selected: {label},
        onSelectionChanged: (s) => setState(() => label = s.first),
      ),
      if (label == 'other') ...[const SizedBox(height: 10), TextField(controller: custom, decoration: const InputDecoration(labelText: 'Name this place (Gym, Mom’s…)'))],
      const SizedBox(height: 12),
      Row(children: [
        Expanded(child: TextField(controller: query, decoration: const InputDecoration(labelText: 'Street address', hintText: '350 5th Ave, New York, NY 10118'), onChanged: (_) => setState(() {}), onSubmitted: (_) => _find())),
        const SizedBox(width: 8),
        SizedBox(width: 88, child: OutlinedButton(onPressed: busy || query.text.trim().length < 5 ? null : _find, child: const Text('Find'))),
      ]),
      if (matches.length > 1) ...[
        const SizedBox(height: 8),
        for (final m in matches) RadioListTile<GeocodeMatch>(value: m, groupValue: picked, onChanged: (v) => setState(() => picked = v), title: Text(m.matched, style: const TextStyle(fontSize: 14)), dense: true),
      ],
      if (picked != null) ...[
        const SizedBox(height: 10),
        Text('✓ ${picked!.line1}, ${picked!.city}, ${picked!.state} ${picked!.postalCode}', style: const TextStyle(color: SK.green, fontWeight: FontWeight.w600)),
        const SizedBox(height: 10),
        TextField(controller: line2, decoration: const InputDecoration(labelText: 'Apt, suite or floor')),
        const SizedBox(height: 10),
        TextField(controller: notes, decoration: const InputDecoration(labelText: 'Note for the courier', hintText: 'Front desk, buzz 4B…')),
      ],
      if (error != null) ...[const SizedBox(height: 10), ErrorBanner(error!)],
      const SizedBox(height: 14),
      FilledButton(onPressed: picked == null || busy ? null : _save, child: Text(widget.saveLabel)),
    ]);
  }
}
