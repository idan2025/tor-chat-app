import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tor_chat/screens/login_screen.dart';
import 'package:tor_chat/screens/room_list_screen.dart';
import 'package:tor_chat/services/api_service.dart';
import 'package:tor_chat/services/tor_service.dart';

class ServerConfigScreen extends ConsumerStatefulWidget {
  const ServerConfigScreen({super.key});

  @override
  ConsumerState<ServerConfigScreen> createState() => _ServerConfigScreenState();
}

class _ServerConfigScreenState extends ConsumerState<ServerConfigScreen> {
  final _urlController = TextEditingController();
  bool _loading = false;
  String? _error;
  String? _statusText;
  double _torProgress = 0;

  @override
  void initState() {
    super.initState();
    _loadSavedUrl();
  }

  Future<void> _loadSavedUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final url = prefs.getString('server_url');
    if (url != null) {
      _urlController.text = url;
    }
  }

  bool get _isOnion => TorService.isOnionUrl(_urlController.text);

  Future<void> _connect() async {
    final rawUrl = _urlController.text.trim();
    if (rawUrl.isEmpty) {
      setState(() => _error = 'Please enter a server URL');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
      _statusText = null;
      _torProgress = 0;
    });

    final isOnion = TorService.isOnionUrl(rawUrl);
    final url = isOnion ? TorService.normalizeOnionUrl(rawUrl) : rawUrl;

    // If .onion, start Tor first
    if (isOnion) {
      setState(() => _statusText = 'Starting Tor...');

      final torService = ref.read(torServiceProvider);
      await torService.start();

      if (torService.status == TorConnectionStatus.error) {
        setState(() {
          _error = 'Tor failed: ${torService.errorMessage}';
          _loading = false;
          _statusText = null;
        });
        return;
      }

      setState(() {
        _statusText = 'Tor connected!';
        _torProgress = 1.0;
      });

      // Configure API with Tor proxy
      final apiService = ref.read(apiServiceProvider);
      apiService.enableTorProxy(torService.socksPort);
    } else {
      // Clearnet — disable any Tor proxy
      final torService = ref.read(torServiceProvider);
      if (torService.isRunning) {
        await torService.stop();
      }
      final apiService = ref.read(apiServiceProvider);
      apiService.disableTorProxy();
    }

    // Set base URL and health check
    final apiService = ref.read(apiServiceProvider);
    apiService.setBaseUrl(url);

    try {
      // Health check
      setState(() => _statusText = 'Checking server...');
      await apiService.getMe(); // Will throw if not authenticated, but proves server is reachable

      // Save URL
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('server_url', url);

      // Already authenticated — go to rooms
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const RoomListScreen()),
        );
      }
    } catch (e) {
      // Server reachable but not authenticated, or server unreachable
      // Try a simple request to distinguish
      try {
        // Try health endpoint or just go to login
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('server_url', url);

        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const LoginScreen()),
          );
        }
      } catch (e2) {
        setState(() {
          _error = 'Failed to connect: $e2';
          _loading = false;
          _statusText = null;
        });
      }
    }
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.security,
                size: 80,
                color: Colors.deepPurple,
              ),
              const SizedBox(height: 24),
              const Text(
                'TOR Chat',
                style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Configure your server',
                style: TextStyle(fontSize: 16, color: Colors.grey),
              ),
              const SizedBox(height: 40),
              if (_error != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                  ),
                  child: Text(_error!, style: const TextStyle(color: Colors.red)),
                ),
              TextField(
                controller: _urlController,
                decoration: const InputDecoration(
                  labelText: 'Server URL',
                  hintText: 'http://your-server:9274 or .onion',
                  prefixIcon: Icon(Icons.dns),
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              // .onion detection indicator
              if (_urlController.text.trim().isNotEmpty)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: _isOnion
                        ? Colors.deepPurple.withValues(alpha: 0.1)
                        : Colors.grey.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: _isOnion
                          ? Colors.deepPurple.withValues(alpha: 0.3)
                          : Colors.grey.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _isOnion ? Icons.security : Icons.public,
                        size: 16,
                        color: _isOnion ? Colors.deepPurple : Colors.grey,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _isOnion
                            ? 'Onion address — will connect via embedded Tor'
                            : 'Clearnet — direct connection',
                        style: TextStyle(
                          fontSize: 13,
                          color: _isOnion
                              ? Colors.deepPurple[200]
                              : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 16),
              // Tor progress
              if (_statusText != null) ...[
                Text(
                  _statusText!,
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.deepPurple[200],
                  ),
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: _torProgress > 0 ? _torProgress : null,
                    backgroundColor: Colors.grey[800],
                    valueColor: const AlwaysStoppedAnimation<Color>(
                      Colors.deepPurple,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : _connect,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.deepPurple,
                    foregroundColor: Colors.white,
                  ),
                  child: Text(
                    _loading
                        ? (_isOnion
                            ? 'Connecting via Tor...'
                            : 'Connecting...')
                        : 'Connect',
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
