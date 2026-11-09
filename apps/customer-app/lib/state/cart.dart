/// One cart per restaurant location. Prices here are for display only — the API re-prices
/// everything at checkout and its receipt is what the customer pays.
class CartLine {
  CartLine({required this.itemId, required this.name, required this.quantity, required this.optionIds, required this.optionNames, required this.unitCents, this.note});
  final String itemId;
  final String name;
  final int quantity;
  final List<String> optionIds;
  final List<String> optionNames;
  final int unitCents;
  final String? note;

  String get key => '$itemId:${([...optionIds]..sort()).join(',')}:${note ?? ''}';
  int get lineCents => unitCents * quantity;

  CartLine withQuantity(int q) => CartLine(itemId: itemId, name: name, quantity: q, optionIds: optionIds, optionNames: optionNames, unitCents: unitCents, note: note);

  Map<String, dynamic> toJson() => {'itemId': itemId, 'name': name, 'quantity': quantity, 'optionIds': optionIds, 'optionNames': optionNames, 'unitCents': unitCents, 'note': note};
  factory CartLine.fromJson(Map<String, dynamic> j) => CartLine(
        itemId: j['itemId'] as String, name: j['name'] as String, quantity: j['quantity'] as int,
        optionIds: (j['optionIds'] as List).cast<String>(), optionNames: (j['optionNames'] as List).cast<String>(), unitCents: j['unitCents'] as int, note: j['note'] as String?,
      );

  /// What the API's checkout expects for this line.
  Map<String, dynamic> toOrderLine() => {'itemId': itemId, 'quantity': quantity, 'optionIds': optionIds, if (note != null && note!.isNotEmpty) 'note': note};
}

class Cart {
  Cart({required this.locationId, required this.restaurantName, required this.lines});
  final String locationId;
  final String restaurantName;
  final List<CartLine> lines;

  int get count => lines.fold(0, (a, l) => a + l.quantity);
  int get subtotalCents => lines.fold(0, (a, l) => a + l.lineCents);
  bool get isEmpty => lines.isEmpty;

  /// Adds a line, merging with an identical one (same item, options and note). Max 50 each.
  Cart add(CartLine line) {
    final i = lines.indexWhere((l) => l.key == line.key);
    if (i < 0) return Cart(locationId: locationId, restaurantName: restaurantName, lines: [...lines, line]);
    final merged = [...lines];
    merged[i] = lines[i].withQuantity((lines[i].quantity + line.quantity).clamp(1, 50));
    return Cart(locationId: locationId, restaurantName: restaurantName, lines: merged);
  }

  Cart setQuantity(String key, int quantity) => Cart(
        locationId: locationId,
        restaurantName: restaurantName,
        lines: [for (final l in lines) if (l.key != key) l else if (quantity > 0) l.withQuantity(quantity.clamp(1, 50))],
      );

  Map<String, dynamic> toJson() => {'locationId': locationId, 'restaurantName': restaurantName, 'lines': lines.map((l) => l.toJson()).toList()};
  factory Cart.fromJson(Map<String, dynamic> j) => Cart(
        locationId: j['locationId'] as String, restaurantName: j['restaurantName'] as String,
        lines: (j['lines'] as List).map((e) => CartLine.fromJson((e as Map).cast<String, dynamic>())).toList(),
      );
}

/// Tip suggestion in cents: a percentage of the food subtotal, rounded half-up.
int tipFor(int foodCents, int percent) => (foodCents * percent + 50) ~/ 100;
