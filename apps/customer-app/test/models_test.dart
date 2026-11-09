import 'package:flutter_test/flutter_test.dart';
import 'package:send_koro_customer/api/models.dart';

void main() {
  test('receipt keeps the API lines and total; no courier names, no card fee', () {
    final p = CheckoutPreview.fromJson({
      'receipt': {
        'lines': [
          {'label': 'Subtotal', 'amountCents': 2540, 'kind': 'food'},
          {'label': 'Service charge', 'amountCents': 254, 'kind': 'fee'},
          {'label': 'Sales tax', 'amountCents': 248, 'kind': 'tax'},
          {'label': 'Delivery fee', 'amountCents': 702, 'kind': 'delivery'},
          {'label': 'Dhaka Kitchen pays part', 'amountCents': -200, 'kind': 'delivery_discount'},
          {'label': 'Courier tip', 'amountCents': 457, 'kind': 'tip'},
        ],
        'totalCents': 4001,
        'taxNote': 'Sales tax is set and paid by Dhaka Kitchen.',
      },
      'etaMinutes': 43, 'restaurant': {'id': 'r', 'name': 'Dhaka Kitchen'}, 'stripeAccount': 'acct_1',
    });
    expect(p.receipt.lines.fold<int>(0, (a, l) => a + l.amountCents), p.receipt.totalCents);
    expect(p.stripeAccount, 'acct_1');
    final text = p.receipt.lines.map((l) => l.label).join(' ').toLowerCase();
    expect(text.contains('uber') || text.contains('doordash') || text.contains('processing'), isFalse);
  });

  test('menu sections, required options and sold-out items', () {
    final r = RestaurantPage.fromJson({
      'restaurantId': 'r', 'locationId': 'l', 'name': 'Dhaka Kitchen', 'address': '12 W 21st St', 'open': true, 'busy': false, 'prepMinutes': 20,
      'fees': [{'label': 'Service charge', 'rateBps': 1000}], 'taxNote': 'Sales tax is set and paid by Dhaka Kitchen.',
      'deliveryRule': {'rule': {'kind': 'free_above', 'minFoodCents': 3500}},
      'menu': {'categories': [{'name': 'Mains', 'items': [
        {'id': 'i1', 'name': 'Kacchi Biryani', 'priceCents': 1695, 'available': true, 'allergens': ['dairy'], 'dietary': [],
         'groups': [{'id': 'g', 'name': 'Spice', 'minSelect': 1, 'maxSelect': 1, 'options': [{'id': 'o1', 'name': 'Mild', 'priceCents': 0, 'available': true}]}]},
        {'id': 'i2', 'name': 'Chicken Roast', 'priceCents': 1450, 'available': false, 'allergens': [], 'dietary': [], 'groups': []},
      ]}], 'uncategorized': []},
    });
    expect(r.sections.single.items.length, 2);
    expect(r.sections.single.items[1].soldOut, isTrue);
    expect(r.fees.single.describe(), 'Service charge: 10.0%');
    expect(deliveryOffer(r.deliveryRule), 'Free delivery on \$35+');
  });

  test('customer order view: courier first name only', () {
    final o = CustomerOrder.fromJson({
      'id': 'o', 'code': 'SK-5101', 'status': 'picked_up', 'statusText': 'On the way', 'fulfilment': 'delivery', 'locationId': 'l', 'restaurantName': 'Dhaka Kitchen',
      'items': [{'itemId': 'i1', 'name': 'Kacchi Biryani', 'quantity': 1, 'unitCents': 2045, 'options': [{'id': 'x', 'name': 'Medium'}]}],
      'receipt': {'lines': [], 'totalCents': 4001, 'taxNote': ''}, 'totalCents': 4001, 'createdAt': '2026-11-04T05:00:00.000Z',
      'delivery': {'status': 'picked_up', 'courier': {'firstName': 'Rahim', 'lat': 40.74, 'lng': -73.98}},
    });
    expect(o.isLive, isTrue);
    expect(o.courierFirstName, 'Rahim');
    expect(o.items.single.optionNames, ['Medium']);
  });
}
