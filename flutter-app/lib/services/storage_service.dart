import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

class StorageService {
  Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'tor_chat.db');

    return await openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    // Create tables
    await db.execute('''
      CREATE TABLE cached_messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT NOT NULL,
        reply_to TEXT,
        forwarded_from TEXT,
        reactions TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        user_data TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE cached_rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_public INTEGER NOT NULL,
        creator_id TEXT NOT NULL,
        max_members INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        last_message_at TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE cached_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        display_name TEXT,
        avatar TEXT,
        public_key TEXT,
        is_online INTEGER NOT NULL,
        last_seen TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE room_keys (
        room_id TEXT PRIMARY KEY,
        encryption_key TEXT NOT NULL
      )
    ''');

    // Create indices
    await db.execute(
      'CREATE INDEX idx_messages_room ON cached_messages(room_id)',
    );
    await db.execute(
      'CREATE INDEX idx_messages_created ON cached_messages(created_at)',
    );
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    // Handle database migrations
  }

  // Cache message
  Future<void> cacheMessage(Map<String, dynamic> message) async {
    final db = await database;
    await db.insert(
      'cached_messages',
      message,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // Get cached messages for room
  Future<List<Map<String, dynamic>>> getCachedMessages(
    String roomId, {
    int limit = 50,
    int offset = 0,
  }) async {
    final db = await database;
    return await db.query(
      'cached_messages',
      where: 'room_id = ?',
      whereArgs: [roomId],
      orderBy: 'created_at DESC',
      limit: limit,
      offset: offset,
    );
  }

  // Delete cached messages for room
  Future<void> deleteCachedMessages(String roomId) async {
    final db = await database;
    await db.delete(
      'cached_messages',
      where: 'room_id = ?',
      whereArgs: [roomId],
    );
  }

  // Cache room
  Future<void> cacheRoom(Map<String, dynamic> room) async {
    final db = await database;
    await db.insert(
      'cached_rooms',
      room,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // Get cached rooms
  Future<List<Map<String, dynamic>>> getCachedRooms() async {
    final db = await database;
    return await db.query(
      'cached_rooms',
      orderBy: 'last_message_at DESC',
    );
  }

  // Delete cached room
  Future<void> deleteCachedRoom(String roomId) async {
    final db = await database;
    await db.delete(
      'cached_rooms',
      where: 'id = ?',
      whereArgs: [roomId],
    );
  }

  // Cache user
  Future<void> cacheUser(Map<String, dynamic> user) async {
    final db = await database;
    await db.insert(
      'cached_users',
      user,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // Get cached user
  Future<Map<String, dynamic>?> getCachedUser(String userId) async {
    final db = await database;
    final results = await db.query(
      'cached_users',
      where: 'id = ?',
      whereArgs: [userId],
      limit: 1,
    );
    return results.isNotEmpty ? results.first : null;
  }

  // Store room encryption key
  Future<void> storeRoomKey(String roomId, String key) async {
    final db = await database;
    await db.insert(
      'room_keys',
      {'room_id': roomId, 'encryption_key': key},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // Get room encryption key
  Future<String?> getRoomKey(String roomId) async {
    final db = await database;
    final results = await db.query(
      'room_keys',
      where: 'room_id = ?',
      whereArgs: [roomId],
      limit: 1,
    );
    return results.isNotEmpty ? results.first['encryption_key'] as String : null;
  }

  // Delete room key
  Future<void> deleteRoomKey(String roomId) async {
    final db = await database;
    await db.delete(
      'room_keys',
      where: 'room_id = ?',
      whereArgs: [roomId],
    );
  }

  // Clear all cache
  Future<void> clearAllCache() async {
    final db = await database;
    await db.delete('cached_messages');
    await db.delete('cached_rooms');
    await db.delete('cached_users');
  }

  // Clear all data (including keys)
  Future<void> clearAllData() async {
    final db = await database;
    await db.delete('cached_messages');
    await db.delete('cached_rooms');
    await db.delete('cached_users');
    await db.delete('room_keys');
  }

  // Close database
  Future<void> close() async {
    if (_database != null) {
      await _database!.close();
      _database = null;
    }
  }
}

// Riverpod provider
final storageServiceProvider = Provider<StorageService>((ref) {
  return StorageService();
});
