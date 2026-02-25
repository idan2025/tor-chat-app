import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:tor_chat/models/message.dart';
import 'package:tor_chat/services/socket_service.dart';

class MessageBubble extends ConsumerStatefulWidget {
  final Message message;
  final bool isMe;
  final String serverUrl;
  final VoidCallback? onReply;
  final VoidCallback? onForward;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isMe,
    required this.serverUrl,
    this.onReply,
    this.onForward,
  });

  @override
  ConsumerState<MessageBubble> createState() => _MessageBubbleState();
}

class _MessageBubbleState extends ConsumerState<MessageBubble> {
  void _showMessageActions() {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.onReply != null)
              ListTile(
                leading: const Icon(Icons.reply),
                title: const Text('Reply'),
                onTap: () {
                  Navigator.pop(context);
                  widget.onReply?.call();
                },
              ),
            ListTile(
              leading: const Icon(Icons.emoji_emotions),
              title: const Text('Add Reaction'),
              onTap: () {
                Navigator.pop(context);
                _showReactionPicker();
              },
            ),
            if (widget.onForward != null)
              ListTile(
                leading: const Icon(Icons.forward),
                title: const Text('Forward'),
                onTap: () {
                  Navigator.pop(context);
                  widget.onForward?.call();
                },
              ),
            if (widget.isMe)
              ListTile(
                leading: const Icon(Icons.edit),
                title: const Text('Edit'),
                onTap: () {
                  Navigator.pop(context);
                  _editMessage();
                },
              ),
            if (widget.isMe)
              ListTile(
                leading: const Icon(Icons.delete, color: Colors.red),
                title: const Text('Delete', style: TextStyle(color: Colors.red)),
                onTap: () {
                  Navigator.pop(context);
                  _deleteMessage();
                },
              ),
          ],
        ),
      ),
    );
  }

  void _showReactionPicker() {
    final commonEmojis = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '🎉'];

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add Reaction'),
        content: Wrap(
          spacing: 12,
          runSpacing: 12,
          children: commonEmojis.map((emoji) {
            return InkWell(
              onTap: () {
                Navigator.pop(context);
                _addReaction(emoji);
              },
              child: Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                child: Text(emoji, style: const TextStyle(fontSize: 24)),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  void _addReaction(String emoji) {
    final socketService = ref.read(socketServiceProvider);
    socketService.addReaction(widget.message.id, emoji);
  }

  void _editMessage() {
    final controller = TextEditingController(text: widget.message.content);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit Message'),
        content: TextField(
          controller: controller,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'Enter new message...',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final socketService = ref.read(socketServiceProvider);
              socketService.editMessage(widget.message.id, controller.text);
              Navigator.pop(context);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _deleteMessage() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Message'),
        content: const Text('Are you sure you want to delete this message?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () {
              final socketService = ref.read(socketServiceProvider);
              socketService.deleteMessage(widget.message.id);
              Navigator.pop(context);
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime dateTime) {
    return DateFormat('HH:mm').format(dateTime);
  }

  /// Build the full URL for server-hosted files (e.g. /uploads/...)
  String _fullUrl(String path) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return '${widget.serverUrl}$path';
  }

  /// Extract YouTube video ID from a URL
  String? _extractYouTubeId(String text) {
    // youtu.be/VIDEO_ID
    final shortMatch = RegExp(r'youtu\.be/([a-zA-Z0-9_-]{11})').firstMatch(text);
    if (shortMatch != null) return shortMatch.group(1);

    // youtube.com/watch?v=VIDEO_ID
    final longMatch = RegExp(r'youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})').firstMatch(text);
    if (longMatch != null) return longMatch.group(1);

    // youtube.com/embed/VIDEO_ID
    final embedMatch = RegExp(r'youtube\.com/embed/([a-zA-Z0-9_-]{11})').firstMatch(text);
    if (embedMatch != null) return embedMatch.group(1);

    return null;
  }

  bool _isYouTubeUrl(String text) => _extractYouTubeId(text) != null;

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  /// Determine file type icon from URL/extension
  IconData _fileIcon(String url) {
    final lower = url.toLowerCase();
    if (lower.endsWith('.pdf')) return Icons.picture_as_pdf;
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) return Icons.description;
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return Icons.table_chart;
    if (lower.endsWith('.txt')) return Icons.text_snippet;
    if (lower.endsWith('.zip') || lower.endsWith('.gz') || lower.endsWith('.rar') || lower.endsWith('.7z')) return Icons.folder_zip;
    if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.avi')) return Icons.video_file;
    if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.flac') || lower.endsWith('.aac')) return Icons.audio_file;
    return Icons.insert_drive_file;
  }

  /// Extract display filename from URL path
  String _fileName(String url) {
    final segments = Uri.parse(url).pathSegments;
    if (segments.isNotEmpty) {
      final name = segments.last;
      // Strip timestamp-uuid prefix if present (e.g. "1234567890-uuid.jpg" -> show as-is)
      return name.length > 40 ? '${name.substring(0, 37)}...' : name;
    }
    return 'File';
  }

  Widget _buildImageContent() {
    final imageUrl = _fullUrl(widget.message.content);
    return GestureDetector(
      onTap: () => _showFullScreenImage(imageUrl),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 300, maxWidth: 280),
          child: CachedNetworkImage(
            imageUrl: imageUrl,
            fit: BoxFit.cover,
            placeholder: (context, url) => Container(
              height: 150,
              color: Colors.grey[800],
              child: const Center(
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
            errorWidget: (context, url, error) => Container(
              height: 80,
              color: Colors.grey[800],
              child: const Center(
                child: Icon(Icons.broken_image, color: Colors.grey, size: 40),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showFullScreenImage(String imageUrl) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.close, color: Colors.white),
              onPressed: () => Navigator.pop(context),
            ),
          ),
          body: Center(
            child: InteractiveViewer(
              child: CachedNetworkImage(
                imageUrl: imageUrl,
                fit: BoxFit.contain,
                placeholder: (context, url) =>
                    const CircularProgressIndicator(),
                errorWidget: (context, url, error) =>
                    const Icon(Icons.broken_image, color: Colors.grey, size: 64),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildYouTubeContent() {
    final videoId = _extractYouTubeId(widget.message.content)!;
    final thumbnailUrl = 'https://img.youtube.com/vi/$videoId/hqdefault.jpg';
    final videoUrl = 'https://www.youtube.com/watch?v=$videoId';

    return GestureDetector(
      onTap: () => _launchUrl(videoUrl),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 200, maxWidth: 280),
          child: Stack(
            alignment: Alignment.center,
            children: [
              CachedNetworkImage(
                imageUrl: thumbnailUrl,
                fit: BoxFit.cover,
                width: 280,
                height: 200,
                placeholder: (context, url) => Container(
                  height: 200,
                  color: Colors.grey[800],
                  child: const Center(
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
                errorWidget: (context, url, error) => Container(
                  height: 200,
                  color: Colors.grey[800],
                  child: const Center(
                    child: Icon(Icons.video_library, color: Colors.grey, size: 40),
                  ),
                ),
              ),
              Container(
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(30),
                ),
                padding: const EdgeInsets.all(12),
                child: const Icon(Icons.play_arrow, color: Colors.white, size: 36),
              ),
              Positioned(
                bottom: 8,
                left: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.red,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'YouTube',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVideoContent() {
    final fileUrl = _fullUrl(widget.message.content);
    return GestureDetector(
      onTap: () => _launchUrl(fileUrl),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.black26,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.video_file, color: Colors.blue, size: 32),
            const SizedBox(width: 8),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _fileName(widget.message.content),
                    style: const TextStyle(fontSize: 13),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const Text(
                    'Tap to open video',
                    style: TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFileContent() {
    final fileUrl = _fullUrl(widget.message.content);
    return GestureDetector(
      onTap: () => _launchUrl(fileUrl),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.black26,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(_fileIcon(widget.message.content), color: Colors.blue, size: 32),
            const SizedBox(width: 8),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _fileName(widget.message.content),
                    style: const TextStyle(fontSize: 13),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const Text(
                    'Tap to download',
                    style: TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextContent() {
    final content = widget.message.content;

    // Check if text contains a YouTube URL
    if (_isYouTubeUrl(content)) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildYouTubeContent(),
          const SizedBox(height: 4),
          Text(
            content,
            style: const TextStyle(
              fontSize: 13,
              color: Colors.lightBlueAccent,
              decoration: TextDecoration.underline,
            ),
          ),
        ],
      );
    }

    // Check if text looks like an image URL (e.g. pasted link to /uploads/...)
    if (_looksLikeImageUrl(content)) {
      return _buildImageContent();
    }

    return Text(
      content,
      style: const TextStyle(fontSize: 15),
    );
  }

  bool _looksLikeImageUrl(String text) {
    final lower = text.toLowerCase().trim();
    // Only match if the entire content is a single URL to an image
    if (lower.contains(' ') || lower.contains('\n')) return false;
    return (lower.startsWith('/uploads/') || lower.startsWith('http'))
        && (lower.endsWith('.jpg') || lower.endsWith('.jpeg')
            || lower.endsWith('.png') || lower.endsWith('.gif')
            || lower.endsWith('.webp') || lower.endsWith('.svg')
            || lower.endsWith('.bmp'));
  }

  Widget _buildMessageContent() {
    switch (widget.message.messageType) {
      case 'image':
        return _buildImageContent();
      case 'video':
        return _buildVideoContent();
      case 'file':
        return _buildFileContent();
      case 'text':
      default:
        return _buildTextContent();
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPress: _showMessageActions,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          mainAxisAlignment:
              widget.isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (!widget.isMe)
              CircleAvatar(
                radius: 16,
                backgroundColor: Colors.deepPurple,
                child: Text(
                  (widget.message.user != null && widget.message.user!.username.isNotEmpty)
                      ? widget.message.user!.username[0].toUpperCase()
                      : 'U',
                  style: const TextStyle(fontSize: 12),
                ),
              ),
            if (!widget.isMe) const SizedBox(width: 8),
            Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.7,
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 10,
              ),
              decoration: BoxDecoration(
                color: widget.isMe
                    ? Colors.deepPurple
                    : const Color(0xFF2C2C2C),
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(widget.isMe ? 16 : 4),
                  bottomRight: Radius.circular(widget.isMe ? 4 : 16),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!widget.isMe && widget.message.user != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        widget.message.user!.displayNameOrUsername,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                          color: Colors.deepPurpleAccent,
                        ),
                      ),
                    ),
                  if (widget.message.isForwarded)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.forward, size: 12, color: Colors.grey),
                          SizedBox(width: 4),
                          Text(
                            'Forwarded',
                            style: TextStyle(fontSize: 10, color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                  _buildMessageContent(),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _formatTime(widget.message.createdAt),
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.grey[400],
                        ),
                      ),
                      if (widget.message.isEdited) ...[
                        const SizedBox(width: 4),
                        Text(
                          'edited',
                          style: TextStyle(
                            fontSize: 10,
                            color: Colors.grey[400],
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (widget.message.hasReactions)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Wrap(
                        spacing: 4,
                        runSpacing: 4,
                        children: widget.message.reactions.entries.where((entry) {
                          return entry.value != null;
                        }).map((entry) {
                          final emoji = entry.key;
                          final value = entry.value;
                          final int count;
                          if (value is List) {
                            count = value.length;
                          } else if (value is int) {
                            count = value;
                          } else if (value is num) {
                            count = value.toInt();
                          } else {
                            count = 1;
                          }
                          return Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.black26,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(emoji, style: const TextStyle(fontSize: 12)),
                                const SizedBox(width: 2),
                                Text(
                                  count.toString(),
                                  style: const TextStyle(fontSize: 10),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
