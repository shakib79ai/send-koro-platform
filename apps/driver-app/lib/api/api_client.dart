import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';
import 'models.dart';

/// Error from the API. [message] is written for people and can be shown as-is.
class ApiException implements Exception {
  ApiException(this.status, this.code, this.message);
  final int status;
  final String code;
  final String message;
  @override
  String toString() => message;
}

/// Core API client for the driver role. Keeps the session on the device and refreshes the
/// short-lived access token once on a 401.
class ApiClient {
  ApiClient({http.Client? client, String? baseUrl})
      : _http = client ?? http.Client(),
        _base = baseUrl ?? Config.apiUrl;

  final http.Client _http;
  final String _base;
  Session? session;
  void Function()? onSignedOut;

  static const _key = 'sk.driver.session';

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw != null) {
      try {
        session = Session.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      } catch (_) {
        await prefs.remove(_key);
      }
    }
  }

  Future<void> _save(Session? s) async {
    session = s;
    final prefs = await SharedPreferences.getInstance();
    if (s == null) {
      await prefs.remove(_key);
    } else {
      await prefs.setString(_key, jsonEncode(s.toJson()));
    }
  }

  Future<dynamic> _send(String method, String path, {Object? body, bool auth = true}) async {
    Future<http.Response> go(String? token) {
      final req = http.Request(method, Uri.parse('$_base$path'))
        ..headers['content-type'] = 'application/json'
        ..headers['accept'] = 'application/json';
      if (token != null) req.headers['authorization'] = 'Bearer $token';
      if (body != null) req.body = jsonEncode(body);
      return _http.send(req).then(http.Response.fromStream).timeout(const Duration(seconds: 20));
    }

    http.Response res;
    try {
      res = await go(auth ? session?.accessToken : null);
      if (res.statusCode == 401 && auth && session != null && await _refresh()) {
        res = await go(session?.accessToken);
      }
    } on TimeoutException {
      throw ApiException(0, 'timeout', 'The connection is slow. Check your signal and try again.');
    } on http.ClientException {
      throw ApiException(0, 'offline', 'No connection. Check your signal and try again.');
    } on ApiException {
      rethrow;
    } on Exception {
      throw ApiException(0, 'offline', 'No connection. Check your signal and try again.');
    }

    final text = res.body;
    final json = text.isEmpty ? null : jsonDecode(text);
    if (res.statusCode >= 400) {
      final map = json is Map ? json : const {};
      final msg = map['message'];
      throw ApiException(res.statusCode, map['code']?.toString() ?? 'error', msg is String ? msg : 'Something went wrong. Please try again.');
    }
    return json;
  }

  Future<bool> _refresh() async {
    final s = session;
    if (s == null) return false;
    try {
      final res = await _http.post(Uri.parse('$_base/auth/refresh'), headers: {'content-type': 'application/json'}, body: jsonEncode({'refreshToken': s.refreshToken}));
      if (res.statusCode != 200 && res.statusCode != 201) {
        await _save(null);
        onSignedOut?.call();
        return false;
      }
      await _save(Session.fromJson(jsonDecode(res.body) as Map<String, dynamic>));
      return true;
    } catch (_) {
      return false;
    }
  }

  // ── Sign in ────────────────────────────────────────────────────────────
  Future<void> requestCode(String phone) => _send('POST', '/auth/code', body: {'phone': phone, 'role': 'driver'}, auth: false);

  Future<Session> verify(String phone, String code) async {
    final j = await _send('POST', '/auth/verify', body: {'phone': phone, 'role': 'driver', 'code': code}, auth: false);
    final s = Session.fromJson((j as Map).cast<String, dynamic>());
    await _save(s);
    return s;
  }

  Future<void> signOut() async {
    final s = session;
    if (s != null) {
      try {
        await _send('POST', '/auth/sign-out', body: {'refreshToken': s.refreshToken}, auth: false);
      } catch (_) {}
    }
    await _save(null);
  }

  // ── Profile & payouts ──────────────────────────────────────────────────
  Future<DriverProfile?> me() async {
    final j = await _send('GET', '/driver/me');
    return j is Map ? DriverProfile.fromJson(j.cast<String, dynamic>()) : null;
  }

  Future<DriverProfile> apply({required String name, required String email, required String vehicle}) async {
    final j = await _send('POST', '/driver/apply', body: {'name': name, 'email': email, 'vehicle': vehicle});
    return DriverProfile.fromJson((j as Map).cast<String, dynamic>());
  }

  Future<String> payoutsLink() async {
    final j = await _send('POST', '/driver/payouts/onboarding-link');
    return (j as Map)['url'].toString();
  }

  Future<StripeOverview> stripeOverview() async => StripeOverview.fromJson(((await _send('GET', '/driver/stripe/overview')) as Map).cast<String, dynamic>());

  // ── Online, location, offers, trip ─────────────────────────────────────
  Future<void> setOnline(bool online, {double? lat, double? lng}) =>
      _send('PUT', '/driver/online', body: {'online': online, if (lat != null) 'lat': lat, if (lng != null) 'lng': lng});

  Future<void> sendLocation(double lat, double lng) => _send('PUT', '/driver/location', body: {'lat': lat, 'lng': lng});

  Future<List<Offer>> offers() async {
    final j = await _send('GET', '/driver/offers');
    return ((j as List?) ?? const []).map((e) => Offer.fromJson((e as Map).cast<String, dynamic>())).toList();
  }

  Future<void> acceptOffer(String id) => _send('POST', '/driver/offers/$id/accept');
  Future<void> declineOffer(String id) => _send('POST', '/driver/offers/$id/decline');

  Future<List<TripStop>> trip() async {
    final j = await _send('GET', '/driver/trip');
    return ((j as List?) ?? const []).map((e) => TripStop.fromJson((e as Map).cast<String, dynamic>())).toList();
  }

  Future<void> arrived(String orderId) => _send('POST', '/driver/deliveries/$orderId/arrived');
  Future<void> pickedUp(String orderId) => _send('POST', '/driver/deliveries/$orderId/picked-up');
  Future<void> delivered(String orderId) => _send('POST', '/driver/deliveries/$orderId/delivered', body: const <String, dynamic>{});

  // ── Earnings ───────────────────────────────────────────────────────────
  Future<WeekEarnings> earnings() async => WeekEarnings.fromJson(((await _send('GET', '/driver/earnings')) as Map).cast<String, dynamic>());

  Future<List<PastDelivery>> history() async {
    final j = await _send('GET', '/driver/history');
    return ((j as List?) ?? const []).map((e) => PastDelivery.fromJson((e as Map).cast<String, dynamic>())).toList();
  }
}
