import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tor_chat/models/room.dart';
import 'package:tor_chat/services/api_service.dart';

class AdminRoomsScreen extends ConsumerStatefulWidget {
  const AdminRoomsScreen({super.key});

  @override
  ConsumerState<AdminRoomsScreen> createState() => _AdminRoomsScreenState();
}

class _AdminRoomsScreenState extends ConsumerState<AdminRoomsScreen> {
  List<Room> _rooms = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadRooms();
  }

  Future<void> _loadRooms() async {
    setState(() => _isLoading = true);

    try {
      final apiService = ref.read(apiServiceProvider);
      final roomsData = await apiService.adminGetRooms();

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

  Future<void> _deleteRoom(Room room) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Room'),
        content: Text(
          'Are you sure you want to delete "${room.name}"? This will delete all messages and cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final apiService = ref.read(apiServiceProvider);
      await apiService.adminDeleteRoom(room.id);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Room deleted')),
        );
        _loadRooms();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to delete room: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _showRoomInfo(Room room) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(room.name),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (room.description != null) ...[
              const Text(
                'Description:',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(room.description!),
              const SizedBox(height: 16),
            ],
            _buildInfoRow('Type', room.isPublic ? 'Public' : 'Private'),
            _buildInfoRow('Max Members', room.maxMembers.toString()),
            if (room.memberCount != null)
              _buildInfoRow('Current Members', room.memberCount.toString()),
            if (room.messageCount != null)
              _buildInfoRow('Total Messages', room.messageCount.toString()),
            _buildInfoRow(
              'Created',
              room.createdAt.toString().split('.')[0],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () {
              Navigator.pop(context);
              _deleteRoom(room);
            },
            child: const Text('Delete Room'),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          Text(value),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Manage Rooms'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
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
                        backgroundColor:
                            room.isPublic ? Colors.green : Colors.orange,
                        child: Icon(
                          room.isPublic ? Icons.public : Icons.lock,
                          color: Colors.white,
                        ),
                      ),
                      title: Text(room.name),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (room.description != null)
                            Text(
                              room.description!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              if (room.memberCount != null) ...[
                                Icon(Icons.people,
                                    size: 14, color: Colors.grey[400]),
                                const SizedBox(width: 4),
                                Text('${room.memberCount}',
                                    style: TextStyle(color: Colors.grey[400])),
                                const SizedBox(width: 12),
                              ],
                              if (room.messageCount != null) ...[
                                Icon(Icons.message,
                                    size: 14, color: Colors.grey[400]),
                                const SizedBox(width: 4),
                                Text('${room.messageCount}',
                                    style: TextStyle(color: Colors.grey[400])),
                              ],
                            ],
                          ),
                        ],
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete, color: Colors.red),
                        onPressed: () => _deleteRoom(room),
                      ),
                      onTap: () => _showRoomInfo(room),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
