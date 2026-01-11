import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tor_chat/screens/admin_users_screen.dart';
import 'package:tor_chat/screens/admin_rooms_screen.dart';
import 'package:tor_chat/services/api_service.dart';

class AdminScreen extends ConsumerStatefulWidget {
  const AdminScreen({super.key});

  @override
  ConsumerState<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends ConsumerState<AdminScreen> {
  Map<String, dynamic>? _stats;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    setState(() => _isLoading = true);

    try {
      final apiService = ref.read(apiServiceProvider);
      final stats = await apiService.adminGetStats();

      setState(() {
        _stats = stats;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load stats: ${e.toString()}'),
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
        title: const Text('Admin Panel'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadStats,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    'Server Statistics',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (_stats != null) ...[
                    _buildStatCard(
                      'Users',
                      _stats!['users'],
                      Icons.people,
                      Colors.blue,
                    ),
                    const SizedBox(height: 12),
                    _buildStatCard(
                      'Rooms',
                      _stats!['rooms'],
                      Icons.forum,
                      Colors.green,
                    ),
                    const SizedBox(height: 12),
                    _buildStatCard(
                      'Messages',
                      _stats!['messages'],
                      Icons.message,
                      Colors.orange,
                    ),
                    const SizedBox(height: 12),
                    _buildStatCard(
                      'Active Sockets',
                      {'active': _stats!['sockets']['active']},
                      Icons.sync,
                      Colors.purple,
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Most Active Rooms',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ..._buildActiveRoomsList(),
                    const SizedBox(height: 24),
                    const Text(
                      'Management',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.people, color: Colors.blue),
                        title: const Text('Manage Users'),
                        subtitle: const Text('View, promote, ban users'),
                        trailing: const Icon(Icons.arrow_forward_ios),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const AdminUsersScreen(),
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 8),
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.forum, color: Colors.green),
                        title: const Text('Manage Rooms'),
                        subtitle: const Text('View and delete rooms'),
                        trailing: const Icon(Icons.arrow_forward_ios),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const AdminRoomsScreen(),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildStatCard(
    String title,
    Map<String, dynamic> stats,
    IconData icon,
    Color color,
  ) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 28),
                const SizedBox(width: 12),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...stats.entries.map((entry) {
              final label = _formatLabel(entry.key);
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(label),
                    Text(
                      entry.value.toString(),
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildActiveRoomsList() {
    if (_stats == null || _stats!['activeRooms'] == null) {
      return [];
    }

    final activeRooms = _stats!['activeRooms'] as List;

    if (activeRooms.isEmpty) {
      return [
        const Card(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Text('No active rooms'),
          ),
        ),
      ];
    }

    return activeRooms.map<Widget>((room) {
      return Card(
        child: ListTile(
          title: Text(room['name'] as String),
          trailing: Chip(
            label: Text('${room['messageCount']} messages'),
          ),
        ),
      );
    }).toList();
  }

  String _formatLabel(String key) {
    switch (key) {
      case 'total':
        return 'Total';
      case 'online':
        return 'Online';
      case 'banned':
        return 'Banned';
      case 'admins':
        return 'Admins';
      case 'recentRegistrations':
        return 'New (24h)';
      case 'public':
        return 'Public';
      case 'active':
        return 'Active';
      default:
        return key;
    }
  }
}
