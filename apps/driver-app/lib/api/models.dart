/// Shapes returned by the core API (`docs/API.md`, driver section). Amounts are integer cents.
int _int(Object? v) => v == null ? 0 : (v is int ? v : (v as num).toInt());
String _str(Object? v) => v?.toString() ?? '';

class Session {
  Session({required this.accessToken, required this.refreshToken, required this.userId, required this.phone, this.name});
  final String accessToken;
  final String refreshToken;
  final String userId;
  final String phone;
  final String? name;

  factory Session.fromJson(Map<String, dynamic> j) {
    final u = (j['user'] as Map?)?.cast<String, dynamic>() ?? const {};
    return Session(
      accessToken: _str(j['accessToken']),
      refreshToken: _str(j['refreshToken']),
      userId: _str(u['id']),
      phone: _str(u['phone']),
      name: u['name'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'user': {'id': userId, 'phone': phone, 'name': name},
      };
}

enum DriverStatus { applied, approved, suspended }

class DriverProfile {
  DriverProfile({required this.id, required this.name, required this.email, required this.vehicle, required this.status, required this.online, required this.payoutsReady});
  final String id;
  final String name;
  final String email;
  final String vehicle;
  final DriverStatus status;
  final bool online;
  final bool payoutsReady;

  factory DriverProfile.fromJson(Map<String, dynamic> j) => DriverProfile(
        id: _str(j['id']),
        name: _str(j['name']),
        email: _str(j['email']),
        vehicle: _str(j['vehicle']),
        status: DriverStatus.values.firstWhere((s) => s.name == j['status'], orElse: () => DriverStatus.applied),
        online: j['online'] == true,
        payoutsReady: j['payoutsReady'] == true,
      );

  String get firstName => name.split(' ').first;
}

/// Upfront, locked offer: what the driver sees is what they're paid (plus 100% of tips).
class Offer {
  Offer({required this.id, required this.orderIds, required this.distanceMeters, required this.durationSeconds, required this.payCents, required this.expiresAt});
  final String id;
  final List<String> orderIds;
  final int distanceMeters;
  final int durationSeconds;
  final int payCents;
  final DateTime expiresAt;

  bool get isBatch => orderIds.length > 1;

  factory Offer.fromJson(Map<String, dynamic> j) => Offer(
        id: _str(j['id']),
        orderIds: ((j['orderIds'] as List?) ?? const []).map((e) => e.toString()).toList(),
        distanceMeters: _int(j['distanceMeters']),
        durationSeconds: _int(j['durationSeconds']),
        payCents: _int(j['payCents']),
        expiresAt: DateTime.parse(_str(j['expiresAt'])).toLocal(),
      );
}

class Stop {
  Stop({required this.name, required this.phone, required this.line1, required this.city, required this.state, required this.postalCode, required this.lat, required this.lng, this.instructions});
  final String name;
  final String phone;
  final String line1;
  final String city;
  final String state;
  final String postalCode;
  final double lat;
  final double lng;
  final String? instructions;

  String get address => '$line1, $city, $state $postalCode';

  factory Stop.fromJson(Map<String, dynamic> j) => Stop(
        name: _str(j['name']),
        phone: _str(j['phone']),
        line1: _str(j['line1']),
        city: _str(j['city']),
        state: _str(j['state']),
        postalCode: _str(j['postalCode']),
        lat: (j['lat'] as num?)?.toDouble() ?? 0,
        lng: (j['lng'] as num?)?.toDouble() ?? 0,
        instructions: j['instructions'] as String?,
      );
}

/// One order on the driver's current trip. Delivery status: assigned → at_pickup → picked_up → delivered.
class TripStop {
  TripStop({required this.orderId, required this.code, required this.status, required this.payCents, required this.tipCents, required this.pickup, required this.dropoff, required this.items});
  final String orderId;
  final String code;
  final String status;
  final int payCents;
  final int tipCents;
  final Stop pickup;
  final Stop dropoff;
  final List<({String name, int quantity})> items;

  bool get pickedUp => status == 'picked_up' || status == 'at_dropoff';

  factory TripStop.fromJson(Map<String, dynamic> j) => TripStop(
        orderId: _str(j['orderId']),
        code: _str(j['code']),
        status: _str(j['status']),
        payCents: _int(j['payCents']),
        tipCents: _int(j['tipCents']),
        pickup: Stop.fromJson((j['pickup'] as Map).cast<String, dynamic>()),
        dropoff: Stop.fromJson((j['dropoff'] as Map).cast<String, dynamic>()),
        items: ((j['items'] as List?) ?? const [])
            .map((e) => (e as Map).cast<String, dynamic>())
            .map((e) => (name: _str(e['name']), quantity: _int(e['quantity'])))
            .toList(),
      );
}

class WeekEarnings {
  WeekEarnings({required this.weekStart, required this.trips, required this.tripSeconds, required this.payCents, required this.tipsCents, required this.nycMinimumCents, required this.nycTopUpCents});
  final String weekStart;
  final int trips;
  final int tripSeconds;
  final int payCents;
  final int tipsCents;
  final int nycMinimumCents;
  final int nycTopUpCents;

  int get totalCents => payCents + tipsCents + nycTopUpCents;

  factory WeekEarnings.fromJson(Map<String, dynamic> j) => WeekEarnings(
        weekStart: _str(j['weekStart']),
        trips: _int(j['trips']),
        tripSeconds: _int(j['tripSeconds']),
        payCents: _int(j['payCents']),
        tipsCents: _int(j['tipsCents']),
        nycMinimumCents: _int(j['nycMinimumCents']),
        nycTopUpCents: _int(j['nycTopUpCents']),
      );
}

class PastDelivery {
  PastDelivery({required this.orderId, required this.code, required this.payCents, required this.tipCents, required this.deliveredAt, required this.distanceMeters});
  final String orderId;
  final String code;
  final int payCents;
  final int tipCents;
  final DateTime? deliveredAt;
  final int distanceMeters;

  factory PastDelivery.fromJson(Map<String, dynamic> j) => PastDelivery(
        orderId: _str(j['orderId']),
        code: _str(j['code']),
        payCents: _int(j['payCents']),
        tipCents: _int(j['tipCents']),
        deliveredAt: j['deliveredAt'] == null ? null : DateTime.parse(_str(j['deliveredAt'])).toLocal(),
        distanceMeters: _int(j['distanceMeters']),
      );
}

/// Stripe tab: the driver's own Stripe account as Send Koro sees it (no fee lines: drivers pay none).
class StripeOverview {
  StripeOverview({required this.stripeAccountId, required this.setup, required this.ready, required this.requirementsDue, required this.payoutSchedule, required this.bankName, required this.bankLast4, required this.availableCents, required this.pendingCents, required this.payouts, required this.statement, required this.error});
  final String? stripeAccountId;
  /// not_started, pending, restricted or active.
  final String setup;
  final bool ready;
  final List<String> requirementsDue;
  final String? payoutSchedule;
  final String? bankName;
  final String? bankLast4;
  final int? availableCents;
  final int? pendingCents;
  final List<StripePayout> payouts;
  final List<StatementWeek> statement;
  final String? error;

  factory StripeOverview.fromJson(Map<String, dynamic> j) {
    final bank = (j['bank'] as Map?)?.cast<String, dynamic>();
    final bal = (j['balance'] as Map?)?.cast<String, dynamic>();
    return StripeOverview(
      stripeAccountId: j['stripeAccountId'] as String?,
      setup: _str(j['setup']),
      ready: j['ready'] == true,
      requirementsDue: ((j['requirementsDue'] as List?) ?? const []).map((e) => e.toString()).toList(),
      payoutSchedule: j['payoutSchedule'] as String?,
      bankName: bank?['name'] as String?,
      bankLast4: bank?['last4'] as String?,
      availableCents: bal == null ? null : _int(bal['availableCents']),
      pendingCents: bal == null ? null : _int(bal['pendingCents']),
      payouts: ((j['payouts'] as List?) ?? const []).map((e) => StripePayout.fromJson((e as Map).cast<String, dynamic>())).toList(),
      statement: ((j['statement'] as List?) ?? const []).map((e) => StatementWeek.fromJson((e as Map).cast<String, dynamic>())).toList(),
      error: j['error'] as String?,
    );
  }
}

class StripePayout {
  StripePayout({required this.id, required this.amountCents, required this.status, required this.arrivalDate, required this.failureMessage});
  final String id;
  final int amountCents;
  final String status;
  final DateTime? arrivalDate;
  final String? failureMessage;
  factory StripePayout.fromJson(Map<String, dynamic> j) => StripePayout(
        id: _str(j['id']),
        amountCents: _int(j['amountCents']),
        status: _str(j['status']),
        arrivalDate: j['arrivalDate'] == null ? null : DateTime.parse(_str(j['arrivalDate'])).toLocal(),
        failureMessage: j['failureMessage'] as String?,
      );
}

/// One Monday-to-Sunday week: locked pay + 100% of tips + NYC minimum top-up.
class StatementWeek {
  StatementWeek({required this.weekStart, required this.trips, required this.payCents, required this.tipCents, required this.topUpCents, required this.totalCents});
  final String weekStart;
  final int trips;
  final int payCents;
  final int tipCents;
  final int topUpCents;
  final int totalCents;
  factory StatementWeek.fromJson(Map<String, dynamic> j) => StatementWeek(
        weekStart: _str(j['weekStart']),
        trips: _int(j['trips']),
        payCents: _int(j['payCents']),
        tipCents: _int(j['tipCents']),
        topUpCents: _int(j['topUpCents']),
        totalCents: _int(j['totalCents']),
      );
}
