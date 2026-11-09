import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';
import 'models.dart';

class ApiException implements Exception {
  ApiException(this.status, this.code, this.message);
  final int status;
  final String code;
  final String message;
  @override
  String toString() => message;
}

/// Core API client for customers. Keeps the session on the device and refreshes the
/// access token once on a 401.
class ApiClient {
  ApiClient({http.Client? client, String? baseUrl})
      : _http = client ?? http.Client(),
        _base = baseUrl ?? Config.apiUrl;

  final http.Client _http;
  final String _base;
  Session? session;
  void Function()? onSignedOut;
  static const _key = 'sk.customer.session';

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return;
    try {
      session = Session.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      await prefs.remove(_key);
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
      return _http.send(req).then(http.Response.fromStream).timeout(const Duration(seconds: 25));
    }

    http.Response res;
    try {
      res = await go(auth ? session?.accessToken : null);
      if (res.statusCode == 401 && auth && session != null && await _refresh()) {
        res = await go(session?.accessToken);
      }
    } on TimeoutException {
      throw ApiException(0, 'timeout', 'The connection is slow. Please try again.');
    } on ApiException {
      rethrow;
    } on Exception {
      throw ApiException(0, 'offline', 'No connection. Check your internet and try again.');
    }
    final json = res.body.isEmpty ? null : jsonDecode(res.body);
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

  // ── Sign in & profile ──
  Future<void> requestCode(String phone) => _send('POST', '/auth/code', body: {'phone': phone, 'role': 'customer'}, auth: false);

  Future<({Session session, bool isNew})> verify(String phone, String code) async {
    final j = (await _send('POST', '/auth/verify', body: {'phone': phone, 'role': 'customer', 'code': code}, auth: false) as Map).cast<String, dynamic>();
    final s = Session.fromJson(j);
    await _save(s);
    return (session: s, isNew: j['isNew'] == true || s.name == null);
  }

  Future<void> updateProfile({String? name, String? email}) async {
    await _send('PATCH', '/auth/me', body: {if (name != null) 'name': name, if (email != null && email.isNotEmpty) 'email': email});
    final s = session;
    if (s != null) await _save(s.copyWith(name: name, email: email));
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

  // ── Addresses ──
  Future<List<Address>> addresses() async => ((await _send('GET', '/me/addresses')) as List).map((e) => Address.fromJson((e as Map).cast<String, dynamic>())).toList();
  Future<Address> addAddress(Map<String, dynamic> body) async => Address.fromJson(((await _send('POST', '/me/addresses', body: body)) as Map).cast<String, dynamic>());
  Future<void> updateAddress(String id, Map<String, dynamic> body) => _send('PATCH', '/me/addresses/$id', body: body);
  Future<void> removeAddress(String id) => _send('DELETE', '/me/addresses/$id');
  Future<List<GeocodeMatch>> geocode(String address) async =>
      ((await _send('GET', '/geocode?address=${Uri.encodeQueryComponent(address)}', auth: false)) as List).map((e) => GeocodeMatch.fromJson((e as Map).cast<String, dynamic>())).toList();

  // ── Catalog ──
  Future<List<NearbyRestaurant>> nearby(double lat, double lng, {String? q}) async {
    final query = q == null || q.isEmpty ? '' : '&q=${Uri.encodeQueryComponent(q)}';
    return ((await _send('GET', '/catalog/restaurants?lat=$lat&lng=$lng$query', auth: false)) as List).map((e) => NearbyRestaurant.fromJson((e as Map).cast<String, dynamic>())).toList();
  }

  Future<RestaurantPage> restaurant(String locationId) async => RestaurantPage.fromJson(((await _send('GET', '/catalog/locations/$locationId', auth: false)) as Map).cast<String, dynamic>());

  // ── Orders ──
  Future<CheckoutPreview> preview(Map<String, dynamic> body) async => CheckoutPreview.fromJson(((await _send('POST', '/orders/preview', body: body)) as Map).cast<String, dynamic>());

  /// Creates the order (or returns the same one for the same idempotency key) and its PaymentIntent.
  Future<({String orderId, Payment? payment})> place(Map<String, dynamic> body) async {
    final j = ((await _send('POST', '/orders', body: body)) as Map).cast<String, dynamic>();
    final p = (j['payment'] as Map?)?.cast<String, dynamic>();
    return (
      orderId: ((j['order'] as Map)['id']).toString(),
      payment: p == null ? null : Payment(clientSecret: p['clientSecret'].toString(), stripeAccount: p['stripeAccount'].toString(), totalCents: (p['totalCents'] as num).toInt()),
    );
  }

  Future<void> paymentConfirmed(String orderId) => _send('POST', '/orders/$orderId/payment-confirmed');
  Future<List<CustomerOrder>> orders() async => ((await _send('GET', '/orders')) as List).map((e) => CustomerOrder.fromJson((e as Map).cast<String, dynamic>())).toList();
  Future<CustomerOrder> order(String id) async => CustomerOrder.fromJson(((await _send('GET', '/orders/$id')) as Map).cast<String, dynamic>());
  Future<CustomerOrder> cancel(String id) async => CustomerOrder.fromJson(((await _send('POST', '/orders/$id/cancel')) as Map).cast<String, dynamic>());
}
