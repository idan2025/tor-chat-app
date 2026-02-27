import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tor_chat/components/message_bubble.dart';
import 'package:tor_chat/components/message_input.dart';
import 'package:tor_chat/models/message.dart';
import 'package:tor_chat/models/room.dart';
import 'package:tor_chat/providers/auth_provider.dart';
import 'package:tor_chat/services/api_service.dart';
import 'package:tor_chat/services/crypto_service.dart';
import 'package:tor_chat/services/socket_service.dart';
import 'package:tor_chat/services/storage_service.dart';

class ChatScreen extends ConsumerStatefulWidget {
  final Room room;

  const ChatScreen({super.key, required this.room});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _scrollController = ScrollController();
  List<Message> _messages = [];
  bool _isLoading = true;
  String? _roomKey;

  // Typing indicator state
  List<String> _typingUsers = [];
  Timer? _typingTimer;

  // Reply state
  Message? _replyingTo;

  @override
  void initState() {
    super.initState();
    _initializeChat();
  }

  Future<void> _initializeChat() async {
    // Join room via socket
    final socketService = ref.read(socketServiceProvider);
    socketService.joinRoom(widget.room.id);

    // Setup socket listeners
    socketService.on('new_message', _handleNewMessage);
    socketService.on('message_edited', _handleMessageEdited);
    socketService.on('message_deleted', _handleMessageDeleted);
    socketService.on('user_typing', _handleUserTyping);
    socketService.on('reaction_added', _handleReactionAdded);
    socketService.on('reaction_removed', _handleReactionRemoved);
    socketService.on('message_pinned', _handleMessagePinned);
    socketService.on('message_unpinned', _handleMessageUnpinned);

    // Load room key
    final storageService = ref.read(storageServiceProvider);
    _roomKey = await storageService.getRoomKey(widget.room.id);

    // If no key, get from API or room data
    if (_roomKey == null && widget.room.roomKey != null) {
      _roomKey = widget.room.roomKey;
      await storageService.storeRoomKey(widget.room.id, _roomKey!);
    }

    // Load messages
    await _loadMessages();

    // Mark read with latest message
    if (_messages.isNotEmpty) {
      socketService.markRead(widget.room.id, _messages.first.id);
    }
  }

  /// Safely cast socket event data to Map<String, dynamic>.
  /// socket_io_client may deliver data as Map<dynamic, dynamic>,
  /// Map<String, dynamic>, or even wrapped in a List.
  Map<String, dynamic>? _castSocketData(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    if (data is List && data.isNotEmpty) {
      final first = data[0];
      if (first is Map<String, dynamic>) return first;
      if (first is Map) return Map<String, dynamic>.from(first);
    }
    debugPrint('Unexpected socket data type: ${data.runtimeType}');
    return null;
  }

  Future<void> _handleNewMessage(dynamic data) async {
    try {
      final map = _castSocketData(data);
      if (map == null) return;

      // Only handle messages for this room
      final msgRoomId = map['roomId'] as String?;
      if (msgRoomId != null && msgRoomId != widget.room.id) return;

      final message = Message.fromJson(map);

      // Skip duplicates
      if (_messages.any((m) => m.id == message.id)) return;

      // Decrypt message if encrypted
      if (_roomKey != null) {
        try {
          final cryptoService = ref.read(cryptoServiceProvider);
          final decryptedContent =
              await cryptoService.decryptRoomMessage(message.content, _roomKey!);
          final decryptedMessage = message.copyWith(content: decryptedContent);
          if (mounted) {
            setState(() {
              _messages.insert(0, decryptedMessage);
            });
          }
        } catch (e) {
          // If decryption fails, show message as-is (may be plaintext)
          if (mounted) {
            setState(() {
              _messages.insert(0, message);
            });
          }
        }
      } else {
        if (mounted) {
          setState(() {
            _messages.insert(0, message);
          });
        }
      }

      _scrollToBottom();
    } catch (e) {
      debugPrint('Error handling new_message: $e');
    }
  }

  void _handleMessageEdited(dynamic data) {
    try {
      final map = _castSocketData(data);
      if (map == null) return;
      final messageId = map['messageId'] as String?;
      final content = map['content'] as String?;
      if (messageId == null || content == null) return;

      setState(() {
        final index = _messages.indexWhere((m) => m.id == messageId);
        if (index != -1) {
          _messages[index] = _messages[index].copyWith(content: content);
        }
      });
    } catch (e) {
      debugPrint('Error handling message_edited: $e');
    }
  }

  void _handleMessageDeleted(dynamic data) {
    try {
      final map = _castSocketData(data);
      if (map == null) return;
      final messageId = map['messageId'] as String?;
      if (messageId == null) return;

      setState(() {
        _messages.removeWhere((m) => m.id == messageId);
      });
    } catch (e) {
      debugPrint('Error handling message_deleted: $e');
    }
  }

  void _handleUserTyping(dynamic data) {
    try {
      final map = _castSocketData(data);
      if (map == null) return;
      final username = map['username'] as String? ?? '';
      final isTyping = map['typing'] as bool? ?? false;
      final roomId = map['roomId'] as String? ?? '';

      if (roomId != widget.room.id) return;

      setState(() {
        if (isTyping && !_typingUsers.contains(username)) {
          _typingUsers.add(username);
        } else if (!isTyping) {
          _typingUsers.remove(username);
        }
      });
    } catch (e) {
      debugPrint('Error handling user_typing: $e');
    }
  }

  void _handleReactionAdded(dynamic data) {
    try {
      final map = _castSocketData(data);
      if (map == null) return;
      final messageId = map['messageId'] as String?;
      final emoji = map['emoji'] as String?;
      final userId = map['userId'] as String?;
      if (messageId == null || emoji == null || userId == null) return;

      setState(() {
        final index = _messages.indexWhere((m) => m.id == messageId);
        if (index != -1) {
          final msg = _messages[index];
          final reactions = Map<String, dynamic>.from(msg.reactions);
          final existing = reactions[emoji];
          final List<String> users;
          if (existing is List) {
            users = List<String>.from(existing);
          } else {
            users = <String>[];
          }
          if (!users.contains(userId)) {
            users.add(userId);
          }
          reactions[emoji] = users;
          _messages[index] = msg.copyWith(reactions: reactions);
        }
      });
    } catch (e) {
      debugPrint('Error handling reaction_added: $e');
    }
  }

  void _handleReactionRemoved(dynamic data) {
    try {
      final map = _castSocketData(data);
      if (map == null) return;
      final messageId = map['messageId'] as String?;
      final emoji = map['emoji'] as String?;
      final userId = map['userId'] as String?;
      if (messageId == null || emoji == null || userId == null) return;

      setState(() {
        final index = _messages.indexWhere((m) => m.id == messageId);
        if (index != -1) {
          final msg = _messages[index];
          final reactions = Map<String, dynamic>.from(msg.reactions);
          final existing = reactions[emoji];
          final List<String> users;
          if (existing is List) {
            users = List<String>.from(existing);
          } else {
            users = <String>[];
          }
          users.remove(userId);
          if (users.isEmpty) {
            reactions.remove(emoji);
          } else {
            reactions[emoji] = users;
          }
          _messages[index] = msg.copyWith(reactions: reactions);
        }
      });
    } catch (e) {
      debugPrint('Error handling reaction_removed: $e');
    }
  }

  void _handleMessagePinned(dynamic data) {
    try {
      final map = _castSocketData(data);
      if (map == null) return;
      final messageId = map['messageId'] as String?;
      final pinnedBy = map['pinnedBy'] as String?;
      final pinnedAtStr = map['pinnedAt'] as String?;
      if (messageId == null) return;

      setState(() {
        final index = _messages.indexWhere((m) => m.id == messageId);
        if (index != -1) {
          _messages[index] = _messages[index].copyWith(
            pinnedBy: pinnedBy,
            pinnedAt: pinnedAtStr != null ? DateTime.tryParse(pinnedAtStr) : null,
          );
        }
      });
    } catch (e) {
      debugPrint('Error handling message_pinned: $e');
    }
  }

  void _handleMessageUnpinned(dynamic data) {
    try {
      final map = _castSocketData(data);
      if (map == null) return;
      final messageId = map['messageId'] as String?;
      if (messageId == null) return;

      setState(() {
        final index = _messages.indexWhere((m) => m.id == messageId);
        if (index != -1) {
          _messages[index] = _messages[index].copyWith(clearPinned: true);
        }
      });
    } catch (e) {
      debugPrint('Error handling message_unpinned: $e');
    }
  }

  void _onTypingChanged(bool typing) {
    final socketService = ref.read(socketServiceProvider);

    _typingTimer?.cancel();
    if (typing) {
      socketService.sendTyping(widget.room.id, true);
      _typingTimer = Timer(const Duration(seconds: 2), () {
        socketService.sendTyping(widget.room.id, false);
      });
    } else {
      socketService.sendTyping(widget.room.id, false);
    }
  }

  Future<void> _loadMessages() async {
    setState(() => _isLoading = true);

    try {
      final apiService = ref.read(apiServiceProvider);
      final messagesData = await apiService.getRoomMessages(widget.room.id);

      final messages = messagesData.map((m) => Message.fromJson(m)).toList();

      // Decrypt messages if room key exists
      if (_roomKey != null) {
        final cryptoService = ref.read(cryptoServiceProvider);
        final decryptedMessages = await Future.wait(
          messages.map((msg) async {
            try {
              final decryptedContent =
                  await cryptoService.decryptRoomMessage(msg.content, _roomKey!);
              return msg.copyWith(content: decryptedContent);
            } catch (e) {
              return msg;
            }
          }),
        );

        setState(() {
          _messages = decryptedMessages;
          _isLoading = false;
        });
      } else {
        setState(() {
          _messages = messages;
          _isLoading = false;
        });
      }

      _scrollToBottom();
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load messages: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _sendMessage(String text) async {
    if (text.isEmpty) return;

    // Stop typing indicator
    _typingTimer?.cancel();
    final socketService = ref.read(socketServiceProvider);
    socketService.sendTyping(widget.room.id, false);

    // Encrypt message if room key exists
    String content = text;
    if (_roomKey != null) {
      final cryptoService = ref.read(cryptoServiceProvider);
      content = await cryptoService.encryptRoomMessage(text, _roomKey!);
    }

    // Send via socket
    socketService.sendMessage(
      roomId: widget.room.id,
      content: content,
      replyTo: _replyingTo?.id,
    );

    // Clear reply state
    if (_replyingTo != null) {
      setState(() => _replyingTo = null);
    }
  }

  Future<void> _sendFileMessage(String fileUrl, String messageType) async {
    final socketService = ref.read(socketServiceProvider);

    // Encrypt file URL if room key exists
    String content = fileUrl;
    if (_roomKey != null) {
      final cryptoService = ref.read(cryptoServiceProvider);
      content = await cryptoService.encryptRoomMessage(fileUrl, _roomKey!);
    }

    socketService.sendMessage(
      roomId: widget.room.id,
      content: content,
      messageType: messageType,
    );
  }

  void _showMembersPanel() {
    final apiService = ref.read(apiServiceProvider);
    final authNotifier = ref.read(authProvider);
    final currentUserId = authNotifier.currentUser?.id;
    final isAdmin = authNotifier.isAdmin;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1E1E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        minChildSize: 0.3,
        maxChildSize: 0.8,
        expand: false,
        builder: (context, scrollController) => FutureBuilder<List<dynamic>>(
          future: apiService.getRoomMembers(widget.room.id),
          builder: (context, snapshot) {
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Members',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (isAdmin || widget.room.creatorId == currentUserId)
                        TextButton.icon(
                          icon: const Icon(Icons.person_add, size: 18),
                          label: const Text('Add'),
                          onPressed: () {
                            Navigator.pop(context);
                            _showAddMemberDialog();
                          },
                        ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const Expanded(
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (snapshot.hasError)
                  Expanded(
                    child: Center(
                      child: Text('Error: ${snapshot.error}'),
                    ),
                  )
                else
                  Expanded(
                    child: ListView.builder(
                      controller: scrollController,
                      itemCount: snapshot.data?.length ?? 0,
                      itemBuilder: (context, index) {
                        final member = snapshot.data![index];
                        final user = member['user'];
                        if (user == null || user is! Map) {
                          return const SizedBox.shrink();
                        }
                        final username = user['username'] as String? ?? '?';
                        final displayName = user['displayName'] as String?;
                        final isOnline = user['isOnline'] as bool? ?? false;
                        final role = member['role'] as String? ?? 'member';
                        final memberId = member['userId'] as String? ?? '';
                        final isCreator = widget.room.creatorId == memberId;
                        final canRemove = (isAdmin || widget.room.creatorId == currentUserId)
                            && !isCreator
                            && memberId != currentUserId;

                        return ListTile(
                          leading: Stack(
                            children: [
                              CircleAvatar(
                                backgroundColor: Colors.deepPurple,
                                child: Text(
                                  username[0].toUpperCase(),
                                  style: const TextStyle(color: Colors.white),
                                ),
                              ),
                              if (isOnline)
                                Positioned(
                                  right: 0,
                                  bottom: 0,
                                  child: Container(
                                    width: 12,
                                    height: 12,
                                    decoration: BoxDecoration(
                                      color: Colors.green,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: const Color(0xFF1E1E1E),
                                        width: 2,
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          title: Text(displayName ?? username),
                          subtitle: Text(
                            role == 'admin' ? 'Admin' : 'Member',
                            style: TextStyle(
                              color: role == 'admin'
                                  ? Colors.deepPurpleAccent
                                  : Colors.grey,
                              fontSize: 12,
                            ),
                          ),
                          trailing: canRemove
                              ? IconButton(
                                  icon: const Icon(
                                    Icons.remove_circle_outline,
                                    color: Colors.red,
                                  ),
                                  onPressed: () async {
                                    try {
                                      await apiService.removeRoomMember(
                                        widget.room.id,
                                        memberId,
                                      );
                                      if (context.mounted) {
                                        Navigator.pop(context);
                                        ScaffoldMessenger.of(this.context).showSnackBar(
                                          const SnackBar(content: Text('Member removed')),
                                        );
                                      }
                                    } catch (e) {
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(this.context).showSnackBar(
                                          SnackBar(
                                            content: Text('Failed: ${e.toString()}'),
                                            backgroundColor: Colors.red,
                                          ),
                                        );
                                      }
                                    }
                                  },
                                )
                              : null,
                        );
                      },
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }

  void _showAddMemberDialog() {
    final apiService = ref.read(apiServiceProvider);
    final searchController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            title: const Text('Add Member'),
            content: SizedBox(
              width: double.maxFinite,
              height: 400,
              child: Column(
                children: [
                  TextField(
                    controller: searchController,
                    decoration: const InputDecoration(
                      labelText: 'Search users',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (_) => setDialogState(() {}),
                  ),
                  const SizedBox(height: 16),
                  Expanded(
                    child: FutureBuilder<List<dynamic>>(
                      future: Future.wait([
                        apiService.getUsers(),
                        apiService.getRoomMembers(widget.room.id),
                      ]),
                      builder: (context, snapshot) {
                        if (snapshot.connectionState == ConnectionState.waiting) {
                          return const Center(child: CircularProgressIndicator());
                        }
                        if (snapshot.hasError) {
                          return Center(child: Text('Error: ${snapshot.error}'));
                        }

                        final allUsers = (snapshot.data![0] as List)
                            .map((u) => u as Map<String, dynamic>)
                            .toList();
                        final memberIds = (snapshot.data![1] as List)
                            .map((m) => (m as Map<String, dynamic>)['userId'] as String)
                            .toSet();
                        final search = searchController.text.toLowerCase();
                        final filtered = allUsers.where((u) {
                          final uid = u['id'] as String;
                          final uname = (u['username'] as String).toLowerCase();
                          return !memberIds.contains(uid) &&
                              (search.isEmpty || uname.contains(search));
                        }).toList();

                        if (filtered.isEmpty) {
                          return const Center(
                            child: Text('No users to add',
                                style: TextStyle(color: Colors.grey)),
                          );
                        }

                        return ListView.builder(
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final user = filtered[index];
                            final username = user['username'] as String;
                            final displayName = user['displayName'] as String?;

                            return ListTile(
                              leading: CircleAvatar(
                                backgroundColor: Colors.deepPurple,
                                child: Text(
                                  username[0].toUpperCase(),
                                  style: const TextStyle(color: Colors.white),
                                ),
                              ),
                              title: Text(displayName ?? username),
                              subtitle: displayName != null ? Text(username) : null,
                              trailing: ElevatedButton(
                                onPressed: () async {
                                  try {
                                    await apiService.addRoomMember(
                                      widget.room.id,
                                      user['id'] as String,
                                    );
                                    if (context.mounted) {
                                      Navigator.pop(context);
                                      ScaffoldMessenger.of(this.context).showSnackBar(
                                        SnackBar(content: Text('$username added')),
                                      );
                                    }
                                  } catch (e) {
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(this.context).showSnackBar(
                                        SnackBar(
                                          content: Text('Failed: ${e.toString()}'),
                                          backgroundColor: Colors.red,
                                        ),
                                      );
                                    }
                                  }
                                },
                                child: const Text('Add'),
                              ),
                            );
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Close'),
              ),
            ],
          );
        },
      ),
    );
  }

  void _leaveRoom() async {
    try {
      final apiService = ref.read(apiServiceProvider);
      await apiService.leaveRoom(widget.room.id);
      if (mounted) {
        Navigator.pop(context, true); // true = refresh room list
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to leave: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _deleteRoom() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Room'),
        content: const Text('Are you sure? This cannot be undone.'),
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

    if (confirmed == true) {
      try {
        final apiService = ref.read(apiServiceProvider);
        await apiService.deleteRoom(widget.room.id);
        if (mounted) {
          Navigator.pop(context, true);
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to delete: ${e.toString()}'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _typingTimer?.cancel();

    // Leave room
    final socketService = ref.read(socketServiceProvider);
    socketService.leaveRoom(widget.room.id);
    socketService.off('new_message');
    socketService.off('message_edited');
    socketService.off('message_deleted');
    socketService.off('user_typing');
    socketService.off('reaction_added');
    socketService.off('reaction_removed');
    socketService.off('message_pinned');
    socketService.off('message_unpinned');

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authNotifier = ref.watch(authProvider);
    final currentUserId = authNotifier.currentUser?.id;
    final isAdmin = authNotifier.isAdmin;
    final isCreator = widget.room.creatorId == currentUserId;
    final canDelete = isCreator || isAdmin;
    final serverUrl = ref.read(apiServiceProvider).baseUrl;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.room.name),
            Text(
              widget.room.isPublic ? 'Public Room' : 'Private Room',
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.people),
            tooltip: 'Members',
            onPressed: _showMembersPanel,
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              switch (value) {
                case 'leave':
                  _leaveRoom();
                  break;
                case 'delete':
                  _deleteRoom();
                  break;
              }
            },
            itemBuilder: (context) => [
              if (!isCreator)
                const PopupMenuItem(
                  value: 'leave',
                  child: Row(
                    children: [
                      Icon(Icons.exit_to_app, color: Colors.orange),
                      SizedBox(width: 8),
                      Text('Leave Room'),
                    ],
                  ),
                ),
              if (canDelete)
                const PopupMenuItem(
                  value: 'delete',
                  child: Row(
                    children: [
                      Icon(Icons.delete, color: Colors.red),
                      SizedBox(width: 8),
                      Text('Delete Room', style: TextStyle(color: Colors.red)),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          // Pinned messages banner
          if (_messages.any((m) => m.isPinned))
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: Colors.amber.withValues(alpha: 0.15),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '📌 Pinned Messages',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Colors.amber,
                    ),
                  ),
                  const SizedBox(height: 4),
                  ..._messages.where((m) => m.isPinned).take(3).map((m) => Text(
                    '${m.user?.username ?? "?"}: ${m.content.length > 60 ? "${m.content.substring(0, 60)}..." : m.content}',
                    style: TextStyle(fontSize: 11, color: Colors.grey[400]),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  )),
                ],
              ),
            ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? const Center(
                        child: Text(
                          'No messages yet\nBe the first to send a message!',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey),
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        reverse: true,
                        padding: const EdgeInsets.all(16),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final message = _messages[index];
                          final isMe = message.userId == currentUserId;
                          final socketService = ref.read(socketServiceProvider);

                          return MessageBubble(
                            message: message,
                            isMe: isMe,
                            serverUrl: serverUrl,
                            isAdmin: isAdmin,
                            onReply: () {
                              setState(() => _replyingTo = message);
                            },
                            onPin: () {
                              socketService.pinMessage(message.id);
                            },
                            onUnpin: () {
                              socketService.unpinMessage(message.id);
                            },
                          );
                        },
                      ),
          ),
          // Typing indicator
          if (_typingUsers.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              alignment: Alignment.centerLeft,
              child: Text(
                _typingUsers.length == 1
                    ? '${_typingUsers.first} is typing...'
                    : '${_typingUsers.join(", ")} are typing...',
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.grey,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
          // Reply preview bar
          if (_replyingTo != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: const Color(0xFF2C2C2C),
              child: Row(
                children: [
                  Container(
                    width: 3,
                    height: 36,
                    color: Colors.deepPurpleAccent,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Replying to ${_replyingTo!.user?.username ?? "?"}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Colors.deepPurpleAccent,
                          ),
                        ),
                        Text(
                          _replyingTo!.content.length > 80
                              ? '${_replyingTo!.content.substring(0, 80)}...'
                              : _replyingTo!.content,
                          style: TextStyle(fontSize: 11, color: Colors.grey[400]),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: () => setState(() => _replyingTo = null),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
            ),
          MessageInput(
            onSendMessage: _sendMessage,
            onSendFile: _sendFileMessage,
            onTyping: _onTypingChanged,
          ),
        ],
      ),
    );
  }
}
