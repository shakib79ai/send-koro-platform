import 'package:flutter_test/flutter_test.dart';
import 'package:send_koro_driver/util/offer_alert.dart';
import 'package:shared_preferences/shared_preferences.dart';

class FakeOutput implements AlertOutput {
  int plays = 0;
  int vibrations = 0;
  int cancels = 0;
  final torchCalls = <bool>[];
  @override
  Future<void> play() async => plays++;
  @override
  Future<void> vibrate(List<int> pattern) async => vibrations++;
  @override
  Future<void> torch(bool on) async => torchCalls.add(on);
  @override
  Future<void> cancel() async => cancels++;
}

void main() {
  testWidgets('rings at once, repeats every 4 seconds, and stops', (tester) async {
    final out = FakeOutput();
    final alert = OfferAlert(output: out);
    alert.start('o1');
    expect(out.plays, 1);
    expect(out.vibrations, 1);
    await tester.pump(const Duration(seconds: 4));
    expect(out.plays, 2);
    alert.start('o1'); // the next poll returns the same offer: no restart
    expect(out.plays, 2);
    alert.stop();
    expect(out.cancels, 1);
    await tester.pump(const Duration(seconds: 12));
    expect(out.plays, 2);
    expect(alert.ringing, isFalse);
  });

  testWidgets('a new offer restarts the ring', (tester) async {
    final out = FakeOutput();
    final alert = OfferAlert(output: out)..start('o1');
    alert.start('o2');
    expect(out.plays, 2);
    expect(alert.ringingFor, 'o2');
    alert.stop();
  });

  testWidgets('sound and vibration can be turned off and are remembered', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final out = FakeOutput();
    final alert = OfferAlert(output: out);
    await alert.setSound(false);
    alert.start('o1');
    expect(out.plays, 0);
    expect(out.vibrations, 1);
    alert.stop();
    final again = OfferAlert(output: FakeOutput());
    await again.load();
    expect(again.sound, isFalse);
    expect(again.vibrate, isTrue);
  });

  testWidgets('the flash light blinks 4 times per ring and ends off', (tester) async {
    final out = FakeOutput();
    final alert = OfferAlert(output: out)..start('o1');
    await tester.pump(const Duration(seconds: 2));
    expect(out.torchCalls.where((on) => on).length, 4);
    expect(out.torchCalls.last, isFalse);
    alert.stop();
  });
}
