import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class NotificationService extends ChangeNotifier {
  final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();

  bool _isEnabled = true;
  bool _soundEnabled = true;
  bool _vibrationEnabled = true;
  bool _showPreview = true;

  bool get isEnabled => _isEnabled;
  bool get soundEnabled => _soundEnabled;
  bool get vibrationEnabled => _vibrationEnabled;
  bool get showPreview => _showPreview;

  NotificationService() {
    _initialize();
  }

  Future<void> _initialize() async {
    // Load settings
    await _loadSettings();

    // Android initialization
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');

    // iOS initialization
    const iosSettings = DarwinInitializationSettings(
      requestSoundPermission: true,
      requestBadgePermission: true,
      requestAlertPermission: true,
    );

    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _notifications.initialize(
      settings,
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    // Request permissions
    await _requestPermissions();
  }

  Future<void> _requestPermissions() async {
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      await _notifications
          .resolvePlatformSpecificImplementation<
              IOSFlutterLocalNotificationsPlugin>()
          ?.requestPermissions(
            alert: true,
            badge: true,
            sound: true,
          );
    } else if (defaultTargetPlatform == TargetPlatform.android) {
      await _notifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
    }
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    _isEnabled = prefs.getBool('notifications_enabled') ?? true;
    _soundEnabled = prefs.getBool('notifications_sound') ?? true;
    _vibrationEnabled = prefs.getBool('notifications_vibration') ?? true;
    _showPreview = prefs.getBool('notifications_preview') ?? true;
    notifyListeners();
  }

  Future<void> setEnabled(bool enabled) async {
    _isEnabled = enabled;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notifications_enabled', enabled);
    notifyListeners();
  }

  Future<void> setSoundEnabled(bool enabled) async {
    _soundEnabled = enabled;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notifications_sound', enabled);
    notifyListeners();
  }

  Future<void> setVibrationEnabled(bool enabled) async {
    _vibrationEnabled = enabled;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notifications_vibration', enabled);
    notifyListeners();
  }

  Future<void> setShowPreview(bool enabled) async {
    _showPreview = enabled;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notifications_preview', enabled);
    notifyListeners();
  }

  void _onNotificationTap(NotificationResponse response) {
    // Handle notification tap - navigate to appropriate screen
    debugPrint('Notification tapped: ${response.payload}');
  }

  // Show new message notification
  Future<void> showMessageNotification({
    required String roomName,
    required String senderName,
    required String message,
    String? roomId,
  }) async {
    if (!_isEnabled) return;

    final notificationId = DateTime.now().millisecondsSinceEpoch ~/ 1000;

    final androidDetails = AndroidNotificationDetails(
      'messages',
      'Messages',
      channelDescription: 'New message notifications',
      importance: Importance.high,
      priority: Priority.high,
      playSound: _soundEnabled,
      enableVibration: _vibrationEnabled,
      styleInformation: BigTextStyleInformation(
        _showPreview ? message : 'New message',
        htmlFormatBigText: false,
        contentTitle: '$senderName in $roomName',
      ),
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _notifications.show(
      notificationId,
      _showPreview ? '$senderName in $roomName' : 'New message',
      _showPreview ? message : 'You have a new message',
      details,
      payload: roomId,
    );
  }

  // Show room invite notification
  Future<void> showRoomInviteNotification({
    required String roomName,
    required String inviterName,
    String? roomId,
  }) async {
    if (!_isEnabled) return;

    final notificationId = DateTime.now().millisecondsSinceEpoch ~/ 1000;

    final androidDetails = AndroidNotificationDetails(
      'invites',
      'Room Invites',
      channelDescription: 'Room invitation notifications',
      importance: Importance.high,
      priority: Priority.high,
      playSound: _soundEnabled,
      enableVibration: _vibrationEnabled,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _notifications.show(
      notificationId,
      'Room Invitation',
      '$inviterName invited you to $roomName',
      details,
      payload: roomId,
    );
  }

  // Show general notification
  Future<void> showNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    if (!_isEnabled) return;

    final notificationId = DateTime.now().millisecondsSinceEpoch ~/ 1000;

    final androidDetails = AndroidNotificationDetails(
      'general',
      'General',
      channelDescription: 'General notifications',
      importance: Importance.defaultImportance,
      priority: Priority.defaultPriority,
      playSound: _soundEnabled,
      enableVibration: _vibrationEnabled,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _notifications.show(
      notificationId,
      title,
      body,
      details,
      payload: payload,
    );
  }

  // Cancel all notifications
  Future<void> cancelAll() async {
    await _notifications.cancelAll();
  }

  // Cancel specific notification
  Future<void> cancel(int id) async {
    await _notifications.cancel(id);
  }
}

// Riverpod provider
final notificationServiceProvider =
    ChangeNotifierProvider<NotificationService>((ref) {
  return NotificationService();
});
