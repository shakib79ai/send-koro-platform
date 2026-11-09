/// Display helpers. Money always arrives from the API in integer cents.
String usd(int cents) {
  final neg = cents < 0;
  final abs = cents.abs();
  final dollars = abs ~/ 100;
  final rem = (abs % 100).toString().padLeft(2, '0');
  final withCommas = dollars.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',');
  return '${neg ? '−' : ''}\$$withCommas.$rem';
}

String miles(int meters) => '${(meters / 1609.344).toStringAsFixed(1)} mi';

/// Whole minutes, rounded up — matches how the rate card counts minutes.
String minutes(int seconds) => '${(seconds / 60).ceil()} min';

String hours(int seconds) {
  final h = seconds ~/ 3600;
  final m = (seconds % 3600) ~/ 60;
  return h > 0 ? '${h}h ${m}m' : '${m}m';
}

/// Turns 9175550123 / (917) 555-0123 / +19175550123 into +19175550123, or null.
String? toE164(String input) {
  final d = input.replaceAll(RegExp(r'\D'), '');
  if (d.length == 10) return '+1$d';
  if (d.length == 11 && d.startsWith('1')) return '+$d';
  return null;
}

String countdown(Duration left) {
  final s = left.inSeconds < 0 ? 0 : left.inSeconds;
  return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
}
