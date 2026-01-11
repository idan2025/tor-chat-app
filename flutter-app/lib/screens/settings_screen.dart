import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tor_chat/providers/auth_provider.dart';
import 'package:tor_chat/services/notification_service.dart';
import 'package:tor_chat/services/storage_service.dart';
import 'package:tor_chat/services/tor_service.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final torService = ref.watch(torServiceProvider);
    final notificationService = ref.watch(notificationServiceProvider);
    final authNotifier = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: ListView(
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'Account',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: ListTile(
              leading: const Icon(Icons.person),
              title: const Text('Profile'),
              subtitle: Text(authNotifier.currentUser?.username ?? 'Unknown'),
            ),
          ),
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: ListTile(
              leading: const Icon(Icons.email),
              title: const Text('Email'),
              subtitle: Text(authNotifier.currentUser?.email ?? 'Not set'),
            ),
          ),
          if (authNotifier.isAdmin)
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: ListTile(
                leading: const Icon(Icons.admin_panel_settings, color: Colors.blue),
                title: const Text('Admin'),
                subtitle: const Text('You have administrator privileges'),
              ),
            ),
          const Divider(height: 32),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'TOR Settings',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: SwitchListTile(
              secondary: const Icon(Icons.security),
              title: const Text('Enable TOR'),
              subtitle: torService.isEnabled
                  ? Text(torService.isConnected
                      ? 'Connected'
                      : 'Connecting...')
                  : const Text('Disabled'),
              value: torService.isEnabled,
              onChanged: (value) {
                torService.setEnabled(value);
              },
            ),
          ),
          if (torService.isEnabled && torService.isConnected)
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: ListTile(
                leading: const Icon(Icons.info),
                title: const Text('SOCKS Proxy'),
                subtitle: Text('${torService.socksHost}:${torService.socksPort}'),
              ),
            ),
          if (torService.hiddenServiceAddress != null)
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: ListTile(
                leading: const Icon(Icons.link),
                title: const Text('Hidden Service'),
                subtitle: Text(torService.hiddenServiceAddress!),
              ),
            ),
          const Divider(height: 32),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'Notifications',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: SwitchListTile(
              secondary: const Icon(Icons.notifications),
              title: const Text('Enable Notifications'),
              subtitle: const Text('Receive message notifications'),
              value: notificationService.isEnabled,
              onChanged: (value) {
                notificationService.setEnabled(value);
              },
            ),
          ),
          if (notificationService.isEnabled) ...[
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: SwitchListTile(
                secondary: const Icon(Icons.volume_up),
                title: const Text('Sound'),
                subtitle: const Text('Play notification sound'),
                value: notificationService.soundEnabled,
                onChanged: (value) {
                  notificationService.setSoundEnabled(value);
                },
              ),
            ),
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: SwitchListTile(
                secondary: const Icon(Icons.vibration),
                title: const Text('Vibration'),
                subtitle: const Text('Vibrate on notifications'),
                value: notificationService.vibrationEnabled,
                onChanged: (value) {
                  notificationService.setVibrationEnabled(value);
                },
              ),
            ),
            Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: SwitchListTile(
                secondary: const Icon(Icons.preview),
                title: const Text('Show Preview'),
                subtitle: const Text('Display message content'),
                value: notificationService.showPreview,
                onChanged: (value) {
                  notificationService.setShowPreview(value);
                },
              ),
            ),
          ],
          const Divider(height: 32),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'Data & Storage',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: ListTile(
              leading: const Icon(Icons.cleaning_services),
              title: const Text('Clear Cache'),
              subtitle: const Text('Clear cached messages and media'),
              onTap: _clearCache,
            ),
          ),
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: ListTile(
              leading: const Icon(Icons.delete_forever, color: Colors.red),
              title: const Text('Clear All Data', style: TextStyle(color: Colors.red)),
              subtitle: const Text('Delete all local data'),
              onTap: _clearAllData,
            ),
          ),
          const Divider(height: 32),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'About',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: const ListTile(
              leading: Icon(Icons.info),
              title: Text('Version'),
              subtitle: Text('0.2.0'),
            ),
          ),
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: const ListTile(
              leading: Icon(Icons.code),
              title: Text('Platform'),
              subtitle: Text('Flutter (Rust Backend)'),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Future<void> _clearCache() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear Cache'),
        content: const Text('This will clear cached messages and media. Continue?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Clear'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final storageService = ref.read(storageServiceProvider);
      await storageService.clearAllCache();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Cache cleared')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to clear cache: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _clearAllData() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear All Data'),
        content: const Text(
          'This will delete all local data including encryption keys. You will need to log in again. Continue?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete All'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final storageService = ref.read(storageServiceProvider);
      await storageService.clearAllData();

      final authNotifier = ref.read(authProvider);
      await authNotifier.logout();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('All data cleared')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to clear data: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}
