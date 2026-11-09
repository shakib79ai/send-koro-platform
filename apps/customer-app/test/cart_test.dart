import 'package:flutter_test/flutter_test.dart';
import 'package:send_koro_customer/state/cart.dart';

CartLine line(String id, {int q = 1, List<String> opts = const [], int unit = 1450, String? note}) =>
    CartLine(itemId: id, name: id, quantity: q, optionIds: opts, optionNames: opts, unitCents: unit, note: note);

void main() {
  test('identical lines merge; different options or notes stay separate', () {
    var c = Cart(locationId: 'L', restaurantName: 'Dhaka Kitchen', lines: const []);
    c = c.add(line('biryani', opts: ['raita', 'hot']));
    c = c.add(line('biryani', q: 2, opts: ['hot', 'raita']));
    c = c.add(line('biryani', opts: ['salad']));
    c = c.add(line('biryani', opts: ['salad'], note: 'no onions'));
    expect(c.lines.length, 3);
    expect(c.lines.first.quantity, 3);
    expect(c.count, 5);
  });

  test('subtotal is integer cents; quantity 0 removes the line; max 50', () {
    var c = Cart(locationId: 'L', restaurantName: 'R', lines: [line('a', q: 2, unit: 1600), line('b', unit: 495)]);
    expect(c.subtotalCents, 3695);
    c = c.setQuantity(c.lines.first.key, 0);
    expect(c.lines.single.itemId, 'b');
    c = c.setQuantity(c.lines.single.key, 99);
    expect(c.lines.single.quantity, 50);
  });

  test('tip suggestions round half-up in cents', () {
    expect(tipFor(2540, 18), 457); // 457.2
    expect(tipFor(2540, 15), 381); // 381.0
    expect(tipFor(2525, 18), 455); // 454.5 → 455
  });

  test('cart survives a save/load round trip and builds API order lines', () {
    final c = Cart(locationId: 'L', restaurantName: 'R', lines: [line('a', opts: ['x'], note: 'extra spicy')]);
    final back = Cart.fromJson(c.toJson());
    expect(back.lines.single.toOrderLine(), {'itemId': 'a', 'quantity': 1, 'optionIds': ['x'], 'note': 'extra spicy'});
  });
}
