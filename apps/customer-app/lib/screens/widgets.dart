import 'package:flutter/material.dart';

import '../api/models.dart';
import '../theme.dart';
import 'brand_mark.dart';
import '../util/format.dart';

class Logo extends StatelessWidget {
  const Logo({super.key, this.light = false, this.size = 24});
  final bool light;
  final double size;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        BrandMark(size: size * 1.5, light: light),
        SizedBox(width: size * 0.35),
        Text.rich(
          TextSpan(children: [
            TextSpan(text: 'Send ', style: TextStyle(color: light ? Colors.white : BrandColors.navy)),
            const TextSpan(text: 'Koro', style: TextStyle(color: BrandColors.red)),
          ]),
          style: TextStyle(fontSize: size, fontWeight: FontWeight.w900, fontStyle: FontStyle.italic, letterSpacing: -0.4),
        ),
      ]);
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner(this.message, {super.key});
  final String message;
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: const Color(0xFFFDECEA), borderRadius: BorderRadius.circular(12)),
        child: Text(message, style: const TextStyle(color: SK.red)),
      );
}

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.bg = const Color(0xFFFFF1E3), this.fg = SK.orange});
  final String text;
  final Color bg;
  final Color fg;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
        child: Text(text, style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w700)),
      );
}

/// The receipt exactly as the API returned it, plus the $0 commission line.
class ReceiptView extends StatelessWidget {
  const ReceiptView(this.receipt, {super.key});
  final Receipt receipt;
  @override
  Widget build(BuildContext context) {
    Widget row(String l, String v, {Color? color, bool bold = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(children: [
            Expanded(child: Text(l, style: TextStyle(color: color, fontWeight: bold ? FontWeight.w800 : FontWeight.w400, fontSize: bold ? 17 : 15))),
            Text(v, style: TextStyle(color: color, fontWeight: bold ? FontWeight.w800 : FontWeight.w500, fontSize: bold ? 17 : 15, fontFeatures: const [FontFeature.tabularFigures()])),
          ]),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final l in receipt.lines) row(l.label, usd(l.amountCents), color: l.kind == 'delivery_discount' ? SK.green : null),
      row('Send Koro commission', usd(0), color: SK.muted),
      const Divider(height: 18),
      row('Total', usd(receipt.totalCents), bold: true),
      const SizedBox(height: 4),
      Text(receipt.taxNote, style: const TextStyle(color: SK.muted, fontSize: 12)),
    ]);
  }
}

class RestaurantTile extends StatelessWidget {
  const RestaurantTile({super.key, required this.r, required this.onTap});
  final NearbyRestaurant r;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final offer = deliveryOffer(r.deliveryRule);
    final initials = r.name.split(' ').where((w) => w.isNotEmpty).take(2).map((w) => w[0]).join();
    return Opacity(
      opacity: r.open ? 1 : 0.55,
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Container(
              height: 120,
              decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFFFFB066), SK.orange, Color(0xFFE56D00)], begin: Alignment.topLeft, end: Alignment.bottomRight)),
              child: Stack(children: [
                Center(child: Text(initials, style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w800))),
                if (offer != null) Positioned(left: 10, top: 10, child: Pill(offer, bg: Colors.white)),
                Positioned(right: 10, bottom: 10, child: Pill(r.open ? '${r.prepMinutes + 15}–${r.prepMinutes + 30} min' : 'Closed', bg: Colors.white, fg: SK.ink)),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(r.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
                  if (r.busy) const Pill('Busy', bg: Color(0xFFFDECEA), fg: SK.red),
                ]),
                const SizedBox(height: 2),
                Text([if (r.cuisine != null) r.cuisine!, miles(r.distanceMeters), if (r.delivers) 'Delivery', if (r.pickup) 'Pickup'].join(' · '), style: const TextStyle(color: SK.muted)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
