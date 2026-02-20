import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tor_chat/screens/login_screen.dart';
import 'package:tor_chat/screens/room_list_screen.dart';
import 'package:tor_chat/screens/server_config_screen.dart';
import 'package:tor_chat/services/api_service.dart';
import 'package:tor_chat/services/tor_service.dart';

class LoadingScreen extends ConsumerStatefulWidget {
  const LoadingScreen({super.key});

  @override
  ConsumerState<LoadingScreen> createState() => _LoadingScreenState();
}

class _LoadingScreenState extends ConsumerState<LoadingScreen> {
  String _statusText = 'Loading...';

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    final serverUrl = prefs.getString('server_url');

    // No saved server URL — go to server config
    if (serverUrl == null || serverUrl.isEmpty) {
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const ServerConfigScreen()),
        );
      }
      return;
    }

    final apiService = ref.read(apiServiceProvider);
    apiService.setBaseUrl(serverUrl);

    // If .onion URL, bootstrap Tor first
    if (TorService.isOnionUrl(serverUrl)) {
      setState(() => _statusText = 'Starting Tor...');

      final torService = ref.read(torServiceProvider);
      await torService.start();

      if (torService.status == TorConnectionStatus.error) {
        // Tor failed — go to server config so user can retry
        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const ServerConfigScreen()),
          );
        }
        return;
      }

      apiService.enableTorProxy(torService.socksPort);
      setState(() => _statusText = 'Tor connected! Checking auth...');
    } else {
      setState(() => _statusText = 'Checking auth...');
    }

    // Load token and check auth
    await apiService.loadToken();

    try {
      await apiService.getMe();

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const RoomListScreen()),
        );
      }
    } catch (e) {
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
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
              style: TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _statusText,
              style: const TextStyle(
                fontSize: 16,
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 48),
            const CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
