import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../config.dart';
import '../util/offer_alert.dart';

/// Everything the driver screens show: profile, online status, the current offer and trip.
/// Polls the API while online (offers every few seconds, trip less often) and sends location.
class DriverState extends ChangeNotifier {
  DriverState(this.api, {OfferAlert? alert}) : alert = alert ?? OfferAlert();
  final ApiClient api;
  /// Rings and vibrates while an offer is waiting for the driver.
  final OfferAlert alert;

  DriverProfile? profile;
  bool loaded = false;
  bool online = false;
  bool busy = false;
  String? error;
  List<Offer> offers = const [];
  List<TripStop> trip = const [];
  Position? lastPosition;

  Timer? _poll;
  StreamSubscription<Position>? _positions;
  DateTime _lastLocationSent = DateTime.fromMillisecondsSinceEpoch(0);

  bool get signedIn => api.session != null;
  Offer? get currentOffer => offers.isEmpty ? null : offers.first;
  bool get onTrip => trip.isNotEmpty;

  /// Every change runs through here, so the ring always matches what is on screen:
  /// an offer waiting (online, no trip) rings; accepting, declining, expiring or going offline stops it.
  @override
  void notifyListeners() {
    final o = currentOffer;
    if (online && !onTrip && o != null) {
      alert.start(o.id);
    } else {
      alert.stop();
    }
    super.notifyListeners();
  }

  Future<void> start() async {
    await api.load();
    await alert.load();
    api.onSignedOut = () {
      _stopOnline();
      profile = null;
      notifyListeners();
    };
    if (signedIn) await refreshProfile();
    loaded = true;
    notifyListeners();
  }

  Future<void> refreshProfile() async {
    try {
      profile = await api.me();
      online = profile?.online ?? false;
      error = null;
      if (online) _startOnline();
      if (profile != null) await refreshTrip();
    } on ApiException catch (e) {
      error = e.message;
    }
    notifyListeners();
  }

  Future<T?> _run<T>(Future<T> Function() fn) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      return await fn();
    } on ApiException catch (e) {
      error = e.message;
      return null;
    } catch (e) {
      error = 'Something went wrong. Please try again.';
      debugPrint('DriverState error: $e');
      return null;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  // ── Sign in / apply ──
  Future<bool> requestCode(String phone) async => (await _run(() async { await api.requestCode(phone); return true; })) ?? false;

  Future<bool> verify(String phone, String code) async {
    final ok = await _run(() async { await api.verify(phone, code); return true; });
    if (ok == true) await refreshProfile();
    return ok ?? false;
  }

  Future<void> apply(String name, String email, String vehicle) async {
    final p = await _run(() => api.apply(name: name, email: email, vehicle: vehicle));
    if (p != null) profile = p;
    notifyListeners();
  }

  Future<String?> payoutsLink() => _run(api.payoutsLink);

  Future<void> signOut() async {
    if (online) await goOffline();
    await api.signOut();
    profile = null;
    offers = const [];
    trip = const [];
    notifyListeners();
  }

  // ── Online / offline ──
  /// Asks for location permission, sends the first position, and starts polling for offers.
  Future<void> goOnline() async {
    final pos = await _run(_currentPosition);
    if (pos == null) return;
    final ok = await _run(() async { await api.setOnline(true, lat: pos.latitude, lng: pos.longitude); return true; });
    if (ok != true) return;
    online = true;
    lastPosition = pos;
    _startOnline();
    notifyListeners();
  }

  Future<void> goOffline() async {
    if (onTrip) {
      error = 'Finish your current trip before going offline.';
      notifyListeners();
      return;
    }
    await _run(() async { await api.setOnline(false); return true; });
    online = false;
    _stopOnline();
    offers = const [];
    notifyListeners();
  }

  Future<Position> _currentPosition() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw ApiException(0, 'location_off', 'Turn on Location Services to go online.');
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      throw ApiException(0, 'location_denied', 'Send Koro needs your location while you’re online to offer nearby orders.');
    }
    return Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high));
  }

  void _startOnline() {
    _poll?.cancel();
    var tick = 0;
    _poll = Timer.periodic(Config.offerPoll, (_) {
      tick++;
      if (!onTrip) _refreshOffers();
      if (onTrip || tick % 3 == 0) refreshTrip();
    });
    _refreshOffers();
    _positions?.cancel();
    _positions = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 25),
    ).listen((p) {
      lastPosition = p;
      final now = DateTime.now();
      if (now.difference(_lastLocationSent) >= Config.locationEvery) {
        _lastLocationSent = now;
        api.sendLocation(p.latitude, p.longitude).catchError((_) {});
      }
    }, onError: (_) {});
  }

  void _stopOnline() {
    _poll?.cancel();
    _poll = null;
    _positions?.cancel();
    _positions = null;
  }

  Future<void> _refreshOffers() async {
    try {
      final now = DateTime.now();
      final next = (await api.offers()).where((o) => o.expiresAt.isAfter(now)).toList();
      if (next.map((o) => o.id).join() != offers.map((o) => o.id).join()) {
        offers = next;
        notifyListeners();
      }
    } catch (_) {
      // keep the last good state; the next poll retries
    }
  }

  Future<void> refreshTrip() async {
    try {
      trip = await api.trip();
      notifyListeners();
    } catch (_) {
      // retried on the next tick
    }
  }

  // ── Offers ──
  Future<void> accept(Offer o) async {
    final ok = await _run(() async { await api.acceptOffer(o.id); return true; });
    offers = const [];
    if (ok == true) await refreshTrip();
    notifyListeners();
  }

  Future<void> decline(Offer o) async {
    await _run(() async { await api.declineOffer(o.id); return true; });
    offers = offers.where((x) => x.id != o.id).toList();
    notifyListeners();
  }

  /// Called by the offer card when its countdown reaches zero.
  void expire(Offer o) {
    offers = offers.where((x) => x.id != o.id).toList();
    notifyListeners();
  }

  // ── Trip steps ──
  Future<void> arrived(TripStop s) async { await _run(() async { await api.arrived(s.orderId); return true; }); await refreshTrip(); }
  Future<void> pickedUp(TripStop s) async { await _run(() async { await api.pickedUp(s.orderId); return true; }); await refreshTrip(); }
  Future<void> delivered(TripStop s) async { await _run(() async { await api.delivered(s.orderId); return true; }); await refreshTrip(); }

  void clearError() { error = null; notifyListeners(); }

  @override
  void dispose() {
    _stopOnline();
    alert.stop();
    super.dispose();
  }
}
