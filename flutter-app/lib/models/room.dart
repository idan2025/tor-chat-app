class Room {
  final String id;
  final String name;
  final String? description;
  final bool isPublic;
  final String creatorId;
  final String? roomKey;
  final int maxMembers;
  final DateTime createdAt;
  final int? memberCount;
  final int? messageCount;
  int unreadCount;

  Room({
    required this.id,
    required this.name,
    this.description,
    required this.isPublic,
    required this.creatorId,
    this.roomKey,
    this.maxMembers = 100,
    required this.createdAt,
    this.memberCount,
    this.messageCount,
    this.unreadCount = 0,
  });

  factory Room.fromJson(Map<String, dynamic> json) {
    return Room(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      isPublic: json['isPublic'] as bool,
      creatorId: json['creatorId'] as String,
      roomKey: json['roomKey'] as String?,
      maxMembers: json['maxMembers'] as int? ?? 100,
      createdAt: DateTime.parse(json['createdAt'] as String),
      memberCount: json['memberCount'] as int?,
      messageCount: json['messageCount'] as int?,
      unreadCount: json['unreadCount'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'isPublic': isPublic,
      'creatorId': creatorId,
      'roomKey': roomKey,
      'maxMembers': maxMembers,
      'createdAt': createdAt.toIso8601String(),
      'memberCount': memberCount,
      'messageCount': messageCount,
      'unreadCount': unreadCount,
    };
  }

  Room copyWith({
    String? id,
    String? name,
    String? description,
    bool? isPublic,
    String? creatorId,
    String? roomKey,
    int? maxMembers,
    DateTime? createdAt,
    int? memberCount,
    int? messageCount,
    int? unreadCount,
  }) {
    return Room(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      isPublic: isPublic ?? this.isPublic,
      creatorId: creatorId ?? this.creatorId,
      roomKey: roomKey ?? this.roomKey,
      maxMembers: maxMembers ?? this.maxMembers,
      createdAt: createdAt ?? this.createdAt,
      memberCount: memberCount ?? this.memberCount,
      messageCount: messageCount ?? this.messageCount,
      unreadCount: unreadCount ?? this.unreadCount,
    );
  }
}
