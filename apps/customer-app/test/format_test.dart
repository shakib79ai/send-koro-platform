import 'package:flutter_test/flutter_test.dart';
import 'package:send_koro_customer/util/format.dart';

void main() {
  test('usd and phone formatting', () {
    expect(usd(4001), '\$40.01');
    expect(usd(-200), '−\$2.00');
    expect(usd(800000), '\$8,000.00');
    expect(toE164('(917) 555-0123'), '+19175550123');
    expect(toE164('12'), isNull);
  });
}
