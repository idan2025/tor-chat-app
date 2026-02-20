import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socks_proxy/socks_client.dart';
import 'package:tor/tor.dart';

enum TorConnectionStatus {
  stopped,
  bootstrapping,
  connected,
  error,
}

class TorService extends ChangeNotifier {
  TorConnectionStatus _status = TorConnectionStatus.stopped;
  int _socksPort = 0;
  int _bootstrapProgress = 0;
  String? _errorMessage;

  TorConnectionStatus get status => _status;
  int get socksPort => _socksPort;
  int get bootstrapProgress => _bootstrapProgress;
  String? get errorMessage => _errorMessage;
  bool get isConnected => _status == TorConnectionStatus.connected;
  bool get isRunning =>
      _status == TorConnectionStatus.connected ||
      _status == TorConnectionStatus.bootstrapping;

  static bool isOnionUrl(String url) {
    final lower = url.toLowerCase();
    return lower.contains('.onion') && !lower.contains('.onion.');
  }

  /// Normalize .onion URL: use http:// (Tor provides encryption)
  static String normalizeOnionUrl(String url) {
    final trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      if (isOnionUrl(trimmed) && trimmed.startsWith('https://')) {
        return 'http://${trimmed.substring(8)}';
      }
      return trimmed;
    }
    return 'http://$trimmed';
  }

  /// Start the embedded Tor daemon and set up SOCKS5 proxy
  Future<void> start() async {
    if (_status == TorConnectionStatus.connected) return;

    try {
      _status = TorConnectionStatus.bootstrapping;
      _bootstrapProgress = 0;
      _errorMessage = null;
      notifyListeners();

      // Initialize and start Tor
      await Tor.init();
      await Tor.instance.start();

      _socksPort = Tor.instance.port;
      _status = TorConnectionStatus.connected;
      _bootstrapProgress = 100;

      // Set global HttpOverrides so all Dart HTTP goes through SOCKS5
      HttpOverrides.global = _TorHttpOverrides(_socksPort);

      debugPrint('Tor started on SOCKS5 port $_socksPort');
      notifyListeners();
    } catch (e) {
      _status = TorConnectionStatus.error;
      _errorMessage = e.toString();
      debugPrint('Tor start failed: $e');
      notifyListeners();
    }
  }

  /// Stop Tor and reset proxy settings
  Future<void> stop() async {
    try {
      if (Tor.instance.started) {
        await Tor.instance.stop();
      }
      HttpOverrides.global = null;
      _status = TorConnectionStatus.stopped;
      _socksPort = 0;
      _bootstrapProgress = 0;
      _errorMessage = null;
      notifyListeners();
    } catch (e) {
      debugPrint('Tor stop failed: $e');
    }
  }

  /// Restart Tor
  Future<void> restart() async {
    await stop();
    await start();
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}

/// HttpOverrides that routes all Dart HTTP traffic through SOCKS5
class _TorHttpOverrides extends HttpOverrides {
  final int socksPort;

  _TorHttpOverrides(this.socksPort);

  @override
  HttpClient createHttpClient(SecurityContext? context) {
    final client = super.createHttpClient(context);
    SocksTCPClient.assignToHttpClient(client, [
      ProxySettings(InternetAddress.loopbackIPv4, socksPort),
    ]);
    return client;
  }
}

// Riverpod provider
final torServiceProvider = ChangeNotifierProvider<TorService>((ref) {
  return TorService();
});
