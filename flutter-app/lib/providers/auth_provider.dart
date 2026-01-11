import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tor_chat/models/user.dart';
import 'package:tor_chat/services/api_service.dart';

class AuthState {
  final User? user;
  final bool isAuthenticated;
  final bool isLoading;
  final String? error;

  AuthState({
    this.user,
    this.isAuthenticated = false,
    this.isLoading = false,
    this.error,
  });

  AuthState copyWith({
    User? user,
    bool? isAuthenticated,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      user: user ?? this.user,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class AuthNotifier extends ChangeNotifier {
  final ApiService _apiService;
  AuthState _state = AuthState();

  AuthNotifier(this._apiService);

  AuthState get state => _state;
  User? get currentUser => _state.user;
  bool get isAuthenticated => _state.isAuthenticated;
  bool get isAdmin => _state.user?.isAdmin ?? false;

  void _setState(AuthState newState) {
    _state = newState;
    notifyListeners();
  }

  Future<void> checkAuth() async {
    _setState(_state.copyWith(isLoading: true));

    try {
      await _apiService.loadToken();
      final response = await _apiService.getMe();
      final user = User.fromJson(response['user']);

      _setState(AuthState(
        user: user,
        isAuthenticated: true,
        isLoading: false,
      ));
    } catch (e) {
      _setState(AuthState(
        isAuthenticated: false,
        isLoading: false,
        error: e.toString(),
      ));
    }
  }

  Future<void> login(String username, String password) async {
    _setState(_state.copyWith(isLoading: true));

    try {
      final response = await _apiService.login(
        username: username,
        password: password,
      );

      final token = response['token'] as String;
      await _apiService.setToken(token);

      final user = User.fromJson(response['user']);

      _setState(AuthState(
        user: user,
        isAuthenticated: true,
        isLoading: false,
      ));
    } catch (e) {
      _setState(AuthState(
        isAuthenticated: false,
        isLoading: false,
        error: e.toString(),
      ));
      rethrow;
    }
  }

  Future<void> register({
    required String username,
    required String email,
    required String password,
    String? displayName,
  }) async {
    _setState(_state.copyWith(isLoading: true));

    try {
      final response = await _apiService.register(
        username: username,
        email: email,
        password: password,
        displayName: displayName,
      );

      final token = response['token'] as String;
      await _apiService.setToken(token);

      final user = User.fromJson(response['user']);

      _setState(AuthState(
        user: user,
        isAuthenticated: true,
        isLoading: false,
      ));
    } catch (e) {
      _setState(AuthState(
        isAuthenticated: false,
        isLoading: false,
        error: e.toString(),
      ));
      rethrow;
    }
  }

  Future<void> logout() async {
    try {
      await _apiService.logout();
    } catch (e) {
      debugPrint('Logout error: $e');
    } finally {
      _setState(AuthState(
        isAuthenticated: false,
        isLoading: false,
      ));
    }
  }

  Future<void> refreshUser() async {
    try {
      final response = await _apiService.getMe();
      final user = User.fromJson(response['user']);

      _setState(_state.copyWith(user: user));
    } catch (e) {
      debugPrint('Failed to refresh user: $e');
    }
  }
}

final authProvider = ChangeNotifierProvider<AuthNotifier>((ref) {
  final apiService = ref.watch(apiServiceProvider);
  return AuthNotifier(apiService);
});
