import 'package:flutter/material.dart';

/// Saffron & Ink (docs/BUSINESS_MODEL.md): orange #FF7A00, ink #0E0F12, paper #F7F7F5.
class SK {
  static const orange = Color(0xFFFF7A00);
  static const ink = Color(0xFF0E0F12);
  static const paper = Color(0xFFF7F7F5);
  static const green = Color(0xFF138A52);
  static const red = Color(0xFFC8372D);
  static const muted = Color(0xFF6B6F78);
  static const line = Color(0xFFE7E6E1);

  static ThemeData theme() {
    final scheme = ColorScheme.fromSeed(seedColor: orange, primary: orange, surface: Colors.white);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: paper,
      appBarTheme: const AppBarTheme(backgroundColor: ink, foregroundColor: Colors.white, elevation: 0, centerTitle: false),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: line)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: orange,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: ink,
          minimumSize: const Size.fromHeight(48),
          side: const BorderSide(color: line),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: line)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: line)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: orange, width: 2)),
      ),
    );
  }
}
