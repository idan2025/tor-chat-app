import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:tor_chat/services/api_service.dart';

class FileService {
  final ApiService _apiService;
  final ImagePicker _imagePicker = ImagePicker();

  FileService(this._apiService);

  // Pick image from gallery
  Future<File?> pickImageFromGallery() async {
    final XFile? image = await _imagePicker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1920,
      maxHeight: 1920,
      imageQuality: 85,
    );

    return image != null ? File(image.path) : null;
  }

  // Pick image from camera
  Future<File?> pickImageFromCamera() async {
    final XFile? image = await _imagePicker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1920,
      maxHeight: 1920,
      imageQuality: 85,
    );

    return image != null ? File(image.path) : null;
  }

  // Pick video
  Future<File?> pickVideo() async {
    final XFile? video = await _imagePicker.pickVideo(
      source: ImageSource.gallery,
      maxDuration: const Duration(minutes: 5),
    );

    return video != null ? File(video.path) : null;
  }

  // Pick file
  Future<File?> pickFile({
    List<String>? allowedExtensions,
  }) async {
    final result = await FilePicker.platform.pickFiles(
      type: allowedExtensions != null
          ? FileType.custom
          : FileType.any,
      allowedExtensions: allowedExtensions,
      allowMultiple: false,
    );

    if (result != null && result.files.isNotEmpty) {
      return File(result.files.first.path!);
    }

    return null;
  }

  // Upload file
  Future<Map<String, dynamic>> uploadFile(File file) async {
    // Check file size (max 1GB)
    final fileSize = await file.length();
    if (fileSize > 1024 * 1024 * 1024) {
      throw Exception('File size exceeds 1GB limit');
    }

    return await _apiService.uploadFile(file.path);
  }

  // Download file
  Future<File> downloadFile(String url, String filename) async {
    // In production, implement actual file download
    final directory = await getApplicationDocumentsDirectory();
    final filePath = '${directory.path}/$filename';

    // This is a placeholder - actual implementation would use Dio to download
    // final response = await _dio.download(url, filePath);

    return File(filePath);
  }

  // Get file size
  Future<int> getFileSize(File file) async {
    return await file.length();
  }

  // Format file size
  String formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

  // Get file extension
  String getFileExtension(String filename) {
    return filename.split('.').last.toLowerCase();
  }

  // Check if file is image
  bool isImage(String filename) {
    final ext = getFileExtension(filename);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].contains(ext);
  }

  // Check if file is video
  bool isVideo(String filename) {
    final ext = getFileExtension(filename);
    return ['mp4', 'webm', 'ogg', 'mov', 'avi'].contains(ext);
  }

  // Check if file is document
  bool isDocument(String filename) {
    final ext = getFileExtension(filename);
    return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'].contains(ext);
  }

  // Clear cache
  Future<void> clearCache() async {
    final cacheDir = await getTemporaryDirectory();
    if (await cacheDir.exists()) {
      await cacheDir.delete(recursive: true);
      await cacheDir.create();
    }
  }
}

// Riverpod provider
final fileServiceProvider = Provider<FileService>((ref) {
  final apiService = ref.watch(apiServiceProvider);
  return FileService(apiService);
});
