import 'package:flutter/material.dart';

/// Send Koro navy theme (approved Nov 2026): navy #0B3B6E, red #E3242B, white, light blues only.
/// `orange` keeps its name for the main action colour so screens don't change; it is now red.
class SK {
  static const navy = Color(0xFF0B3B6E);
  static const navyDark = Color(0xFF082D55);
  static const orange = Color(0xFFE3242B); // primary action (red)
  static const ink = navy; // app bars, headings
  static const paper = Color(0xFFEEF3F8);
  static const green = navy; // success / online states stay inside the palette
  static const red = Color(0xFFC81E24);
  static const muted = Color(0xFF5B6B80);
  static const line = Color(0xFFDCE5EF);
  static const onNavyMuted = Color(0xFFDCE5EF);

  static ThemeData theme() {
    final scheme = ColorScheme.fromSeed(seedColor: navy, primary: orange, secondary: navy, error: red, surface: Colors.white);
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
