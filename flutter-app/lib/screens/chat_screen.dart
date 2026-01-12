import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tor_chat/models/message.dart';
import 'package:tor_chat/models/room.dart';
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
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  List<Message> _messages = [];
  bool _isLoading = true;
  String? _roomKey;

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
  }

  Future<void> _handleNewMessage(dynamic data) async {
    final message = Message.fromJson(data);

    // Decrypt message if encrypted
    if (_roomKey != null) {
      try {
        final cryptoService = ref.read(cryptoServiceProvider);
        final decryptedContent =
            await cryptoService.decryptRoomMessage(message.content, _roomKey!);
        final decryptedMessage = message.copyWith(content: decryptedContent);
        setState(() {
          _messages.insert(0, decryptedMessage);
        });
      } catch (e) {
        // If decryption fails, show encrypted message
        setState(() {
          _messages.insert(0, message);
        });
      }
    } else {
      setState(() {
        _messages.insert(0, message);
      });
    }

    _scrollToBottom();
  }

  void _handleMessageEdited(dynamic data) {
    final messageId = data['messageId'] as String;
    final content = data['content'] as String;

    setState(() {
      final index = _messages.indexWhere((m) => m.id == messageId);
      if (index != -1) {
        _messages[index] = _messages[index].copyWith(content: content);
      }
    });
  }

  void _handleMessageDeleted(dynamic data) {
    final messageId = data['messageId'] as String;

    setState(() {
      _messages.removeWhere((m) => m.id == messageId);
    });
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

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    _messageController.clear();

    // Encrypt message if room key exists
    String content = text;
    if (_roomKey != null) {
      final cryptoService = ref.read(cryptoServiceProvider);
      content = await cryptoService.encryptRoomMessage(text, _roomKey!);
    }

    // Send via socket
    final socketService = ref.read(socketServiceProvider);
    socketService.sendMessage(
      roomId: widget.room.id,
      content: content,
    );
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();

    // Leave room
    final socketService = ref.read(socketServiceProvider);
    socketService.leaveRoom(widget.room.id);
    socketService.off('new_message');
    socketService.off('message_edited');
    socketService.off('message_deleted');

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
      ),
      body: Column(
        children: [
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
                          // TODO: Implement proper user ID check when auth is integrated
                          final isMe = message.userId == 'current_user_id';

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Row(
                              mainAxisAlignment: isMe
                                  ? MainAxisAlignment.end
                                  : MainAxisAlignment.start,
                              children: [
                                Container(
                                  constraints: BoxConstraints(
                                    maxWidth:
                                        MediaQuery.of(context).size.width * 0.7,
                                  ),
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 10,
                                  ),
                                  decoration: BoxDecoration(
                                    color: isMe
                                        ? Colors.deepPurple
                                        : const Color(0xFF2C2C2C),
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      if (!isMe && message.user != null)
                                        Text(
                                          message.user!.displayNameOrUsername,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 12,
                                            color: Colors.deepPurpleAccent,
                                          ),
                                        ),
                                      const SizedBox(height: 4),
                                      Text(message.content),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Color(0xFF1E1E1E),
              border: Border(
                top: BorderSide(color: Colors.grey, width: 0.5),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    decoration: const InputDecoration(
                      hintText: 'Type a message...',
                      border: InputBorder.none,
                    ),
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.send),
                  onPressed: _sendMessage,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
