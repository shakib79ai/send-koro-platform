/// Shapes returned by the core API (`docs/API.md`, customer section). Amounts are integer cents.
int _int(Object? v) => v == null ? 0 : (v is int ? v : (v as num).toInt());
String _str(Object? v) => v?.toString() ?? '';
double _dbl(Object? v) => (v as num?)?.toDouble() ?? 0;
List<Map<String, dynamic>> _list(Object? v) => ((v as List?) ?? const []).map((e) => (e as Map).cast<String, dynamic>()).toList();

class Session {
  Session({required this.accessToken, required this.refreshToken, required this.userId, required this.phone, this.name, this.email});
  final String accessToken;
  final String refreshToken;
  final String userId;
  final String phone;
  final String? name;
  final String? email;

  factory Session.fromJson(Map<String, dynamic> j) {
    final u = (j['user'] as Map?)?.cast<String, dynamic>() ?? const {};
    return Session(accessToken: _str(j['accessToken']), refreshToken: _str(j['refreshToken']), userId: _str(u['id']), phone: _str(u['phone']), name: u['name'] as String?, email: u['email'] as String?);
  }
  Map<String, dynamic> toJson() => {'accessToken': accessToken, 'refreshToken': refreshToken, 'user': {'id': userId, 'phone': phone, 'name': name, 'email': email}};
  Session copyWith({String? name, String? email}) => Session(accessToken: accessToken, refreshToken: refreshToken, userId: userId, phone: phone, name: name ?? this.name, email: email ?? this.email);
}

class Address {
  Address({required this.id, required this.label, this.customLabel, required this.line1, this.line2, required this.city, required this.state, required this.postalCode, required this.lat, required this.lng, this.dropoffInstructions, required this.isDefault});
  final String id;
  final String label; // home | office | other
  final String? customLabel;
  final String line1;
  final String? line2;
  final String city;
  final String state;
  final String postalCode;
  final double lat;
  final double lng;
  final String? dropoffInstructions;
  final bool isDefault;

  String get title => label == 'home' ? 'Home' : label == 'office' ? 'Office' : (customLabel?.isNotEmpty == true ? customLabel! : 'Other');
  String get oneLine => '$line1${line2 != null && line2!.isNotEmpty ? ', $line2' : ''}, $city';

  factory Address.fromJson(Map<String, dynamic> j) => Address(
        id: _str(j['id']), label: _str(j['label']), customLabel: j['customLabel'] as String?, line1: _str(j['line1']), line2: j['line2'] as String?,
        city: _str(j['city']), state: _str(j['state']), postalCode: _str(j['postalCode']), lat: _dbl(j['lat']), lng: _dbl(j['lng']),
        dropoffInstructions: j['dropoffInstructions'] as String?, isDefault: j['isDefault'] == true,
      );
}

class GeocodeMatch {
  GeocodeMatch({required this.line1, required this.city, required this.state, required this.postalCode, required this.lat, required this.lng, required this.matched});
  final String line1, city, state, postalCode, matched;
  final double lat, lng;
  factory GeocodeMatch.fromJson(Map<String, dynamic> j) => GeocodeMatch(line1: _str(j['line1']), city: _str(j['city']), state: _str(j['state']), postalCode: _str(j['postalCode']), lat: _dbl(j['lat']), lng: _dbl(j['lng']), matched: _str(j['matched']));
}

/// What the restaurant chose about delivery, used for "Free delivery" badges.
String? deliveryOffer(Map<String, dynamic>? deliveryRule) {
  final rule = (deliveryRule?['rule'] as Map?)?.cast<String, dynamic>();
  switch (rule?['kind']) {
    case 'restaurant_pays':
      return 'Free delivery';
    case 'free_above':
      final min = _int(rule?['minFoodCents']);
      return 'Free delivery on \$${(min / 100).toStringAsFixed(min % 100 == 0 ? 0 : 2)}+';
    case 'split_fixed':
    case 'split_percent':
      return 'Restaurant pays part of delivery';
  }
  return null;
}

class NearbyRestaurant {
  NearbyRestaurant({required this.restaurantId, required this.locationId, required this.name, this.cuisine, required this.address, required this.distanceMeters, required this.delivers, required this.pickup, required this.open, required this.busy, required this.prepMinutes, this.deliveryRule});
  final String restaurantId, locationId, name, address;
  final String? cuisine;
  final int distanceMeters, prepMinutes;
  final bool delivers, pickup, open, busy;
  final Map<String, dynamic>? deliveryRule;

  factory NearbyRestaurant.fromJson(Map<String, dynamic> j) => NearbyRestaurant(
        restaurantId: _str(j['restaurantId']), locationId: _str(j['locationId']), name: _str(j['name']), cuisine: j['cuisine'] as String?, address: _str(j['address']),
        distanceMeters: _int(j['distanceMeters']), delivers: j['delivers'] == true, pickup: j['pickup'] == true, open: j['open'] == true, busy: j['busy'] == true,
        prepMinutes: _int(j['prepMinutes']), deliveryRule: (j['deliveryRule'] as Map?)?.cast<String, dynamic>(),
      );
}

class ModifierOption {
  ModifierOption({required this.id, required this.name, required this.priceCents, required this.available});
  final String id, name;
  final int priceCents;
  final bool available;
  factory ModifierOption.fromJson(Map<String, dynamic> j) => ModifierOption(id: _str(j['id']), name: _str(j['name']), priceCents: _int(j['priceCents']), available: j['available'] != false);
}

class ModifierGroup {
  ModifierGroup({required this.id, required this.name, required this.minSelect, required this.maxSelect, required this.options});
  final String id, name;
  final int minSelect, maxSelect;
  final List<ModifierOption> options;
  factory ModifierGroup.fromJson(Map<String, dynamic> j) => ModifierGroup(id: _str(j['id']), name: _str(j['name']), minSelect: _int(j['minSelect']), maxSelect: _int(j['maxSelect']), options: _list(j['options']).map(ModifierOption.fromJson).toList());
}

class MenuItem {
  MenuItem({required this.id, required this.name, this.description, required this.priceCents, this.imageUrl, required this.allergens, required this.dietary, required this.available, this.soldOutUntil, required this.groups});
  final String id, name;
  final String? description, imageUrl;
  final int priceCents;
  final List<String> allergens, dietary;
  final bool available;
  final DateTime? soldOutUntil;
  final List<ModifierGroup> groups;

  bool get soldOut => !available || (soldOutUntil != null && soldOutUntil!.isAfter(DateTime.now()));

  factory MenuItem.fromJson(Map<String, dynamic> j) => MenuItem(
        id: _str(j['id']), name: _str(j['name']), description: j['description'] as String?, priceCents: _int(j['priceCents']), imageUrl: j['imageUrl'] as String?,
        allergens: ((j['allergens'] as List?) ?? const []).map((e) => e.toString()).toList(), dietary: ((j['dietary'] as List?) ?? const []).map((e) => e.toString()).toList(),
        available: j['available'] != false, soldOutUntil: j['soldOutUntil'] == null ? null : DateTime.tryParse(_str(j['soldOutUntil'])),
        groups: _list(j['groups']).map(ModifierGroup.fromJson).toList(),
      );
}

class MenuSection {
  MenuSection(this.name, this.items);
  final String name;
  final List<MenuItem> items;
}

class RestaurantFee {
  RestaurantFee({required this.label, this.rateBps, this.fixedCents, this.minFoodCents});
  final String label;
  final int? rateBps, fixedCents, minFoodCents;
  factory RestaurantFee.fromJson(Map<String, dynamic> j) => RestaurantFee(label: _str(j['label']), rateBps: j['rateBps'] as int?, fixedCents: j['fixedCents'] as int?, minFoodCents: j['minFoodCents'] as int?);
  String describe() {
    final parts = [if (rateBps != null && rateBps! > 0) '${rateBps! / 100}%', if (fixedCents != null && fixedCents! > 0) '\$${(fixedCents! / 100).toStringAsFixed(2)}'];
    return '$label: ${parts.join(' + ')}${minFoodCents != null ? ' on orders over \$${(minFoodCents! / 100).toStringAsFixed(2)}' : ''}';
  }
}

class RestaurantPage {
  RestaurantPage({required this.restaurantId, required this.locationId, required this.name, this.cuisine, required this.address, required this.open, required this.busy, required this.prepMinutes, required this.fees, required this.taxNote, this.deliveryRule, required this.sections});
  final String restaurantId, locationId, name, address, taxNote;
  final String? cuisine;
  final bool open, busy;
  final int prepMinutes;
  final List<RestaurantFee> fees;
  final Map<String, dynamic>? deliveryRule;
  final List<MenuSection> sections;

  factory RestaurantPage.fromJson(Map<String, dynamic> j) {
    final menu = (j['menu'] as Map?)?.cast<String, dynamic>() ?? const {};
    final sections = <MenuSection>[
      for (final c in _list(menu['categories'])) MenuSection(_str(c['name']), _list(c['items']).map(MenuItem.fromJson).toList()),
    ]..removeWhere((s) => s.items.isEmpty);
    final extra = _list(menu['uncategorized']).map(MenuItem.fromJson).toList();
    if (extra.isNotEmpty) sections.add(MenuSection(sections.isEmpty ? 'Menu' : 'More', extra));
    return RestaurantPage(
      restaurantId: _str(j['restaurantId']), locationId: _str(j['locationId']), name: _str(j['name']), cuisine: j['cuisine'] as String?, address: _str(j['address']),
      open: j['open'] == true, busy: j['busy'] == true, prepMinutes: _int(j['prepMinutes']), fees: _list(j['fees']).map(RestaurantFee.fromJson).toList(),
      taxNote: _str(j['taxNote']), deliveryRule: (j['deliveryRule'] as Map?)?.cast<String, dynamic>(), sections: sections,
    );
  }
}

/// Receipt lines exactly as the API returned them — they add up to what the card is charged.
class ReceiptLine {
  ReceiptLine(this.label, this.amountCents, this.kind);
  final String label;
  final int amountCents;
  final String kind; // food | fee | tax | delivery | delivery_discount | tip
}

class Receipt {
  Receipt({required this.lines, required this.totalCents, required this.taxNote});
  final List<ReceiptLine> lines;
  final int totalCents;
  final String taxNote;
  factory Receipt.fromJson(Map<String, dynamic> j) => Receipt(
        lines: _list(j['lines']).map((l) => ReceiptLine(_str(l['label']), _int(l['amountCents']), _str(l['kind']))).toList(),
        totalCents: _int(j['totalCents']),
        taxNote: _str(j['taxNote']),
      );
}

class CheckoutPreview {
  CheckoutPreview({required this.receipt, required this.etaMinutes, required this.restaurantName, this.stripeAccount});
  final Receipt receipt;
  final int etaMinutes;
  final String restaurantName;
  final String? stripeAccount;
  factory CheckoutPreview.fromJson(Map<String, dynamic> j) => CheckoutPreview(
        receipt: Receipt.fromJson((j['receipt'] as Map).cast<String, dynamic>()),
        etaMinutes: _int(j['etaMinutes']),
        restaurantName: _str((j['restaurant'] as Map?)?['name']),
        stripeAccount: j['stripeAccount'] as String?,
      );
}

class Payment {
  Payment({required this.clientSecret, required this.stripeAccount, required this.totalCents});
  final String clientSecret, stripeAccount;
  final int totalCents;
}

class OrderItem {
  OrderItem({required this.itemId, required this.name, required this.quantity, required this.unitCents, required this.optionIds, required this.optionNames, this.note});
  final String itemId, name;
  final int quantity, unitCents;
  final List<String> optionIds, optionNames;
  final String? note;
}

class CustomerOrder {
  CustomerOrder({required this.id, required this.code, required this.status, required this.statusText, required this.fulfilment, required this.locationId, required this.restaurantName, required this.items, required this.receipt, required this.totalCents, required this.createdAt, this.deliveryStatus, this.courierFirstName});
  final String id, code, status, statusText, fulfilment, locationId, restaurantName;
  final List<OrderItem> items;
  final Receipt? receipt;
  final int totalCents;
  final DateTime createdAt;
  final String? deliveryStatus, courierFirstName;

  bool get isLive => const ['placed', 'accepted', 'preparing', 'ready', 'picked_up'].contains(status);

  factory CustomerOrder.fromJson(Map<String, dynamic> j) {
    final d = (j['delivery'] as Map?)?.cast<String, dynamic>();
    final courier = (d?['courier'] as Map?)?.cast<String, dynamic>();
    final r = j['receipt'] as Map?;
    return CustomerOrder(
      id: _str(j['id']), code: _str(j['code']), status: _str(j['status']), statusText: _str(j['statusText']), fulfilment: _str(j['fulfilment']),
      locationId: _str(j['locationId']), restaurantName: _str(j['restaurantName']),
      items: _list(j['items']).map((i) {
        final opts = _list(i['options']);
        return OrderItem(itemId: _str(i['itemId']), name: _str(i['name']), quantity: _int(i['quantity']), unitCents: _int(i['unitCents']),
            optionIds: opts.map((o) => _str(o['id'])).toList(), optionNames: opts.map((o) => _str(o['name'])).toList(), note: i['note'] as String?);
      }).toList(),
      receipt: r == null || r['lines'] == null ? null : Receipt.fromJson(r.cast<String, dynamic>()),
      totalCents: _int(j['totalCents']), createdAt: DateTime.tryParse(_str(j['createdAt']))?.toLocal() ?? DateTime.now(),
      deliveryStatus: d?['status'] as String?, courierFirstName: courier?['firstName'] as String?,
    );
  }
}
