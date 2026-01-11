import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tor_chat/services/file_service.dart';

class MessageInput extends ConsumerStatefulWidget {
  final Function(String) onSendMessage;
  final Function(String)? onSendFile;
  final Function(bool)? onTyping;

  const MessageInput({
    super.key,
    required this.onSendMessage,
    this.onSendFile,
    this.onTyping,
  });

  @override
  ConsumerState<MessageInput> createState() => _MessageInputState();
}

class _MessageInputState extends ConsumerState<MessageInput> {
  final _controller = TextEditingController();
  bool _isTyping = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _sendMessage() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    widget.onSendMessage(text);
    _controller.clear();
    _setTyping(false);
  }

  void _setTyping(bool typing) {
    if (_isTyping != typing) {
      _isTyping = typing;
      widget.onTyping?.call(typing);
    }
  }

  Future<void> _pickFile() async {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.image),
              title: const Text('Image from Gallery'),
              onTap: () async {
                Navigator.pop(context);
                await _uploadImage(fromCamera: false);
              },
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Take Photo'),
              onTap: () async {
                Navigator.pop(context);
                await _uploadImage(fromCamera: true);
              },
            ),
            ListTile(
              leading: const Icon(Icons.videocam),
              title: const Text('Video'),
              onTap: () async {
                Navigator.pop(context);
                await _uploadVideo();
              },
            ),
            ListTile(
              leading: const Icon(Icons.insert_drive_file),
              title: const Text('Document'),
              onTap: () async {
                Navigator.pop(context);
                await _uploadDocument();
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _uploadImage({required bool fromCamera}) async {
    try {
      final fileService = ref.read(fileServiceProvider);
      final file = fromCamera
          ? await fileService.pickImageFromCamera()
          : await fileService.pickImageFromGallery();

      if (file == null) return;

      if (mounted) {
        _showUploadingDialog();
      }

      final result = await fileService.uploadFile(file);
      final fileUrl = result['file']['url'] as String;

      if (mounted) {
        Navigator.pop(context); // Close uploading dialog
        widget.onSendFile?.call(fileUrl);
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context); // Close uploading dialog
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Upload failed: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _uploadVideo() async {
    try {
      final fileService = ref.read(fileServiceProvider);
      final file = await fileService.pickVideo();

      if (file == null) return;

      if (mounted) {
        _showUploadingDialog();
      }

      final result = await fileService.uploadFile(file);
      final fileUrl = result['file']['url'] as String;

      if (mounted) {
        Navigator.pop(context);
        widget.onSendFile?.call(fileUrl);
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Upload failed: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _uploadDocument() async {
    try {
      final fileService = ref.read(fileServiceProvider);
      final file = await fileService.pickFile(
        allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'],
      );

      if (file == null) return;

      if (mounted) {
        _showUploadingDialog();
      }

      final result = await fileService.uploadFile(file);
      final fileUrl = result['file']['url'] as String;

      if (mounted) {
        Navigator.pop(context);
        widget.onSendFile?.call(fileUrl);
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Upload failed: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _showUploadingDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const AlertDialog(
        content: Row(
          children: [
            CircularProgressIndicator(),
            SizedBox(width: 16),
            Text('Uploading...'),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: Color(0xFF1E1E1E),
        border: Border(
          top: BorderSide(color: Colors.grey, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.attach_file),
            onPressed: _pickFile,
          ),
          Expanded(
            child: TextField(
              controller: _controller,
              decoration: const InputDecoration(
                hintText: 'Type a message...',
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(horizontal: 16),
              ),
              textInputAction: TextInputAction.send,
              onChanged: (text) {
                _setTyping(text.isNotEmpty);
              },
              onSubmitted: (_) => _sendMessage(),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.send),
            color: Colors.deepPurple,
            onPressed: _sendMessage,
          ),
        ],
      ),
    );
  }
}
