import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum UpdateType { version, patch, none }

class UpdateInfo {
  final String latestVersion;
  final String currentVersion;
  final String downloadUrl;
  final String releaseNotes;
  final bool updateAvailable;
  final UpdateType updateType;

  UpdateInfo({
    required this.latestVersion,
    required this.currentVersion,
    required this.downloadUrl,
    required this.releaseNotes,
    required this.updateAvailable,
    this.updateType = UpdateType.none,
  });
}

class UpdateService extends ChangeNotifier {
  static const _channel = MethodChannel('com.torchat.app/installer');
  static const _githubOwner = 'idan2025';
  static const _githubRepo = 'tor-chat-app';

  // SharedPreferences keys for asset fingerprinting
  static const _keyAssetId = 'update_last_asset_id';
  static const _keyAssetUpdatedAt = 'update_last_asset_updated_at';
  static const _keyAssetSize = 'update_last_asset_size';
  static const _keyAssetVersion = 'update_last_asset_version';

  final Dio _dio = Dio();

  // Transient state from the latest API fetch (used between check and download)
  int _lastFetchedAssetId = 0;
  String _lastFetchedAssetUpdatedAt = '';
  int _lastFetchedAssetSize = 0;
  String _lastFetchedAssetVersion = '';

  UpdateInfo? _updateInfo;
  double _downloadProgress = 0;
  bool _isDownloading = false;
  bool _isChecking = false;
  String? _error;

  UpdateInfo? get updateInfo => _updateInfo;
  double get downloadProgress => _downloadProgress;
  bool get isDownloading => _isDownloading;
  bool get isChecking => _isChecking;
  String? get error => _error;

  Future<UpdateInfo?> checkForUpdate() async {
    _isChecking = true;
    _error = null;
    notifyListeners();

    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = packageInfo.version;

      final response = await _dio.get(
        'https://api.github.com/repos/$_githubOwner/$_githubRepo/releases/latest',
        options: Options(headers: {'Accept': 'application/vnd.github.v3+json'}),
      );

      if (response.statusCode != 200) {
        _isChecking = false;
        notifyListeners();
        return null;
      }

      final data = response.data as Map<String, dynamic>;
      final tagName = data['tag_name'] as String? ?? '';
      final latestVersion = tagName.startsWith('v') ? tagName.substring(1) : tagName;
      final body = data['body'] as String? ?? '';

      // Find APK asset and extract metadata
      String downloadUrl = '';
      int assetId = 0;
      String assetUpdatedAt = '';
      int assetSize = 0;
      final assets = data['assets'] as List<dynamic>? ?? [];
      for (final asset in assets) {
        final name = (asset['name'] as String? ?? '').toLowerCase();
        if (name.endsWith('.apk')) {
          downloadUrl = asset['browser_download_url'] as String? ?? '';
          assetId = asset['id'] as int? ?? 0;
          assetUpdatedAt = asset['updated_at'] as String? ?? '';
          assetSize = asset['size'] as int? ?? 0;
          break;
        }
      }

      // Store fetched asset metadata for later use in downloadAndInstall
      _lastFetchedAssetId = assetId;
      _lastFetchedAssetUpdatedAt = assetUpdatedAt;
      _lastFetchedAssetSize = assetSize;
      _lastFetchedAssetVersion = latestVersion;

      // Determine update type
      UpdateType updateType = UpdateType.none;
      bool updateAvailable = false;

      if (_isNewer(latestVersion, currentVersion)) {
        updateType = UpdateType.version;
        updateAvailable = true;
      } else if (assetId > 0) {
        final patchAvailable = await _isAssetChanged(
          assetId, assetUpdatedAt, assetSize, latestVersion,
        );
        if (patchAvailable) {
          updateType = UpdateType.patch;
          updateAvailable = true;
        }
      }

      _updateInfo = UpdateInfo(
        latestVersion: latestVersion,
        currentVersion: currentVersion,
        downloadUrl: downloadUrl,
        releaseNotes: body,
        updateAvailable: updateAvailable,
        updateType: updateType,
      );

      _isChecking = false;
      notifyListeners();
      return _updateInfo;
    } catch (e) {
      _error = 'Failed to check for updates: ${e.toString()}';
      _isChecking = false;
      notifyListeners();
      return null;
    }
  }

  /// Compare semantic versions. Returns true if latest > current.
  bool _isNewer(String latest, String current) {
    try {
      final latestParts = latest.split('.').map(int.parse).toList();
      final currentParts = current.split('.').map(int.parse).toList();

      // Pad shorter list with zeros
      while (latestParts.length < 3) latestParts.add(0);
      while (currentParts.length < 3) currentParts.add(0);

      for (int i = 0; i < 3; i++) {
        if (latestParts[i] > currentParts[i]) return true;
        if (latestParts[i] < currentParts[i]) return false;
      }
      return false;
    } catch (e) {
      // Fallback: simple string comparison
      return latest != current;
    }
  }

  /// Clean up any previously downloaded APKs from the updates directory.
  Future<void> cleanupOldUpdates() async {
    try {
      final dir = await getExternalStorageDirectory();
      if (dir == null) return;

      final updatesDir = Directory('${dir.path}/updates');
      if (await updatesDir.exists()) {
        await updatesDir.delete(recursive: true);
      }
    } catch (_) {
      // Cleanup is best-effort, don't propagate errors
    }
  }

  Future<void> downloadAndInstall() async {
    if (_updateInfo == null || _updateInfo!.downloadUrl.isEmpty) {
      _error = 'No download URL available';
      notifyListeners();
      return;
    }

    _isDownloading = true;
    _downloadProgress = 0;
    _error = null;
    notifyListeners();

    try {
      // Download to external files directory (accessible by FileProvider)
      final dir = await getExternalStorageDirectory();
      if (dir == null) {
        throw Exception('Cannot access storage');
      }

      final updatesDir = Directory('${dir.path}/updates');

      // Clean up any old APKs before downloading
      if (await updatesDir.exists()) {
        await updatesDir.delete(recursive: true);
      }
      await updatesDir.create(recursive: true);

      final filePath = '${updatesDir.path}/tor-chat-update.apk';

      await _dio.download(
        _updateInfo!.downloadUrl,
        filePath,
        onReceiveProgress: (received, total) {
          if (total > 0) {
            _downloadProgress = received / total;
            notifyListeners();
          }
        },
      );

      _isDownloading = false;
      _downloadProgress = 1.0;
      notifyListeners();

      // Persist asset fingerprint after successful download
      await _saveAssetInfo(
        _lastFetchedAssetId,
        _lastFetchedAssetUpdatedAt,
        _lastFetchedAssetSize,
        _lastFetchedAssetVersion,
      );

      // Trigger install via platform channel
      await _channel.invokeMethod('installApk', {'filePath': filePath});
    } catch (e) {
      _error = 'Download failed: ${e.toString()}';
      _isDownloading = false;
      notifyListeners();
    }
  }

  /// Check if the GitHub asset has changed since we last saved it.
  /// Returns false on first run (seeds current values) and when the stored
  /// version differs from the release version (prevents false positives after
  /// external upgrades like Play Store or sideload).
  Future<bool> _isAssetChanged(
    int assetId, String updatedAt, int size, String version,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    final storedAssetId = prefs.getInt(_keyAssetId);

    // First run — no stored data yet. Seed and return false.
    if (storedAssetId == null) {
      await _saveAssetInfo(assetId, updatedAt, size, version);
      return false;
    }

    final storedVersion = prefs.getString(_keyAssetVersion) ?? '';

    // If stored version doesn't match the current release version, the user
    // upgraded externally. Re-seed to avoid a false patch prompt.
    if (storedVersion != version) {
      await _saveAssetInfo(assetId, updatedAt, size, version);
      return false;
    }

    // Same version — compare asset ID to detect re-uploaded APKs
    return assetId != storedAssetId;
  }

  /// Persist asset fingerprint info to SharedPreferences.
  Future<void> _saveAssetInfo(
    int assetId, String updatedAt, int size, String version,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_keyAssetId, assetId);
    await prefs.setString(_keyAssetUpdatedAt, updatedAt);
    await prefs.setInt(_keyAssetSize, size);
    await prefs.setString(_keyAssetVersion, version);
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}

final updateServiceProvider = ChangeNotifierProvider<UpdateService>((ref) {
  return UpdateService();
});
