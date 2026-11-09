import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Send Koro brand colours for the logo (brand kit v1). Fixed, so the logo looks the same whatever the app theme.
class BrandColors {
  static const navy = Color(0xFF0B3B6E);
  static const red = Color(0xFFE3242B);
}

/// The Send Koro mark: navy ring and fork, red arrow breaking out of the ring.
/// Drawn from the same 100x100 geometry as the SVG master in docs/brand.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 36, this.light = false});
  final double size;

  /// True on navy or dark backgrounds: ring and fork turn white, the arrow stays red.
  final bool light;

  @override
  Widget build(BuildContext context) => CustomPaint(
        size: Size.square(size),
        painter: _MarkPainter(light ? Colors.white : BrandColors.navy, BrandColors.red),
      );
}

class _MarkPainter extends CustomPainter {
  _MarkPainter(this.main, this.arrow);
  final Color main;
  final Color arrow;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 100, size.height / 100);
    Paint stroke(Color c, double w) => Paint()
      ..color = c
      ..style = PaintingStyle.stroke
      ..strokeWidth = w
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    // Ring with a gap at the top right (from -3° clockwise through 319°).
    canvas.drawArc(Rect.fromCircle(center: const Offset(50, 50), radius: 43), -0.0523, 5.6199, false, stroke(main, 7));

    canvas.translate(50, 50);
    canvas.rotate(-22 * math.pi / 180);
    canvas.translate(-50, -50);

    final tines = stroke(main, 4.6);
    for (final y in [42.0, 50.0, 58.0]) {
      canvas.drawLine(Offset(17, y), Offset(34, y), tines);
    }
    final head = Path()
      ..moveTo(32, 37.5)
      ..lineTo(37, 37.5)
      ..quadraticBezierTo(46, 37.5, 49, 46)
      ..lineTo(50.5, 50)
      ..lineTo(49, 54)
      ..quadraticBezierTo(46, 62.5, 37, 62.5)
      ..lineTo(32, 62.5)
      ..close();
    canvas.drawPath(head, Paint()..color = main);

    canvas.drawLine(const Offset(49, 50), const Offset(84, 50), stroke(arrow, 6.5));
    final tip = Path()
      ..moveTo(80, 40.5)
      ..lineTo(97, 50)
      ..lineTo(80, 59.5)
      ..close();
    canvas.drawPath(tip, Paint()..color = arrow);
    canvas.drawPath(tip, stroke(arrow, 2));
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _MarkPainter old) => old.main != main || old.arrow != arrow;
}
