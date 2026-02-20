import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:tor_chat/services/tor_service.dart' show TorService, torServiceProvider;

class SocketService extends ChangeNotifier {
  io.Socket? _socket;
  final TorService _torService;
  String? _token;
  String _serverUrl = 'http://localhost:3000';
  bool _isConnected = false;

  final Map<String, Function(dynamic)> _eventHandlers = {};

  bool get isConnected => _isConnected;

  SocketService(this._torService);

  void setServerUrl(String url) {
    _serverUrl = url;
  }

  void connect(String token) {
    if (_socket != null && _socket!.connected) {
      disconnect();
    }

    _token = token;

    // When on .onion, force long-polling (works through SOCKS5 via HttpOverrides).
    // Raw WebSocket transport doesn't go through HttpOverrides.
    final usePolling = TorService.isOnionUrl(_serverUrl);

    final optionBuilder = io.OptionBuilder()
        .setTransports(usePolling ? ['polling'] : ['websocket'])
        .enableAutoConnect()
        .enableReconnection()
        .setReconnectionAttempts(5)
        .setReconnectionDelay(1000);

    final options = optionBuilder.build();

    _socket = io.io(_serverUrl, options);

    // Connection events
    _socket!.onConnect((_) {
      _isConnected = true;
      debugPrint('Socket connected');

      // Authenticate
      _socket!.emit('authenticate', {'token': _token});
      notifyListeners();
    });

    _socket!.onDisconnect((_) {
      _isConnected = false;
      debugPrint('Socket disconnected');
      notifyListeners();
    });

    _socket!.onConnectError((error) {
      debugPrint('Socket connection error: $error');
      _isConnected = false;
      notifyListeners();
    });

    _socket!.onError((error) {
      debugPrint('Socket error: $error');
    });

    // Register standard event handlers
    _registerStandardHandlers();
  }

  void _registerStandardHandlers() {
    _socket!.on('authenticated', (data) {
      debugPrint('Authenticated: $data');
      _callHandler('authenticated', data);
    });

    _socket!.on('error', (data) {
      debugPrint('Server error: $data');
      _callHandler('error', data);
    });

    _socket!.on('new_message', (data) {
      _callHandler('new_message', data);
    });

    _socket!.on('message_edited', (data) {
      _callHandler('message_edited', data);
    });

    _socket!.on('message_deleted', (data) {
      _callHandler('message_deleted', data);
    });

    _socket!.on('reaction_added', (data) {
      _callHandler('reaction_added', data);
    });

    _socket!.on('reaction_removed', (data) {
      _callHandler('reaction_removed', data);
    });

    _socket!.on('user_typing', (data) {
      _callHandler('user_typing', data);
    });

    _socket!.on('user_online', (data) {
      _callHandler('user_online', data);
    });

    _socket!.on('user_offline', (data) {
      _callHandler('user_offline', data);
    });

    _socket!.on('member_joined', (data) {
      _callHandler('member_joined', data);
    });

    _socket!.on('member_left', (data) {
      _callHandler('member_left', data);
    });

    _socket!.on('member_removed', (data) {
      _callHandler('member_removed', data);
    });

    _socket!.on('room_created', (data) {
      _callHandler('room_created', data);
    });

    _socket!.on('room_deleted', (data) {
      _callHandler('room_deleted', data);
    });

    _socket!.on('user_banned', (data) {
      _callHandler('user_banned', data);
    });

    _socket!.on('message_read', (data) {
      _callHandler('message_read', data);
    });
  }

  void _callHandler(String event, dynamic data) {
    if (_eventHandlers.containsKey(event)) {
      _eventHandlers[event]!(data);
    }
  }

  // Register custom event handler
  void on(String event, Function(dynamic) handler) {
    _eventHandlers[event] = handler;
  }

  // Remove event handler
  void off(String event) {
    _eventHandlers.remove(event);
  }

  // Emit events
  void joinRoom(String roomId) {
    if (_socket == null || !_socket!.connected) return;
    _socket!.emit('join_room', {'roomId': roomId});
  }

  void leaveRoom(String roomId) {
    if (_socket == null || !_socket!.connected) return;
    _socket!.emit('leave_room', {'roomId': roomId});
  }

  void sendMessage({
    required String roomId,
    required String content,
    String messageType = 'text',
    String? replyTo,
    Map<String, dynamic>? metadata,
  }) {
    if (_socket == null || !_socket!.connected) return;
    _socket!.emit('send_message', {
      'roomId': roomId,
      'content': content,
      'messageType': messageType,
      'replyTo': replyTo,
      'metadata': metadata,
    });
  }

  void sendTyping(String roomId, bool typing) {
    if (_socket == null || !_socket!.connected) return;
    _socket!.emit('typing', {
      'roomId': roomId,
      'typing': typing,
    });
  }

  void addReaction(String messageId, String emoji) {
    if (_socket == null || !_socket!.connected) return;
    _socket!.emit('add_reaction', {
      'messageId': messageId,
      'emoji': emoji,
    });
  }

  void removeReaction(String messageId, String emoji) {
    if (_socket == null || !_socket!.connected) return;
    _socket!.emit('remove_reaction', {
      'messageId': messageId,
      'emoji': emoji,
    });
  }

  void editMessage(String messageId, String content) {
    if (_socket == null || !_socket!.connected) return;
    _socket!.emit('edit_message', {
      'messageId': messageId,
      'content': content,
    });
  }

  void deleteMessage(String messageId) {
    if (_socket == null || !_socket!.connected) return;
    _socket!.emit('delete_message', {
      'messageId': messageId,
    });
  }

  void markRead(String roomId, String messageId) {
    if (_socket == null || !_socket!.connected) return;
    _socket!.emit('mark_read', {
      'roomId': roomId,
      'messageId': messageId,
    });
  }

  void forwardMessage(String messageId, String targetRoomId) {
    if (_socket == null || !_socket!.connected) return;
    _socket!.emit('forward_message', {
      'messageId': messageId,
      'targetRoomId': targetRoomId,
    });
  }

  void disconnect() {
    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
      _isConnected = false;
      _eventHandlers.clear();
      notifyListeners();
    }
  }

  @override
  void dispose() {
    disconnect();
    super.dispose();
  }
}

// Riverpod provider
final socketServiceProvider = ChangeNotifierProvider<SocketService>((ref) {
  final torService = ref.watch(torServiceProvider);
  return SocketService(torService);
});
