import 'package:flutter_test/flutter_test.dart';
import 'package:send_koro_driver/api/models.dart';

void main() {
  test('offer parses the locked pay, distance, time and batch', () {
    final o = Offer.fromJson({
      'id': 'o1', 'orderIds': ['a', 'b'], 'distanceMeters': 4506, 'durationSeconds': 1440, 'payCents': 1540,
      'payPerOrder': {'a': 807, 'b': 733}, 'status': 'open', 'expiresAt': '2026-11-04T05:00:45.000Z',
    });
    expect(o.payCents, 1540);
    expect(o.isBatch, isTrue);
    expect(o.distanceMeters, 4506);
  });

  test('trip stop parses pickup, dropoff and items', () {
    final t = TripStop.fromJson({
      'orderId': 'a', 'code': 'SK-4821', 'status': 'assigned', 'orderStatus': 'accepted', 'payCents': 1210, 'tipCents': 400,
      'pickup': {'name': 'Dhaka Kitchen', 'phone': '+19175550101', 'line1': '12 W 21st St', 'city': 'New York', 'state': 'NY', 'postalCode': '10010', 'lat': 40.7411, 'lng': -73.9897, 'instructions': 'Order SK-4821'},
      'dropoff': {'name': 'Ayesha', 'phone': '+19175550200', 'line1': '350 5th Ave', 'city': 'New York', 'state': 'NY', 'postalCode': '10118', 'lat': 40.7484, 'lng': -73.9857},
      'items': [{'name': 'Kacchi Biryani', 'quantity': 2}],
    });
    expect(t.pickedUp, isFalse);
    expect(t.pickup.address, '12 W 21st St, New York, NY 10010');
    expect(t.items.single.quantity, 2);
  });

  test('week earnings total = offer pay + tips + NYC top-up', () {
    final w = WeekEarnings.fromJson({'weekStart': '2026-11-02', 'trips': 9, 'tripSeconds': 18000, 'payCents': 9800, 'tipsCents': 3600, 'nycMinimumCents': 11065, 'nycTopUpCents': 1265});
    expect(w.totalCents, 9800 + 3600 + 1265);
  });

  test('profile and session round-trip', () {
    final p = DriverProfile.fromJson({'id': 'd1', 'name': 'Rahim Uddin', 'email': 'r@x.dev', 'vehicle': 'ebike', 'status': 'approved', 'online': false, 'payoutsReady': true});
    expect(p.status, DriverStatus.approved);
    expect(p.firstName, 'Rahim');
    final s = Session.fromJson({'accessToken': 'a', 'refreshToken': 'r', 'user': {'id': 'u', 'phone': '+19175550400', 'name': null}});
    expect(Session.fromJson(s.toJson()).phone, '+19175550400');
  });

  test('Stripe overview parses setup, schedule, bank, payouts and weekly statements', () {
    final o = StripeOverview.fromJson({
      'stripeAccountId': 'acct_1', 'setup': 'active', 'ready': true, 'requirementsDue': <String>[],
      'payoutSchedule': 'Every day (2 days to arrive)', 'bank': {'name': 'CHASE', 'last4': '4410'},
      'balance': {'availableCents': 4120, 'pendingCents': 1300},
      'payouts': [{'id': 'po_1', 'amountCents': 41260, 'status': 'paid', 'arrivalDate': '2026-11-03T00:00:00.000Z', 'method': 'standard', 'failureMessage': null}],
      'statement': [{'weekStart': '2026-11-02', 'trips': 7, 'payCents': 5900, 'tipCents': 3471, 'topUpCents': 0, 'totalCents': 9371}],
      'error': null,
    });
    expect(o.ready, isTrue);
    expect(o.bankLast4, '4410');
    expect(o.availableCents, 4120);
    expect(o.payouts.single.amountCents, 41260);
    expect(o.statement.single.totalCents, 9371);
    final empty = StripeOverview.fromJson({'stripeAccountId': null, 'setup': 'not_started', 'ready': false, 'requirementsDue': <String>[], 'payoutSchedule': null, 'bank': null, 'balance': null, 'payouts': <Object>[], 'error': null});
    expect(empty.availableCents, isNull);
    expect(empty.statement, isEmpty);
  });
}
