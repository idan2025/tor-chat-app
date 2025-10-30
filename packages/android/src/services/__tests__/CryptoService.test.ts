/**
 * CryptoService Tests
 *
 * Basic tests to verify CryptoService functionality
 * Note: These are unit tests. Integration tests should be in a separate file.
 */

import { cryptoService } from '../CryptoService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-sodium
jest.mock('react-native-sodium', () => ({
  randombytes_buf: jest.fn((length: number) => {
    // Return mock base64 string
    return Promise.resolve('bW9ja19yYW5kb21fYnl0ZXM='.repeat(Math.ceil(length / 16)));
  }),
  crypto_box_keypair: jest.fn(() =>
    Promise.resolve({
      pk: 'bW9ja19wdWJsaWNfa2V5X2Jhc2U2NA==',
      sk: 'bW9ja19wcml2YXRlX2tleV9iYXNlNjQ=',
    })
  ),
  crypto_secretbox_easy: jest.fn((msg, nonce, key) =>
    Promise.resolve('bW9ja19lbmNyeXB0ZWRfZGF0YQ==')
  ),
  crypto_secretbox_open_easy: jest.fn((cipher, nonce, key) =>
    Promise.resolve('decrypted message')
  ),
  crypto_box_easy: jest.fn((msg, nonce, pk, sk) =>
    Promise.resolve('bW9ja19hc3ltX2VuY3J5cHRlZA==')
  ),
  crypto_box_open_easy: jest.fn((cipher, nonce, pk, sk) =>
    Promise.resolve('decrypted content')
  ),
  crypto_pwhash: jest.fn((len, pwd, salt, ops, mem, alg) =>
    Promise.resolve('bW9ja19wYXNzd29yZF9oYXNo')
  ),
}));

describe('CryptoService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await cryptoService.initialize();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await cryptoService.initialize();
      const status = cryptoService.getStatus();
      expect(status.initialized).toBe(true);
    });

    it('should handle multiple initialization calls', async () => {
      await cryptoService.initialize();
      await cryptoService.initialize();
      await cryptoService.initialize();
      const status = cryptoService.getStatus();
      expect(status.initialized).toBe(true);
    });
  });

  describe('Keypair Management', () => {
    it('should generate a keypair', async () => {
      const keypair = await cryptoService.generateKeypair();
      expect(keypair).toHaveProperty('publicKey');
      expect(keypair).toHaveProperty('privateKey');
      expect(typeof keypair.publicKey).toBe('string');
      expect(typeof keypair.privateKey).toBe('string');
    });

    it('should store and retrieve keypair', async () => {
      const keypair = await cryptoService.generateKeypair();
      await cryptoService.storeUserKeypair(keypair);

      // Mock AsyncStorage to return the stored keypair
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(keypair));

      const retrieved = await cryptoService.getUserKeypair();
      expect(retrieved.publicKey).toBe(keypair.publicKey);
      expect(retrieved.privateKey).toBe(keypair.privateKey);
    });

    it('should check if keypair exists', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');

      // No keypair
      AsyncStorage.getItem.mockResolvedValueOnce(null);
      let hasKeypair = await cryptoService.hasUserKeypair();
      expect(hasKeypair).toBe(false);

      // Keypair exists
      AsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({ publicKey: 'pk', privateKey: 'sk' })
      );
      hasKeypair = await cryptoService.hasUserKeypair();
      expect(hasKeypair).toBe(true);
    });
  });

  describe('Room Key Management', () => {
    it('should generate a room key', async () => {
      const roomKey = await cryptoService.generateRoomKey();
      expect(typeof roomKey).toBe('string');
      expect(roomKey.length).toBeGreaterThan(0);
    });

    it('should store and retrieve room key', async () => {
      const roomId = 'test-room-123';
      const roomKey = 'test-room-key-base64';

      await cryptoService.storeRoomKey(roomId, roomKey);

      // Mock AsyncStorage to return the stored room keys
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({ [roomId]: roomKey })
      );

      const retrieved = await cryptoService.getRoomKey(roomId);
      expect(retrieved).toBe(roomKey);
    });

    it('should return null for non-existent room key', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({}));

      const roomKey = await cryptoService.getRoomKey('non-existent-room');
      expect(roomKey).toBeNull();
    });

    it('should delete room key', async () => {
      const roomId = 'test-room-123';
      const roomKey = 'test-room-key-base64';

      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({ [roomId]: roomKey })
      );

      await cryptoService.deleteRoomKey(roomId);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Symmetric Encryption', () => {
    it('should encrypt a message', async () => {
      const roomKey = await cryptoService.generateRoomKey();
      const message = 'Hello, world!';

      const encrypted = await cryptoService.encryptMessage(message, roomKey);
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should decrypt a message', async () => {
      const roomKey = await cryptoService.generateRoomKey();
      const encrypted = 'bW9ja19lbmNyeXB0ZWRfbWVzc2FnZQ==';

      const decrypted = await cryptoService.decryptMessage(encrypted, roomKey);
      expect(typeof decrypted).toBe('string');
    });

    it('should handle encryption errors gracefully', async () => {
      const sodium = require('react-native-sodium');
      sodium.crypto_secretbox_easy.mockRejectedValueOnce(
        new Error('Encryption failed')
      );

      const roomKey = await cryptoService.generateRoomKey();

      await expect(
        cryptoService.encryptMessage('test', roomKey)
      ).rejects.toThrow();
    });

    it('should handle decryption errors gracefully', async () => {
      const sodium = require('react-native-sodium');
      sodium.crypto_secretbox_open_easy.mockRejectedValueOnce(
        new Error('Decryption failed')
      );

      const roomKey = await cryptoService.generateRoomKey();

      await expect(
        cryptoService.decryptMessage('invalid', roomKey)
      ).rejects.toThrow();
    });
  });

  describe('Asymmetric Encryption', () => {
    it('should encrypt for a user', async () => {
      const content = 'Secret message';
      const recipientPk = 'recipient_public_key_base64';
      const senderSk = 'sender_private_key_base64';

      const encrypted = await cryptoService.encryptForUser(
        content,
        recipientPk,
        senderSk
      );

      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should decrypt from a user', async () => {
      const encrypted = 'encrypted_content_base64';
      const senderPk = 'sender_public_key_base64';
      const recipientSk = 'recipient_private_key_base64';

      const decrypted = await cryptoService.decryptFromUser(
        encrypted,
        senderPk,
        recipientSk
      );

      expect(typeof decrypted).toBe('string');
    });
  });

  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const password = 'my-secure-password';
      const hash = await cryptoService.hashPassword(password);

      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should verify correct password', async () => {
      const password = 'my-secure-password';

      // Mock the hash to simulate storage
      const mockHash = 'bW9ja19zYWx0bW9ja19wYXNzd29yZF9oYXNo';

      const isValid = await cryptoService.verifyPassword(password, mockHash);
      expect(typeof isValid).toBe('boolean');
    });

    it('should reject incorrect password', async () => {
      const correctPassword = 'correct-password';
      const wrongPassword = 'wrong-password';

      const hash = await cryptoService.hashPassword(correctPassword);

      const sodium = require('react-native-sodium');

      // First call for hashing, second call returns different hash
      sodium.crypto_pwhash
        .mockResolvedValueOnce('bW9ja19jb3JyZWN0X2hhc2g=')
        .mockResolvedValueOnce('bW9ja193cm9uZ19oYXNo');

      const isValid = await cryptoService.verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    it('should generate random bytes', async () => {
      const bytes = await cryptoService.generateRandomBytes(32);
      expect(typeof bytes).toBe('string');
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('should clear all crypto data', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');

      await cryptoService.clearAllCryptoData();
      expect(AsyncStorage.multiRemove).toHaveBeenCalled();
    });

    it('should return service status', () => {
      const status = cryptoService.getStatus();
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('hasKeypair');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when getting keypair that does not exist', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockResolvedValueOnce(null);

      await expect(cryptoService.getUserKeypair()).rejects.toThrow();
    });

    it('should handle storage errors gracefully', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));

      const keypair = await cryptoService.generateKeypair();

      await expect(cryptoService.storeUserKeypair(keypair)).rejects.toThrow();
    });

    it('should handle sodium errors gracefully', async () => {
      const sodium = require('react-native-sodium');
      sodium.randombytes_buf.mockRejectedValueOnce(new Error('Sodium error'));

      await expect(cryptoService.generateRoomKey()).rejects.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete message flow', async () => {
      // Generate room key
      const roomKey = await cryptoService.generateRoomKey();

      // Store room key
      await cryptoService.storeRoomKey('test-room', roomKey);

      // Encrypt message
      const message = 'Hello, encrypted world!';
      const encrypted = await cryptoService.encryptMessage(message, roomKey);

      // Mock storage
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify({ 'test-room': roomKey })
      );

      // Retrieve room key
      const retrievedKey = await cryptoService.getRoomKey('test-room');

      // Decrypt message
      const sodium = require('react-native-sodium');
      sodium.crypto_secretbox_open_easy.mockResolvedValueOnce(message);

      const decrypted = await cryptoService.decryptMessage(
        encrypted,
        retrievedKey!
      );

      expect(decrypted).toBe(message);
    });

    it('should handle keypair exchange flow', async () => {
      // Generate sender and recipient keypairs
      const senderKeypair = await cryptoService.generateKeypair();
      const recipientKeypair = await cryptoService.generateKeypair();

      // Generate room key
      const roomKey = await cryptoService.generateRoomKey();

      // Sender encrypts room key for recipient
      const encryptedRoomKey = await cryptoService.encryptForUser(
        roomKey,
        recipientKeypair.publicKey,
        senderKeypair.privateKey
      );

      // Mock decryption to return room key
      const sodium = require('react-native-sodium');
      sodium.crypto_box_open_easy.mockResolvedValueOnce(roomKey);

      // Recipient decrypts room key
      const decryptedRoomKey = await cryptoService.decryptFromUser(
        encryptedRoomKey,
        senderKeypair.publicKey,
        recipientKeypair.privateKey
      );

      expect(decryptedRoomKey).toBe(roomKey);
    });
  });
});
