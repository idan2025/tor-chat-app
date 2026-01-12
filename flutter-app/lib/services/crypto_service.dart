import 'dart:convert';
import 'dart:typed_data';
import 'package:cryptography/cryptography.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class CryptoService {
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  final _algorithm = X25519();
  final _aesCipher = AesCtr.with256bits(macAlgorithm: Hmac.sha256());

  // Generate keypair for E2EE
  Future<Map<String, String>> generateKeypair() async {
    final keyPair = await _algorithm.newKeyPair();
    final publicKey = await keyPair.extractPublicKey();

    final publicKeyBytes = publicKey.bytes;
    final secretKeyBytes = await keyPair.extractPrivateKeyBytes();

    final publicKeyStr = base64.encode(publicKeyBytes);
    final secretKeyStr = base64.encode(secretKeyBytes);

    // Store secret key securely
    await _secureStorage.write(key: 'user_secret_key', value: secretKeyStr);
    await _secureStorage.write(key: 'user_public_key', value: publicKeyStr);

    return {
      'publicKey': publicKeyStr,
      'secretKey': secretKeyStr,
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
    final key = SecretKey.randomBytes(32);
    return base64.encode(key.bytes);
  }

  // Encrypt room message (symmetric encryption)
  Future<String> encryptRoomMessage(String message, String roomKey) async {
    final keyBytes = base64.decode(roomKey);
    final messageBytes = utf8.encode(message);

    final secretKey = SecretKey(keyBytes);
    final secretBox = await _aesCipher.encrypt(
      messageBytes,
      secretKey: secretKey,
    );

    // Combine nonce + ciphertext + mac
    final combined = Uint8List.fromList([
      ...secretBox.nonce,
      ...secretBox.cipherText,
      ...secretBox.mac.bytes,
    ]);
    return base64.encode(combined);
  }

  // Decrypt room message (symmetric decryption)
  Future<String> decryptRoomMessage(String encrypted, String roomKey) async {
    final keyBytes = base64.decode(roomKey);
    final combined = base64.decode(encrypted);

    // Extract nonce (16 bytes), ciphertext, and mac (32 bytes)
    final nonce = combined.sublist(0, 16);
    final mac = Mac(combined.sublist(combined.length - 32));
    final cipherText = combined.sublist(16, combined.length - 32);

    final secretKey = SecretKey(keyBytes);
    final secretBox = SecretBox(cipherText, nonce: nonce, mac: mac);

    final decrypted = await _aesCipher.decrypt(
      secretBox,
      secretKey: secretKey,
    );
    return utf8.decode(decrypted);
  }

  // Encrypt direct message (asymmetric encryption)
  Future<String> encryptMessage(
    String message,
    String recipientPublicKey,
    String senderSecretKey,
  ) async {
    final recipientPk = SimplePublicKey(
      base64.decode(recipientPublicKey),
      type: KeyPairType.x25519,
    );
    final senderSk = SimpleKeyPairData(
      base64.decode(senderSecretKey),
      publicKey: SimplePublicKey([], type: KeyPairType.x25519),
      type: KeyPairType.x25519,
    );
    final messageBytes = utf8.encode(message);

    // Derive shared secret for encryption
    final sharedSecret = await _algorithm.sharedSecretKey(
      keyPair: senderSk,
      remotePublicKey: recipientPk,
    );

    final secretBox = await _aesCipher.encrypt(
      messageBytes,
      secretKey: sharedSecret,
    );

    // Combine nonce + ciphertext + mac
    final combined = Uint8List.fromList([
      ...secretBox.nonce,
      ...secretBox.cipherText,
      ...secretBox.mac.bytes,
    ]);
    return base64.encode(combined);
  }

  // Decrypt direct message (asymmetric decryption)
  Future<String> decryptMessage(
    String encrypted,
    String senderPublicKey,
    String recipientSecretKey,
  ) async {
    final senderPk = SimplePublicKey(
      base64.decode(senderPublicKey),
      type: KeyPairType.x25519,
    );
    final recipientSk = SimpleKeyPairData(
      base64.decode(recipientSecretKey),
      publicKey: SimplePublicKey([], type: KeyPairType.x25519),
      type: KeyPairType.x25519,
    );
    final combined = base64.decode(encrypted);

    // Extract nonce (16 bytes), ciphertext, and mac (32 bytes)
    final nonce = combined.sublist(0, 16);
    final mac = Mac(combined.sublist(combined.length - 32));
    final cipherText = combined.sublist(16, combined.length - 32);

    // Derive shared secret for decryption
    final sharedSecret = await _algorithm.sharedSecretKey(
      keyPair: recipientSk,
      remotePublicKey: senderPk,
    );

    final secretBox = SecretBox(cipherText, nonce: nonce, mac: mac);
    final decrypted = await _aesCipher.decrypt(
      secretBox,
      secretKey: sharedSecret,
    );
    return utf8.decode(decrypted);
  }

  // Hash password (for client-side verification if needed)
  Future<String> hashPassword(String password) async {
    // Note: Password hashing should be done server-side with bcrypt
    // This is just for local verification if needed
    final algorithm = Argon2id(
      memory: 65536, // 64 MB
      iterations: 3,
      parallelism: 4,
    );
    final hash = await algorithm.deriveKey(
      secretKey: SecretKey(utf8.encode(password)),
      nonce: List<int>.filled(16, 0), // In production, use random nonce
    );
    return base64.encode(await hash.extractBytes());
  }

  // Verify password hash
  Future<bool> verifyPassword(String password, String hash) async {
    try {
      final computed = await hashPassword(password);
      return computed == hash;
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
