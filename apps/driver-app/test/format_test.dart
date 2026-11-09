import 'package:flutter_test/flutter_test.dart';
import 'package:send_koro_driver/util/format.dart';

void main() {
  test('usd formats integer cents with commas and a real minus sign', () {
    expect(usd(1210), '\$12.10');
    expect(usd(154000), '\$1,540.00');
    expect(usd(-200), '−\$2.00');
    expect(usd(0), '\$0.00');
  });

  test('miles and minutes match the rate card (minutes round up)', () {
    expect(miles(3219), '2.0 mi');
    expect(minutes(1081), '19 min');
    expect(minutes(1080), '18 min');
    expect(hours(18000), '5h 0m');
    expect(hours(2700), '45m');
  });

  test('phone numbers become E.164', () {
    expect(toE164('(917) 555-0123'), '+19175550123');
    expect(toE164('19175550123'), '+19175550123');
    expect(toE164('555-0123'), isNull);
  });

  test('countdown shows m:ss and never goes negative', () {
    expect(countdown(const Duration(seconds: 45)), '0:45');
    expect(countdown(const Duration(seconds: 125)), '2:05');
    expect(countdown(const Duration(seconds: -3)), '0:00');
  });
}
