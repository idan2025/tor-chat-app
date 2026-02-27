import 'package:tor_chat/models/user.dart';

class Message {
  final String id;
  final String roomId;
  final String userId;
  final String content;
  final String messageType;
  final String? replyTo;
  final String? forwardedFrom;
  final Map<String, dynamic> reactions;
  final Map<String, dynamic>? metadata;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final User? user;
  final String? pinnedBy;
  final DateTime? pinnedAt;
  final Map<String, dynamic>? replyMessage;

  Message({
    required this.id,
    required this.roomId,
    required this.userId,
    required this.content,
    this.messageType = 'text',
    this.replyTo,
    this.forwardedFrom,
    this.reactions = const {},
    this.metadata,
    required this.createdAt,
    this.updatedAt,
    this.user,
    this.pinnedBy,
    this.pinnedAt,
    this.replyMessage,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as String,
      roomId: json['roomId'] as String,
      userId: json['userId'] as String,
      content: json['content'] as String,
      messageType: json['messageType'] as String? ?? 'text',
      replyTo: json['replyTo'] as String?,
      forwardedFrom: json['forwardedFrom'] as String?,
      reactions: json['reactions'] as Map<String, dynamic>? ?? {},
      metadata: json['metadata'] as Map<String, dynamic>?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : null,
      user: json['user'] != null
          ? User.fromJson(json['user'] as Map<String, dynamic>)
          : null,
      pinnedBy: json['pinnedBy'] as String?,
      pinnedAt: json['pinnedAt'] != null
          ? DateTime.parse(json['pinnedAt'] as String)
          : null,
      replyMessage: json['replyMessage'] != null
          ? Map<String, dynamic>.from(json['replyMessage'] as Map)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'roomId': roomId,
      'userId': userId,
      'content': content,
      'messageType': messageType,
      'replyTo': replyTo,
      'forwardedFrom': forwardedFrom,
      'reactions': reactions,
      'metadata': metadata,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
      'user': user?.toJson(),
      'pinnedBy': pinnedBy,
      'pinnedAt': pinnedAt?.toIso8601String(),
      'replyMessage': replyMessage,
    };
  }

  Message copyWith({
    String? id,
    String? roomId,
    String? userId,
    String? content,
    String? messageType,
    String? replyTo,
    String? forwardedFrom,
    Map<String, dynamic>? reactions,
    Map<String, dynamic>? metadata,
    DateTime? createdAt,
    DateTime? updatedAt,
    User? user,
    String? pinnedBy,
    DateTime? pinnedAt,
    Map<String, dynamic>? replyMessage,
    bool clearPinned = false,
  }) {
    return Message(
      id: id ?? this.id,
      roomId: roomId ?? this.roomId,
      userId: userId ?? this.userId,
      content: content ?? this.content,
      messageType: messageType ?? this.messageType,
      replyTo: replyTo ?? this.replyTo,
      forwardedFrom: forwardedFrom ?? this.forwardedFrom,
      reactions: reactions ?? this.reactions,
      metadata: metadata ?? this.metadata,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      user: user ?? this.user,
      pinnedBy: clearPinned ? null : (pinnedBy ?? this.pinnedBy),
      pinnedAt: clearPinned ? null : (pinnedAt ?? this.pinnedAt),
      replyMessage: replyMessage ?? this.replyMessage,
    );
  }

  bool get isEdited => updatedAt != null;
  bool get isForwarded => forwardedFrom != null;
  bool get hasReactions => reactions.isNotEmpty;
  bool get isPinned => pinnedBy != null;

  bool get isText => messageType == 'text';
  bool get isImage => messageType == 'image';
  bool get isVideo => messageType == 'video';
  bool get isFile => messageType == 'file';
}
