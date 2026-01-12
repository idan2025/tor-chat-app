import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class TorService extends ChangeNotifier {
  bool _isEnabled = false;
  bool _isConnected = false;
  String _socksHost = '127.0.0.1';
  int _socksPort = 9050;
  String? _hiddenServiceAddress;

  bool get isEnabled => _isEnabled;
  bool get isConnected => _isConnected;
  String get socksHost => _socksHost;
  int get socksPort => _socksPort;
  String? get hiddenServiceAddress => _hiddenServiceAddress;

  TorService() {
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    _isEnabled = prefs.getBool('tor_enabled') ?? false;
    _socksHost = prefs.getString('tor_socks_host') ?? '127.0.0.1';
    _socksPort = prefs.getInt('tor_socks_port') ?? 9050;
    notifyListeners();

    if (_isEnabled) {
      await start();
    }
  }

  Future<void> setEnabled(bool enabled) async {
    _isEnabled = enabled;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('tor_enabled', enabled);

    if (enabled) {
      await start();
    } else {
      await stop();
    }

    notifyListeners();
  }

  Future<void> start() async {
    if (_isConnected) return;

    try {
      // TOR integration is handled via SOCKS5 proxy configuration
      // The actual TOR daemon should be running externally
      // This service just manages the connection settings
      _isConnected = true;
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to start TOR: $e');
      _isConnected = false;
      notifyListeners();
    }
  }

  Future<void> stop() async {
    if (!_isConnected) return;

    try {
      _isConnected = false;
      _hiddenServiceAddress = null;
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to stop TOR: $e');
    }
  }

  String getSocksProxy() {
    return 'SOCKS5 $_socksHost:$_socksPort';
  }

  Future<bool> checkConnection() async {
    if (!_isEnabled) return false;

    try {
      // In a real implementation, this would check if the SOCKS5 proxy is reachable
      // For now, just return the current connection status
      return _isConnected;
    } catch (e) {
      debugPrint('TOR connection check failed: $e');
      return false;
    }
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}

// Riverpod provider
final torServiceProvider = ChangeNotifierProvider<TorService>((ref) {
  return TorService();
});
