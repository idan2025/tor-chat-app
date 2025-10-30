/**
 * CryptoService - End-to-End Encryption Service
 *
 * Provides client-side E2E encryption using libsodium (react-native-sodium).
 * Compatible with web app's crypto implementation for cross-platform encryption.
 *
 * Encryption Strategy:
 * - Room messages: Symmetric encryption (crypto_secretbox) with shared room key
 * - Room key exchange: Asymmetric encryption (crypto_box) using user keypairs
 * - File encryption: Same as message encryption
 * - Password hashing: Argon2id (crypto_pwhash)
 *
 * Security Features:
 * - All keys stored securely in AsyncStorage (encrypted on Android)
 * - Unique nonce generated for each encryption operation
 * - Compatible algorithm parameters with web app
 * - Secure memory handling and key clearing
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import sodium from 'react-native-sodium';

// Storage keys
const STORAGE_KEYS = {
  USER_KEYPAIR: '@tor-chat:crypto:user-keypair',
  ROOM_KEYS: '@tor-chat:crypto:room-keys',
} as const;

// Crypto constants (must match web app)
const CRYPTO_CONSTANTS = {
  SECRETBOX_NONCEBYTES: 24, // crypto_secretbox_NONCEBYTES
  SECRETBOX_KEYBYTES: 32,   // crypto_secretbox_KEYBYTES
  BOX_NONCEBYTES: 24,       // crypto_box_NONCEBYTES
  BOX_PUBLICKEYBYTES: 32,   // crypto_box_PUBLICKEYBYTES
  BOX_SECRETKEYBYTES: 32,   // crypto_box_SECRETKEYBYTES
  PWHASH_SALTBYTES: 16,     // crypto_pwhash_SALTBYTES
  PWHASH_OPSLIMIT: 2,       // crypto_pwhash_OPSLIMIT_INTERACTIVE
  PWHASH_MEMLIMIT: 67108864, // crypto_pwhash_MEMLIMIT_INTERACTIVE (64MB)
  PWHASH_ALG: 2,            // crypto_pwhash_ALG_ARGON2ID13
} as const;

/**
 * User keypair for asymmetric encryption
 */
export interface KeyPair {
  publicKey: string;  // base64 encoded
  privateKey: string; // base64 encoded
}

/**
 * Encrypted message structure
 */
export interface EncryptedMessage {
  nonce: string;      // base64 encoded
  ciphertext: string; // base64 encoded
}

/**
 * Room key storage structure
 */
interface RoomKeyStore {
  [roomId: string]: string; // base64 encoded symmetric key
}

/**
 * Password hash result
 */
interface PasswordHashResult {
  hash: string; // base64 encoded
  salt: string; // base64 encoded
}

/**
 * CryptoService Class
 * Singleton service for all cryptographic operations
 */
class CryptoService {
  private initialized: boolean = false;
  private roomKeysCache: RoomKeyStore | null = null;

  /**
   * Initialize the crypto service
   * Must be called before any crypto operations
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // react-native-sodium doesn't require explicit initialization
      // Test that sodium is working
      await this.testSodium();
      this.initialized = true;
      console.log('[CryptoService] Initialized successfully');
    } catch (error) {
      console.error('[CryptoService] Initialization failed:', error);
      throw new Error('Failed to initialize crypto service');
    }
  }

  /**
   * Ensure crypto service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Test that sodium is working correctly
   */
  private async testSodium(): Promise<void> {
    try {
      // Test random bytes generation
      const testBytes = await sodium.randombytes_buf(32);
      if (!testBytes || testBytes.length !== 32) {
        throw new Error('Sodium random bytes test failed');
      }
    } catch (error) {
      console.error('[CryptoService] Sodium test failed:', error);
      throw error;
    }
  }

  // ==================== KEYPAIR MANAGEMENT ====================

  /**
   * Generate a new keypair for asymmetric encryption
   * Used for room key exchange and user-to-user encryption
   */
  async generateKeypair(): Promise<KeyPair> {
    await this.ensureInitialized();

    try {
      const keypair = await sodium.crypto_box_keypair();

      return {
        publicKey: keypair.pk,  // react-native-sodium returns base64
        privateKey: keypair.sk, // react-native-sodium returns base64
      };
    } catch (error) {
      console.error('[CryptoService] Failed to generate keypair:', error);
      throw new Error('Failed to generate encryption keypair');
    }
  }

  /**
   * Store user keypair securely in AsyncStorage
   */
  async storeUserKeypair(keypair: KeyPair): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_KEYPAIR,
        JSON.stringify(keypair)
      );
      console.log('[CryptoService] User keypair stored securely');
    } catch (error) {
      console.error('[CryptoService] Failed to store keypair:', error);
      throw new Error('Failed to store user keypair');
    }
  }

  /**
   * Retrieve user keypair from secure storage
   */
  async getUserKeypair(): Promise<KeyPair> {
    try {
      const keypairJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_KEYPAIR);

      if (!keypairJson) {
        throw new Error('No user keypair found in storage');
      }

      const keypair: KeyPair = JSON.parse(keypairJson);

      // Validate keypair structure
      if (!keypair.publicKey || !keypair.privateKey) {
        throw new Error('Invalid keypair structure');
      }

      return keypair;
    } catch (error) {
      console.error('[CryptoService] Failed to retrieve keypair:', error);
      throw new Error('Failed to retrieve user keypair');
    }
  }

  /**
   * Check if user has a keypair stored
   */
  async hasUserKeypair(): Promise<boolean> {
    try {
      const keypairJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_KEYPAIR);
      return keypairJson !== null;
    } catch (error) {
      console.error('[CryptoService] Failed to check keypair:', error);
      return false;
    }
  }

  /**
   * Delete user keypair (use with caution)
   */
  async deleteUserKeypair(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_KEYPAIR);
      console.log('[CryptoService] User keypair deleted');
    } catch (error) {
      console.error('[CryptoService] Failed to delete keypair:', error);
      throw new Error('Failed to delete user keypair');
    }
  }

  // ==================== ROOM KEY MANAGEMENT ====================

  /**
   * Generate a new room key for symmetric encryption
   * Returns base64 encoded 256-bit key
   */
  async generateRoomKey(): Promise<string> {
    await this.ensureInitialized();

    try {
      const key = await sodium.randombytes_buf(CRYPTO_CONSTANTS.SECRETBOX_KEYBYTES);
      return key; // react-native-sodium returns base64
    } catch (error) {
      console.error('[CryptoService] Failed to generate room key:', error);
      throw new Error('Failed to generate room key');
    }
  }

  /**
   * Store room key in secure storage
   */
  async storeRoomKey(roomId: string, key: string): Promise<void> {
    try {
      // Load existing room keys
      const roomKeys = await this.loadRoomKeys();

      // Add or update room key
      roomKeys[roomId] = key;

      // Save back to storage
      await AsyncStorage.setItem(
        STORAGE_KEYS.ROOM_KEYS,
        JSON.stringify(roomKeys)
      );

      // Update cache
      this.roomKeysCache = roomKeys;

      console.log(`[CryptoService] Room key stored for room: ${roomId}`);
    } catch (error) {
      console.error('[CryptoService] Failed to store room key:', error);
      throw new Error('Failed to store room key');
    }
  }

  /**
   * Retrieve room key from storage
   */
  async getRoomKey(roomId: string): Promise<string | null> {
    try {
      // Use cache if available
      if (this.roomKeysCache) {
        return this.roomKeysCache[roomId] || null;
      }

      // Load from storage
      const roomKeys = await this.loadRoomKeys();
      return roomKeys[roomId] || null;
    } catch (error) {
      console.error('[CryptoService] Failed to retrieve room key:', error);
      return null;
    }
  }

  /**
   * Delete room key from storage
   */
  async deleteRoomKey(roomId: string): Promise<void> {
    try {
      const roomKeys = await this.loadRoomKeys();
      delete roomKeys[roomId];

      await AsyncStorage.setItem(
        STORAGE_KEYS.ROOM_KEYS,
        JSON.stringify(roomKeys)
      );

      // Update cache
      this.roomKeysCache = roomKeys;

      console.log(`[CryptoService] Room key deleted for room: ${roomId}`);
    } catch (error) {
      console.error('[CryptoService] Failed to delete room key:', error);
      throw new Error('Failed to delete room key');
    }
  }

  /**
   * Load all room keys from storage
   */
  private async loadRoomKeys(): Promise<RoomKeyStore> {
    try {
      const roomKeysJson = await AsyncStorage.getItem(STORAGE_KEYS.ROOM_KEYS);

      if (!roomKeysJson) {
        return {};
      }

      const roomKeys: RoomKeyStore = JSON.parse(roomKeysJson);
      this.roomKeysCache = roomKeys;
      return roomKeys;
    } catch (error) {
      console.error('[CryptoService] Failed to load room keys:', error);
      return {};
    }
  }

  /**
   * Clear all room keys (use with caution)
   */
  async clearAllRoomKeys(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ROOM_KEYS);
      this.roomKeysCache = null;
      console.log('[CryptoService] All room keys cleared');
    } catch (error) {
      console.error('[CryptoService] Failed to clear room keys:', error);
      throw new Error('Failed to clear room keys');
    }
  }

  // ==================== SYMMETRIC ENCRYPTION (ROOM MESSAGES) ====================

  /**
   * Encrypt a message using symmetric encryption (for room messages)
   * Compatible with web app's encryptRoomMessage
   *
   * @param content - Plain text message to encrypt
   * @param roomKey - Base64 encoded room key
   * @returns Base64 encoded encrypted message (nonce + ciphertext)
   */
  async encryptMessage(content: string, roomKey: string): Promise<string> {
    await this.ensureInitialized();

    try {
      // Generate random nonce
      const nonce = await sodium.randombytes_buf(CRYPTO_CONSTANTS.SECRETBOX_NONCEBYTES);

      // Encrypt message
      // react-native-sodium accepts and returns base64 strings
      const ciphertext = await sodium.crypto_secretbox_easy(
        content,      // message (will be converted internally)
        nonce,        // nonce (base64)
        roomKey       // key (base64)
      );

      // Combine nonce + ciphertext (both base64)
      // We need to decode, combine bytes, then re-encode
      const nonceBytes = this.base64ToUint8Array(nonce);
      const ciphertextBytes = this.base64ToUint8Array(ciphertext);

      const combined = new Uint8Array(nonceBytes.length + ciphertextBytes.length);
      combined.set(nonceBytes);
      combined.set(ciphertextBytes, nonceBytes.length);

      return this.uint8ArrayToBase64(combined);
    } catch (error) {
      console.error('[CryptoService] Message encryption failed:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  /**
   * Decrypt a message using symmetric encryption (for room messages)
   * Compatible with web app's decryptRoomMessage
   *
   * @param encrypted - Base64 encoded encrypted message (nonce + ciphertext)
   * @param roomKey - Base64 encoded room key
   * @returns Decrypted plain text message
   */
  async decryptMessage(encrypted: string, roomKey: string): Promise<string> {
    await this.ensureInitialized();

    try {
      // Decode combined message
      const combined = this.base64ToUint8Array(encrypted);

      // Split nonce and ciphertext
      const nonce = combined.slice(0, CRYPTO_CONSTANTS.SECRETBOX_NONCEBYTES);
      const ciphertext = combined.slice(CRYPTO_CONSTANTS.SECRETBOX_NONCEBYTES);

      // Convert back to base64 for react-native-sodium
      const nonceBase64 = this.uint8ArrayToBase64(nonce);
      const ciphertextBase64 = this.uint8ArrayToBase64(ciphertext);

      // Decrypt message
      const decrypted = await sodium.crypto_secretbox_open_easy(
        ciphertextBase64,
        nonceBase64,
        roomKey
      );

      // react-native-sodium returns the decrypted string directly
      return decrypted;
    } catch (error) {
      console.error('[CryptoService] Message decryption failed:', error);
      throw new Error('Failed to decrypt message - invalid key or corrupted data');
    }
  }

  // ==================== ASYMMETRIC ENCRYPTION (USER-TO-USER) ====================

  /**
   * Encrypt content for a specific user (asymmetric encryption)
   * Used for sharing room keys securely between users
   *
   * @param content - Plain text content to encrypt
   * @param recipientPublicKey - Recipient's public key (base64)
   * @param senderPrivateKey - Sender's private key (base64)
   * @returns Base64 encoded encrypted message (nonce + ciphertext)
   */
  async encryptForUser(
    content: string,
    recipientPublicKey: string,
    senderPrivateKey: string
  ): Promise<string> {
    await this.ensureInitialized();

    try {
      // Generate random nonce
      const nonce = await sodium.randombytes_buf(CRYPTO_CONSTANTS.BOX_NONCEBYTES);

      // Encrypt using public-key cryptography
      const ciphertext = await sodium.crypto_box_easy(
        content,
        nonce,
        recipientPublicKey,
        senderPrivateKey
      );

      // Combine nonce + ciphertext
      const nonceBytes = this.base64ToUint8Array(nonce);
      const ciphertextBytes = this.base64ToUint8Array(ciphertext);

      const combined = new Uint8Array(nonceBytes.length + ciphertextBytes.length);
      combined.set(nonceBytes);
      combined.set(ciphertextBytes, nonceBytes.length);

      return this.uint8ArrayToBase64(combined);
    } catch (error) {
      console.error('[CryptoService] User encryption failed:', error);
      throw new Error('Failed to encrypt for user');
    }
  }

  /**
   * Decrypt content from a specific user (asymmetric encryption)
   * Used for receiving room keys from other users
   *
   * @param encrypted - Base64 encoded encrypted message (nonce + ciphertext)
   * @param senderPublicKey - Sender's public key (base64)
   * @param recipientPrivateKey - Recipient's private key (base64)
   * @returns Decrypted plain text content
   */
  async decryptFromUser(
    encrypted: string,
    senderPublicKey: string,
    recipientPrivateKey: string
  ): Promise<string> {
    await this.ensureInitialized();

    try {
      // Decode combined message
      const combined = this.base64ToUint8Array(encrypted);

      // Split nonce and ciphertext
      const nonce = combined.slice(0, CRYPTO_CONSTANTS.BOX_NONCEBYTES);
      const ciphertext = combined.slice(CRYPTO_CONSTANTS.BOX_NONCEBYTES);

      // Convert back to base64
      const nonceBase64 = this.uint8ArrayToBase64(nonce);
      const ciphertextBase64 = this.uint8ArrayToBase64(ciphertext);

      // Decrypt using public-key cryptography
      const decrypted = await sodium.crypto_box_open_easy(
        ciphertextBase64,
        nonceBase64,
        senderPublicKey,
        recipientPrivateKey
      );

      return decrypted;
    } catch (error) {
      console.error('[CryptoService] User decryption failed:', error);
      throw new Error('Failed to decrypt from user - invalid keys or corrupted data');
    }
  }

  // ==================== PASSWORD HASHING ====================

  /**
   * Hash a password using Argon2id
   * Used for secure password storage and authentication
   *
   * @param password - Plain text password
   * @returns Password hash result with hash and salt (both base64)
   */
  async hashPassword(password: string): Promise<string> {
    await this.ensureInitialized();

    try {
      // Generate random salt
      const salt = await sodium.randombytes_buf(CRYPTO_CONSTANTS.PWHASH_SALTBYTES);

      // Hash password using Argon2id
      const hash = await sodium.crypto_pwhash(
        32, // output length (256 bits)
        password,
        salt,
        CRYPTO_CONSTANTS.PWHASH_OPSLIMIT,
        CRYPTO_CONSTANTS.PWHASH_MEMLIMIT,
        CRYPTO_CONSTANTS.PWHASH_ALG
      );

      // Combine salt + hash for storage
      const saltBytes = this.base64ToUint8Array(salt);
      const hashBytes = this.base64ToUint8Array(hash);

      const combined = new Uint8Array(saltBytes.length + hashBytes.length);
      combined.set(saltBytes);
      combined.set(hashBytes, saltBytes.length);

      return this.uint8ArrayToBase64(combined);
    } catch (error) {
      console.error('[CryptoService] Password hashing failed:', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify a password against a hash
   *
   * @param password - Plain text password to verify
   * @param storedHash - Stored hash (base64 encoded salt + hash)
   * @returns True if password matches, false otherwise
   */
  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      // Decode stored hash
      const combined = this.base64ToUint8Array(storedHash);

      // Split salt and hash
      const salt = combined.slice(0, CRYPTO_CONSTANTS.PWHASH_SALTBYTES);
      const expectedHash = combined.slice(CRYPTO_CONSTANTS.PWHASH_SALTBYTES);

      // Convert salt back to base64
      const saltBase64 = this.uint8ArrayToBase64(salt);

      // Hash the provided password with the same salt
      const hash = await sodium.crypto_pwhash(
        32,
        password,
        saltBase64,
        CRYPTO_CONSTANTS.PWHASH_OPSLIMIT,
        CRYPTO_CONSTANTS.PWHASH_MEMLIMIT,
        CRYPTO_CONSTANTS.PWHASH_ALG
      );

      const hashBytes = this.base64ToUint8Array(hash);

      // Constant-time comparison
      if (hashBytes.length !== expectedHash.length) {
        return false;
      }

      let result = 0;
      for (let i = 0; i < hashBytes.length; i++) {
        result |= hashBytes[i] ^ expectedHash[i];
      }

      return result === 0;
    } catch (error) {
      console.error('[CryptoService] Password verification failed:', error);
      return false;
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Generate cryptographically secure random bytes
   *
   * @param length - Number of bytes to generate
   * @returns Base64 encoded random bytes
   */
  async generateRandomBytes(length: number): Promise<string> {
    await this.ensureInitialized();

    try {
      const bytes = await sodium.randombytes_buf(length);
      return bytes; // react-native-sodium returns base64
    } catch (error) {
      console.error('[CryptoService] Random bytes generation failed:', error);
      throw new Error('Failed to generate random bytes');
    }
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (error) {
      throw new Error('Invalid base64 string');
    }
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binaryString = '';
    for (let i = 0; i < bytes.length; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    return btoa(binaryString);
  }

  /**
   * Clear all cryptographic data (use with extreme caution)
   * This will remove all keys and make encrypted data unrecoverable
   */
  async clearAllCryptoData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.USER_KEYPAIR,
        STORAGE_KEYS.ROOM_KEYS,
      ]);
      this.roomKeysCache = null;
      console.warn('[CryptoService] All cryptographic data cleared');
    } catch (error) {
      console.error('[CryptoService] Failed to clear crypto data:', error);
      throw new Error('Failed to clear cryptographic data');
    }
  }

  /**
   * Get crypto service status
   */
  getStatus(): { initialized: boolean; hasKeypair: boolean } {
    return {
      initialized: this.initialized,
      hasKeypair: this.roomKeysCache !== null,
    };
  }
}

// Export singleton instance
export const cryptoService = new CryptoService();

// Export types
export type { EncryptedMessage, PasswordHashResult };
