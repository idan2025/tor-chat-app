import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_sodium/flutter_sodium.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class CryptoService {
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  // Generate keypair for E2EE
  Future<Map<String, String>> generateKeypair() async {
    await Sodium.init();

    final keyPair = CryptoBox.generateKeyPair();

    final publicKey = base64.encode(keyPair.pk);
    final secretKey = base64.encode(keyPair.sk);

    // Store secret key securely
    await _secureStorage.write(key: 'user_secret_key', value: secretKey);

    return {
      'publicKey': publicKey,
      'secretKey': secretKey,
    };
  }

  // Get stored keypair
  Future<Map<String, String>?> getKeypair() async {
    final secretKey = await _secureStorage.read(key: 'user_secret_key');
    final publicKey = await _secureStorage.read(key: 'user_public_key');

    if (secretKey == null || publicKey == null) return null;

    return {
      'publicKey': publicKey,
      'secretKey': secretKey,
    };
  }

  // Store public key
  Future<void> storePublicKey(String publicKey) async {
    await _secureStorage.write(key: 'user_public_key', value: publicKey);
  }

  // Generate room encryption key (symmetric)
  String generateRoomKey() {
    final key = SecretBox.generateKey();
    return base64.encode(key);
  }

  // Encrypt room message (symmetric encryption)
  String encryptRoomMessage(String message, String roomKey) {
    final keyBytes = base64.decode(roomKey);
    final messageBytes = utf8.encode(message);

    final nonce = SecretBox.generateNonce();
    final cipher = SecretBox.encrypt(messageBytes, nonce, keyBytes);

    // Combine nonce + ciphertext
    final combined = Uint8List.fromList([...nonce, ...cipher]);
    return base64.encode(combined);
  }

  // Decrypt room message (symmetric decryption)
  String decryptRoomMessage(String encrypted, String roomKey) {
    final keyBytes = base64.decode(roomKey);
    final combined = base64.decode(encrypted);

    // Extract nonce and ciphertext
    final nonce = combined.sublist(0, SecretBox.nonceLength);
    final cipher = combined.sublist(SecretBox.nonceLength);

    final decrypted = SecretBox.decrypt(cipher, nonce, keyBytes);
    return utf8.decode(decrypted);
  }

  // Encrypt direct message (asymmetric encryption)
  String encryptMessage(
    String message,
    String recipientPublicKey,
    String senderSecretKey,
  ) {
    final recipientPk = base64.decode(recipientPublicKey);
    final senderSk = base64.decode(senderSecretKey);
    final messageBytes = utf8.encode(message);

    final nonce = CryptoBox.generateNonce();
    final cipher = CryptoBox.encrypt(
      messageBytes,
      nonce,
      recipientPk,
      senderSk,
    );

    // Combine nonce + ciphertext
    final combined = Uint8List.fromList([...nonce, ...cipher]);
    return base64.encode(combined);
  }

  // Decrypt direct message (asymmetric decryption)
  String decryptMessage(
    String encrypted,
    String senderPublicKey,
    String recipientSecretKey,
  ) {
    final senderPk = base64.decode(senderPublicKey);
    final recipientSk = base64.decode(recipientSecretKey);
    final combined = base64.decode(encrypted);

    // Extract nonce and ciphertext
    final nonce = combined.sublist(0, CryptoBox.nonceLength);
    final cipher = combined.sublist(CryptoBox.nonceLength);

    final decrypted = CryptoBox.decrypt(
      cipher,
      nonce,
      senderPk,
      recipientSk,
    );
    return utf8.decode(decrypted);
  }

  // Hash password (for client-side verification if needed)
  String hashPassword(String password) {
    // Note: Password hashing should be done server-side with bcrypt
    // This is just for local verification if needed
    final hash = PasswordHash.hash(
      utf8.encode(password),
      PasswordHash.moderateOpsLimit,
      PasswordHash.moderateMemLimit,
    );
    return base64.encode(hash);
  }

  // Verify password hash
  bool verifyPassword(String password, String hash) {
    try {
      final passwordBytes = utf8.encode(password);
      final hashBytes = base64.decode(hash);
      return PasswordHash.verify(passwordBytes, hashBytes);
    } catch (e) {
      return false;
    }
  }

  // Clear stored keys
  Future<void> clearKeys() async {
    await _secureStorage.delete(key: 'user_secret_key');
    await _secureStorage.delete(key: 'user_public_key');
  }
}

// Riverpod provider
final cryptoServiceProvider = Provider<CryptoService>((ref) {
  return CryptoService();
});
