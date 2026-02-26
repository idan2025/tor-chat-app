import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tor_chat/models/room.dart';
import 'package:tor_chat/screens/chat_screen.dart';
import 'package:tor_chat/screens/login_screen.dart';
import 'package:tor_chat/services/api_service.dart';
import 'package:tor_chat/services/socket_service.dart';
import 'package:tor_chat/services/update_service.dart';

class RoomListScreen extends ConsumerStatefulWidget {
  const RoomListScreen({super.key});

  @override
  ConsumerState<RoomListScreen> createState() => _RoomListScreenState();
}

class _RoomListScreenState extends ConsumerState<RoomListScreen> {
  List<Room> _rooms = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadRooms();
    _setupSocketListeners();
    _checkForUpdates();
    // Clean up APKs from previous updates
    ref.read(updateServiceProvider).cleanupOldUpdates();
  }

  void _setupSocketListeners() {
    final socketService = ref.read(socketServiceProvider);

    socketService.on('room_created', (data) {
      _loadRooms();
    });

    socketService.on('room_deleted', (data) {
      _loadRooms();
    });
  }

  Future<void> _checkForUpdates() async {
    final updateService = ref.read(updateServiceProvider);
    final info = await updateService.checkForUpdate();
    if (info != null && info.updateAvailable && mounted) {
      _showUpdateDialog(info);
    }
  }

  void _showUpdateDialog(UpdateInfo info) {
    final isPatch = info.updateType == UpdateType.patch;
    final title = isPatch ? 'Patch Available' : 'Update Available';
    final body = isPatch
        ? 'A new build of v${info.latestVersion} is available.'
        : 'v${info.currentVersion} -> v${info.latestVersion}';
    final buttonText = isPatch ? 'Install Patch' : 'Update Now';

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(body),
            if (info.releaseNotes.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text('What\'s new:', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 200),
                child: SingleChildScrollView(
                  child: Text(
                    info.releaseNotes,
                    style: const TextStyle(fontSize: 13, color: Colors.grey),
                  ),
                ),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Later'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _startUpdate();
            },
            child: Text(buttonText),
          ),
        ],
      ),
    );
  }

  void _startUpdate() {
    final updateService = ref.read(updateServiceProvider);

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => Consumer(
        builder: (context, ref, _) {
          final service = ref.watch(updateServiceProvider);

          if (service.error != null) {
            return AlertDialog(
              title: const Text('Update Failed'),
              content: Text(service.error!),
              actions: [
                TextButton(
                  onPressed: () {
                    service.clearError();
                    Navigator.pop(context);
                  },
                  child: const Text('Close'),
                ),
              ],
            );
          }

          return AlertDialog(
            title: const Text('Downloading Update'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                LinearProgressIndicator(value: service.downloadProgress),
                const SizedBox(height: 12),
                Text('${(service.downloadProgress * 100).toStringAsFixed(0)}%'),
                if (service.downloadProgress >= 1.0)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text('Installing...', style: TextStyle(color: Colors.green)),
                  ),
              ],
            ),
          );
        },
      ),
    );

    updateService.downloadAndInstall();
  }

  Future<void> _loadRooms() async {
    setState(() => _isLoading = true);

    try {
      final apiService = ref.read(apiServiceProvider);
      final roomsData = await apiService.getRooms();

      setState(() {
        _rooms = roomsData.map((r) => Room.fromJson(r)).toList();
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load rooms: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _createRoom() async {
    final nameController = TextEditingController();
    final descriptionController = TextEditingController();
    bool isPublic = true;

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Create Room'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Room Name',
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: descriptionController,
                decoration: const InputDecoration(
                  labelText: 'Description (Optional)',
                ),
                maxLines: 3,
              ),
              const SizedBox(height: 16),
              SwitchListTile(
                title: const Text('Public Room'),
                value: isPublic,
                onChanged: (value) {
                  setState(() => isPublic = value);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );

    if (result == true && nameController.text.trim().isNotEmpty) {
      try {
        final apiService = ref.read(apiServiceProvider);
        await apiService.createRoom(
          name: nameController.text.trim(),
          description: descriptionController.text.trim().isEmpty
              ? null
              : descriptionController.text.trim(),
          isPublic: isPublic,
        );

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Room created successfully')),
          );
          _loadRooms();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to create room: ${e.toString()}'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  Future<void> _logout() async {
    try {
      final apiService = ref.read(apiServiceProvider);
      await apiService.logout();

      final socketService = ref.read(socketServiceProvider);
      socketService.disconnect();

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Logout failed: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('TOR Chat'),
        actions: [
          IconButton(
            icon: const Icon(Icons.system_update),
            tooltip: 'Check for updates',
            onPressed: _checkForUpdates,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _rooms.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.forum_outlined,
                        size: 64,
                        color: Colors.grey,
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'No rooms available',
                        style: TextStyle(
                          fontSize: 18,
                          color: Colors.grey,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Create your first room to get started',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadRooms,
                  child: ListView.builder(
                    itemCount: _rooms.length,
                    itemBuilder: (context, index) {
                      final room = _rooms[index];
                      return Card(
                        margin: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        child: ListTile(
                          leading: CircleAvatar(
                            child: Icon(
                              room.isPublic
                                  ? Icons.public
                                  : Icons.lock,
                            ),
                          ),
                          title: Text(room.name),
                          subtitle: room.description != null
                              ? Text(
                                  room.description!,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                )
                              : null,
                          trailing: room.isPublic
                              ? const Chip(
                                  label: Text('Public'),
                                  backgroundColor: Colors.green,
                                )
                              : const Chip(
                                  label: Text('Private'),
                                  backgroundColor: Colors.orange,
                                ),
                          onTap: () async {
                            final shouldRefresh = await Navigator.of(context).push<bool>(
                              MaterialPageRoute(
                                builder: (_) => ChatScreen(room: room),
                              ),
                            );
                            if (shouldRefresh == true) {
                              _loadRooms();
                            }
                          },
                        ),
                      );
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: _createRoom,
        child: const Icon(Icons.add),
      ),
    );
  }
}
