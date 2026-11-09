import 'package:flutter/material.dart';

import '../theme.dart';
import 'brand_mark.dart';

class ErrorBanner extends StatelessWidget {
  const ErrorBanner({super.key, required this.message, this.onClose});
  final String message;
  final VoidCallback? onClose;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
        decoration: BoxDecoration(color: const Color(0xFFFDECEA), borderRadius: BorderRadius.circular(12)),
        child: Row(children: [
          Expanded(child: Text(message, style: const TextStyle(color: SK.red))),
          if (onClose != null) IconButton(onPressed: onClose, icon: const Icon(Icons.close, size: 18, color: SK.red)),
        ]),
      );
}

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

class StatRow extends StatelessWidget {
  const StatRow(this.label, this.value, {super.key, this.bold = false, this.color});
  final String label;
  final String value;
  final bool bold;
  final Color? color;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          Expanded(child: Text(label, style: TextStyle(color: color ?? (bold ? SK.ink : SK.muted), fontWeight: bold ? FontWeight.w700 : FontWeight.w400))),
          Text(value, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w600, color: color, fontFeatures: const [FontFeature.tabularFigures()])),
        ]),
      );
}
