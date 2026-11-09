/// Build-time configuration. Pass with --dart-define, e.g.
///   flutter run --dart-define=API_URL=https://api.sendkoro.com/v1
/// The default reaches a local API from the Android emulator.
class Config {
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:3001/v1');

  /// How often to look for new offers while online (the server also re-offers every 10 s).
  static const offerPoll = Duration(seconds: 4);

  /// How often to send the driver's location while online.
  static const locationEvery = Duration(seconds: 15);
}
