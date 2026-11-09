import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import 'cart.dart';

/// Signed-in customer, saved addresses, the chosen address and the cart.
class AppState extends ChangeNotifier {
  AppState(this.api);
  final ApiClient api;

  bool loaded = false;
  List<Address> addresses = const [];
  String? _selectedAddressId;
  Cart? cart;
  String mode = 'delivery'; // delivery | pickup

  bool get signedIn => api.session != null;
  Session? get session => api.session;
  Address? get address {
    if (addresses.isEmpty) return null;
    return addresses.firstWhere((a) => a.id == _selectedAddressId, orElse: () => addresses.firstWhere((a) => a.isDefault, orElse: () => addresses.first));
  }

  Future<void> start() async {
    await api.load();
    api.onSignedOut = () { addresses = const []; notifyListeners(); };
    final prefs = await SharedPreferences.getInstance();
    _selectedAddressId = prefs.getString('sk.address');
    final raw = prefs.getString('sk.cart');
    if (raw != null) {
      try { cart = Cart.fromJson(jsonDecode(raw) as Map<String, dynamic>); } catch (_) {}
    }
    if (signedIn) await reloadAddresses();
    loaded = true;
    notifyListeners();
  }

  Future<void> reloadAddresses() async {
    try {
      addresses = await api.addresses();
    } catch (_) {}
    notifyListeners();
  }

  Future<void> selectAddress(String id) async {
    _selectedAddressId = id;
    notifyListeners();
    (await SharedPreferences.getInstance()).setString('sk.address', id);
  }

  void setMode(String m) { mode = m; notifyListeners(); }

  Future<void> _saveCart() async {
    final prefs = await SharedPreferences.getInstance();
    if (cart == null || cart!.isEmpty) {
      await prefs.remove('sk.cart');
    } else {
      await prefs.setString('sk.cart', jsonEncode(cart!.toJson()));
    }
  }

  /// Returns true when this started a new cart at a different restaurant.
  bool addToCart(String locationId, String restaurantName, CartLine line) {
    final replaced = cart != null && !cart!.isEmpty && cart!.locationId != locationId;
    final base = cart == null || replaced ? Cart(locationId: locationId, restaurantName: restaurantName, lines: const []) : cart!;
    cart = base.add(line);
    _saveCart();
    notifyListeners();
    return replaced;
  }

  void setQuantity(String key, int q) {
    final c = cart;
    if (c == null) return;
    final next = c.setQuantity(key, q);
    cart = next.isEmpty ? null : next;
    _saveCart();
    notifyListeners();
  }

  void clearCart() { cart = null; _saveCart(); notifyListeners(); }

  Future<void> signedInNow() async { await reloadAddresses(); notifyListeners(); }

  Future<void> signOut() async {
    await api.signOut();
    addresses = const [];
    notifyListeners();
  }
}
