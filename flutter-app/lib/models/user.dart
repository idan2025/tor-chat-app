class User {
  final String id;
  final String username;
  final String? email;
  final String? displayName;
  final String? avatar;
  final String? publicKey;
  final bool isOnline;
  final DateTime? lastSeen;
  final bool isAdmin;
  final bool isBanned;
  final DateTime createdAt;

  User({
    required this.id,
    required this.username,
    this.email,
    this.displayName,
    this.avatar,
    this.publicKey,
    this.isOnline = false,
    this.lastSeen,
    this.isAdmin = false,
    this.isBanned = false,
    required this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      username: json['username'] as String,
      email: json['email'] as String?,
      displayName: json['displayName'] as String?,
      avatar: json['avatar'] as String?,
      publicKey: json['publicKey'] as String?,
      isOnline: json['isOnline'] as bool? ?? false,
      lastSeen: json['lastSeen'] != null
          ? DateTime.parse(json['lastSeen'] as String)
          : null,
      isAdmin: json['isAdmin'] as bool? ?? false,
      isBanned: json['isBanned'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'displayName': displayName,
      'avatar': avatar,
      'publicKey': publicKey,
      'isOnline': isOnline,
      'lastSeen': lastSeen?.toIso8601String(),
      'isAdmin': isAdmin,
      'isBanned': isBanned,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  User copyWith({
    String? id,
    String? username,
    String? email,
    String? displayName,
    String? avatar,
    String? publicKey,
    bool? isOnline,
    DateTime? lastSeen,
    bool? isAdmin,
    bool? isBanned,
    DateTime? createdAt,
  }) {
    return User(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      displayName: displayName ?? this.displayName,
      avatar: avatar ?? this.avatar,
      publicKey: publicKey ?? this.publicKey,
      isOnline: isOnline ?? this.isOnline,
      lastSeen: lastSeen ?? this.lastSeen,
      isAdmin: isAdmin ?? this.isAdmin,
      isBanned: isBanned ?? this.isBanned,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  String get displayNameOrUsername => displayName ?? username;
}
