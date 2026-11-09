import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:torch_light/torch_light.dart';
import 'package:vibration/vibration.dart';

/// Plays the sound, the vibration and the flash light. Separate so tests can swap in a fake.
abstract class AlertOutput {
  Future<void> play();
  Future<void> vibrate(List<int> pattern);
  /// Turns the camera flash light on or off (no-op on phones without one).
  Future<void> torch(bool on);
  Future<void> cancel();
}

/// Real phone output: assets/sounds/new_offer.wav ("bubble rise": quick rising plucks, played twice, 2.3 s),
/// a short-short-long vibration and the camera flash light.
class DeviceAlertOutput implements AlertOutput {
  AudioPlayer? _player;

  Future<AudioPlayer> _ready() async {
    final existing = _player;
    if (existing != null) return existing;
    final p = AudioPlayer();
    await p.setReleaseMode(ReleaseMode.stop);
    // iOS: "playback" so the offer is heard with the ringer switch on silent; mixes with music or navigation.
    // Android: plays on the notification/ringtone stream and briefly lowers other audio.
    await p.setAudioContext(AudioContext(
      iOS: AudioContextIOS(category: AVAudioSessionCategory.playback, options: const {AVAudioSessionOptions.mixWithOthers}),
      android: const AudioContextAndroid(
        contentType: AndroidContentType.sonification,
        usageType: AndroidUsageType.notificationRingtone,
        audioFocus: AndroidAudioFocus.gainTransientMayDuck,
      ),
    ));
    return _player = p;
  }

  @override
  Future<void> play() async {
    final p = await _ready();
    await p.stop();
    await p.play(AssetSource('sounds/new_offer.wav'), volume: 1.0);
  }

  @override
  Future<void> vibrate(List<int> pattern) async {
    if (await Vibration.hasVibrator() != true) return;
    await Vibration.vibrate(pattern: pattern);
  }

  bool? _hasTorch;

  @override
  Future<void> torch(bool on) async {
    _hasTorch ??= await TorchLight.isTorchAvailable();
    if (_hasTorch != true) return;
    if (on) {
      await TorchLight.enableTorch();
    } else {
      await TorchLight.disableTorch();
    }
  }

  @override
  Future<void> cancel() async {
    await _player?.stop();
    await Vibration.cancel();
    if (_hasTorch == true) await TorchLight.disableTorch();
  }
}

/// Rings for a new offer: sound + vibration + flash light right away, then again every [repeatEvery]
/// until the driver accepts or declines, or the offer expires. Settings are saved on the phone.
class OfferAlert extends ChangeNotifier {
  OfferAlert({AlertOutput? output, this.repeatEvery = const Duration(seconds: 4)}) : _output = output ?? DeviceAlertOutput();

  static const soundKey = 'offer_alert_sound';
  static const vibrateKey = 'offer_alert_vibrate';
  static const flashKey = 'offer_alert_flash';
  static const blinkKey = 'offer_alert_blink';
  /// Flash light blinks per ring: on/off every 250 ms (2 per second, within photosensitivity guidance).
  static const flashBlinks = 4;
  static const flashStep = Duration(milliseconds: 250);
  /// Wait, buzz, wait, buzz, ... in milliseconds: short, short, long.
  static const vibrationPattern = [0, 140, 70, 140, 70, 420];

  final AlertOutput _output;
  final Duration repeatEvery;
  bool sound = true;
  bool vibrate = true;
  bool flash = true;
  /// Read by the home screen, which blinks while an offer is waiting.
  bool blink = true;
  String? ringingFor;
  Timer? _timer;
  Timer? _flashTimer;

  bool get ringing => ringingFor != null;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    sound = prefs.getBool(soundKey) ?? true;
    vibrate = prefs.getBool(vibrateKey) ?? true;
    flash = prefs.getBool(flashKey) ?? true;
    blink = prefs.getBool(blinkKey) ?? true;
    notifyListeners();
  }

  Future<void> setSound(bool on) async {
    sound = on;
    notifyListeners();
    await (await SharedPreferences.getInstance()).setBool(soundKey, on);
  }

  Future<void> setVibrate(bool on) async {
    vibrate = on;
    notifyListeners();
    await (await SharedPreferences.getInstance()).setBool(vibrateKey, on);
  }

  Future<void> setFlash(bool on) async {
    flash = on;
    notifyListeners();
    await (await SharedPreferences.getInstance()).setBool(flashKey, on);
  }

  Future<void> setBlink(bool on) async {
    blink = on;
    notifyListeners();
    await (await SharedPreferences.getInstance()).setBool(blinkKey, on);
  }

  /// Starts ringing for [offerId]. Calling again for the same offer does nothing, so polling never restarts it.
  void start(String offerId) {
    if (ringingFor == offerId) return;
    _timer?.cancel();
    ringingFor = offerId;
    _ringOnce();
    _timer = Timer.periodic(repeatEvery, (_) => _ringOnce());
  }

  void stop() {
    if (ringingFor == null) return;
    _timer?.cancel();
    _timer = null;
    _flashTimer?.cancel();
    _flashTimer = null;
    ringingFor = null;
    _safe(_output.cancel);
  }

  /// "Play the offer sound" in Account.
  void test() => _ringOnce();

  void _ringOnce() {
    if (sound) _safe(_output.play);
    if (vibrate) _safe(() => _output.vibrate(vibrationPattern));
    if (flash) _blinkTorch();
  }

  void _blinkTorch() {
    _flashTimer?.cancel();
    var step = 0;
    _safe(() => _output.torch(true));
    _flashTimer = Timer.periodic(flashStep, (t) {
      step++;
      final on = step.isEven && step < flashBlinks * 2;
      _safe(() => _output.torch(on));
      if (step >= flashBlinks * 2 - 1) t.cancel();
    });
  }

  void _safe(Future<void> Function() fn) {
    fn().catchError((Object e) => debugPrint('OfferAlert: $e'));
  }

  @override
  void dispose() {
    _timer?.cancel();
    _flashTimer?.cancel();
    super.dispose();
  }
}
