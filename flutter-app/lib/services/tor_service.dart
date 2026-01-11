import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tor_flutter/tor_flutter.dart';

class TorService extends ChangeNotifier {
  TorFlutter? _tor;
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
    if (_tor != null) return;

    try {
      _tor = TorFlutter();

      // Listen to TOR status
      _tor!.connectionStatus.listen((status) {
        _isConnected = status == TorConnectionStatus.connected;
        notifyListeners();
      });

      // Start TOR
      await _tor!.start();

      // Get SOCKS proxy info
      final proxyInfo = await _tor!.getProxyInfo();
      _socksHost = proxyInfo['host'] ?? '127.0.0.1';
      _socksPort = proxyInfo['port'] ?? 9050;

      // Get hidden service if available
      try {
        _hiddenServiceAddress = await _tor!.getHiddenServiceAddress();
      } catch (e) {
        debugPrint('Failed to get hidden service address: $e');
      }

      notifyListeners();
    } catch (e) {
      debugPrint('Failed to start TOR: $e');
      _isConnected = false;
      notifyListeners();
    }
  }

  Future<void> stop() async {
    if (_tor == null) return;

    try {
      await _tor!.stop();
      _tor = null;
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
    if (_tor == null || !_isEnabled) return false;

    try {
      final status = await _tor!.getConnectionStatus();
      _isConnected = status == TorConnectionStatus.connected;
      notifyListeners();
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
