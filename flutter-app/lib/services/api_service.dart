import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socks_proxy/socks_client.dart';
import 'package:tor_chat/services/tor_service.dart';

class ApiService {
  late Dio _dio;
  final TorService _torService;
  String? _token;
  String _baseUrl = 'http://localhost:3000';

  ApiService(this._torService) {
    _initDio();
  }

  void _initDio() {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
      },
    ));

    // Add TOR proxy if enabled
    if (_torService.isEnabled) {
      final proxy = _torService.getSocksProxy();
      _dio.httpClientAdapter = IOHttpClientAdapter(
        createHttpClient: () {
          final client = HttpClient();
          client.findProxy = (uri) => proxy;
          return client;
        },
      );
    }

    // Add auth interceptor
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (_token != null) {
          options.headers['Authorization'] = 'Bearer $_token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Token expired, logout
          await logout();
        }
        return handler.next(error);
      },
    ));
  }

  // Set base URL
  void setBaseUrl(String url) {
    _baseUrl = url;
    _dio.options.baseUrl = url;
  }

  /// Configure Dio to route through a SOCKS5 proxy (for Tor)
  void enableTorProxy(int socksPort) {
    _dio.httpClientAdapter = IOHttpClientAdapter(
      createHttpClient: () {
        final client = HttpClient();
        SocksTCPClient.assignToHttpClient(client, [
          ProxySettings(InternetAddress.loopbackIPv4, socksPort),
        ]);
        return client;
      },
    );
  }

  /// Disable SOCKS5 proxy, revert to direct connections
  void disableTorProxy() {
    _dio.httpClientAdapter = IOHttpClientAdapter();
  }

  // Set auth token
  Future<void> setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token != null) {
      await prefs.setString('auth_token', token);
    } else {
      await prefs.remove('auth_token');
    }
  }

  // Load token from storage
  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
  }

  // Auth endpoints
  Future<Map<String, dynamic>> register({
    required String username,
    required String email,
    required String password,
    String? displayName,
  }) async {
    final response = await _dio.post('/api/auth/register', data: {
      'username': username,
      'email': email,
      'password': password,
      'displayName': displayName,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> login({
    required String username,
    required String password,
  }) async {
    final response = await _dio.post('/api/auth/login', data: {
      'username': username,
      'password': password,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> logout() async {
    final response = await _dio.post('/api/auth/logout');
    await setToken(null);
    return response.data;
  }

  Future<Map<String, dynamic>> getMe() async {
    final response = await _dio.get('/api/auth/me');
    return response.data;
  }

  Future<List<dynamic>> getUsers() async {
    final response = await _dio.get('/api/auth/users');
    return response.data['users'];
  }

  // Room endpoints
  Future<List<dynamic>> getRooms() async {
    final response = await _dio.get('/api/rooms');
    return response.data['rooms'];
  }

  Future<Map<String, dynamic>> createRoom({
    required String name,
    String? description,
    required bool isPublic,
    int? maxMembers,
  }) async {
    final response = await _dio.post('/api/rooms', data: {
      'name': name,
      'description': description,
      'isPublic': isPublic,
      'maxMembers': maxMembers ?? 100,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> getRoom(String roomId) async {
    final response = await _dio.get('/api/rooms/$roomId');
    return response.data;
  }

  Future<Map<String, dynamic>> joinRoom(String roomId) async {
    final response = await _dio.post('/api/rooms/$roomId/join');
    return response.data;
  }

  Future<Map<String, dynamic>> leaveRoom(String roomId) async {
    final response = await _dio.post('/api/rooms/$roomId/leave');
    return response.data;
  }

  Future<Map<String, dynamic>> deleteRoom(String roomId) async {
    final response = await _dio.delete('/api/rooms/$roomId');
    return response.data;
  }

  Future<List<dynamic>> getRoomMessages(
    String roomId, {
    int limit = 50,
    int offset = 0,
  }) async {
    final response = await _dio.get(
      '/api/rooms/$roomId/messages',
      queryParameters: {'limit': limit, 'offset': offset},
    );
    return response.data['messages'];
  }

  Future<List<dynamic>> getRoomMembers(String roomId) async {
    final response = await _dio.get('/api/rooms/$roomId/members');
    return response.data['members'];
  }

  Future<Map<String, dynamic>> addRoomMember(
    String roomId,
    String userId,
  ) async {
    final response = await _dio.post(
      '/api/rooms/$roomId/members',
      data: {'userId': userId},
    );
    return response.data;
  }

  Future<Map<String, dynamic>> removeRoomMember(
    String roomId,
    String userId,
  ) async {
    final response = await _dio.delete('/api/rooms/$roomId/members/$userId');
    return response.data;
  }

  Future<List<dynamic>> searchMessages(String roomId, String query) async {
    final response = await _dio.get(
      '/api/rooms/$roomId/search',
      queryParameters: {'q': query},
    );
    return response.data['messages'];
  }

  // Upload endpoint
  Future<Map<String, dynamic>> uploadFile(String filePath) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath),
    });
    final response = await _dio.post('/api/upload', data: formData);
    return response.data;
  }

  // TOR status
  Future<Map<String, dynamic>> getTorStatus() async {
    final response = await _dio.get('/api/tor-status');
    return response.data;
  }

  // Admin endpoints
  Future<List<dynamic>> adminGetUsers() async {
    final response = await _dio.get('/api/admin/users');
    return response.data['users'];
  }

  Future<Map<String, dynamic>> adminPromoteUser(String userId) async {
    final response = await _dio.post('/api/admin/users/$userId/promote');
    return response.data;
  }

  Future<Map<String, dynamic>> adminDemoteUser(String userId) async {
    final response = await _dio.post('/api/admin/users/$userId/demote');
    return response.data;
  }

  Future<Map<String, dynamic>> adminBanUser(String userId) async {
    final response = await _dio.post('/api/admin/users/$userId/ban');
    return response.data;
  }

  Future<Map<String, dynamic>> adminUnbanUser(String userId) async {
    final response = await _dio.post('/api/admin/users/$userId/unban');
    return response.data;
  }

  Future<Map<String, dynamic>> adminDeleteUser(String userId) async {
    final response = await _dio.delete('/api/admin/users/$userId');
    return response.data;
  }

  Future<List<dynamic>> adminGetRooms() async {
    final response = await _dio.get('/api/admin/rooms');
    return response.data['rooms'];
  }

  Future<Map<String, dynamic>> adminDeleteRoom(String roomId) async {
    final response = await _dio.delete('/api/admin/rooms/$roomId');
    return response.data;
  }

  Future<Map<String, dynamic>> adminGetStats() async {
    final response = await _dio.get('/api/admin/stats');
    return response.data;
  }
}

// Riverpod provider
final apiServiceProvider = Provider<ApiService>((ref) {
  final torService = ref.watch(torServiceProvider);
  return ApiService(torService);
});
