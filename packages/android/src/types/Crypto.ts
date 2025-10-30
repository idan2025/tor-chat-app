/**
 * Crypto Type Definitions
 * Type definitions for the CryptoService
 */

/**
 * User keypair for asymmetric encryption
 * Used for room key exchange and user-to-user encryption
 */
export interface KeyPair {
  /** Base64 encoded public key (32 bytes) */
  publicKey: string;
  /** Base64 encoded private key (32 bytes) - NEVER share or transmit */
  privateKey: string;
}

/**
 * Encrypted message structure
 * Contains nonce and ciphertext as separate fields
 */
export interface EncryptedMessage {
  /** Base64 encoded nonce (24 bytes) */
  nonce: string;
  /** Base64 encoded ciphertext */
  ciphertext: string;
}

/**
 * Password hash result
 * Contains salt and hash for secure storage
 */
export interface PasswordHashResult {
  /** Base64 encoded hash (32 bytes) */
  hash: string;
  /** Base64 encoded salt (16 bytes) */
  salt: string;
}

/**
 * Room key entry
 * Maps room IDs to their encryption keys
 */
export interface RoomKeyEntry {
  /** Unique room identifier */
  roomId: string;
  /** Base64 encoded room key (32 bytes) */
  key: string;
  /** Timestamp when key was created */
  createdAt: Date;
  /** Optional key version for rotation */
  version?: number;
}

/**
 * Encrypted room key for sharing
 * Used when sharing room keys with new members
 */
export interface EncryptedRoomKey {
  /** Room identifier */
  roomId: string;
  /** User ID of recipient */
  recipientId: string;
  /** Base64 encoded encrypted room key */
  encryptedKey: string;
  /** Base64 encoded sender's public key */
  senderPublicKey: string;
  /** Timestamp when encrypted */
  timestamp: Date;
}

/**
 * Crypto service status
 */
export interface CryptoServiceStatus {
  /** Whether the service is initialized */
  initialized: boolean;
  /** Whether user has a keypair stored */
  hasKeypair: boolean;
  /** Number of room keys stored */
  roomKeysCount?: number;
  /** Crypto library version */
  version?: string;
}

/**
 * Crypto operation result
 * Generic result type for crypto operations
 */
export interface CryptoOperationResult<T = string> {
  /** Whether operation succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
}

/**
 * Encryption algorithm types
 */
export enum EncryptionAlgorithm {
  /** Symmetric encryption (crypto_secretbox) */
  SECRETBOX = 'secretbox',
  /** Asymmetric encryption (crypto_box) */
  BOX = 'box',
  /** Password hashing (crypto_pwhash) */
  PWHASH = 'pwhash',
}

/**
 * Key types
 */
export enum KeyType {
  /** Room encryption key (symmetric) */
  ROOM_KEY = 'room_key',
  /** User public key */
  PUBLIC_KEY = 'public_key',
  /** User private key */
  PRIVATE_KEY = 'private_key',
}

/**
 * Crypto error types
 */
export enum CryptoErrorType {
  /** Service not initialized */
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  /** Invalid key format or length */
  INVALID_KEY = 'INVALID_KEY',
  /** Decryption failed */
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  /** Encryption failed */
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  /** Key not found in storage */
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  /** Invalid input data */
  INVALID_INPUT = 'INVALID_INPUT',
  /** Storage operation failed */
  STORAGE_FAILED = 'STORAGE_FAILED',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Crypto error class
 */
export class CryptoError extends Error {
  type: CryptoErrorType;
  originalError?: Error;

  constructor(
    type: CryptoErrorType,
    message: string,
    originalError?: Error
  ) {
    super(message);
    this.name = 'CryptoError';
    this.type = type;
    this.originalError = originalError;
  }
}

/**
 * Message encryption options
 */
export interface MessageEncryptionOptions {
  /** Room ID for context */
  roomId?: string;
  /** Optional additional authenticated data */
  aad?: string;
  /** Key version for rotation support */
  keyVersion?: number;
}

/**
 * File encryption metadata
 */
export interface FileEncryptionMetadata {
  /** Original filename */
  filename: string;
  /** File MIME type */
  mimetype: string;
  /** File size in bytes (original) */
  size: number;
  /** Encrypted size in bytes */
  encryptedSize: number;
  /** File hash (SHA-256) before encryption */
  hash: string;
  /** Encryption timestamp */
  encryptedAt: Date;
}

/**
 * Encrypted file structure
 */
export interface EncryptedFile {
  /** Base64 encoded encrypted data */
  data: string;
  /** File metadata */
  metadata: FileEncryptionMetadata;
  /** Room ID where file was shared */
  roomId: string;
}

/**
 * Key rotation event
 */
export interface KeyRotationEvent {
  /** Room ID */
  roomId: string;
  /** New key version */
  newVersion: number;
  /** Old key version */
  oldVersion: number;
  /** Base64 encoded new room key (encrypted) */
  encryptedNewKey: string;
  /** Timestamp of rotation */
  rotatedAt: Date;
}

/**
 * Public key verification result
 */
export interface PublicKeyVerification {
  /** User ID */
  userId: string;
  /** Base64 encoded public key */
  publicKey: string;
  /** Whether key is verified (e.g., through QR code) */
  verified: boolean;
  /** Verification method */
  verificationMethod?: 'qr_code' | 'fingerprint' | 'manual';
  /** Verification timestamp */
  verifiedAt?: Date;
}

/**
 * Crypto performance metrics
 */
export interface CryptoPerformanceMetrics {
  /** Average encryption time in ms */
  avgEncryptionTime: number;
  /** Average decryption time in ms */
  avgDecryptionTime: number;
  /** Total operations performed */
  totalOperations: number;
  /** Failed operations count */
  failedOperations: number;
  /** Last operation timestamp */
  lastOperationAt: Date;
}

/**
 * Storage keys for crypto data
 */
export const CRYPTO_STORAGE_KEYS = {
  USER_KEYPAIR: '@tor-chat:crypto:user-keypair',
  ROOM_KEYS: '@tor-chat:crypto:room-keys',
  VERIFIED_KEYS: '@tor-chat:crypto:verified-keys',
  PERFORMANCE_METRICS: '@tor-chat:crypto:metrics',
} as const;

/**
 * Crypto constants
 */
export const CRYPTO_CONSTANTS = {
  SECRETBOX_NONCEBYTES: 24,
  SECRETBOX_KEYBYTES: 32,
  BOX_NONCEBYTES: 24,
  BOX_PUBLICKEYBYTES: 32,
  BOX_SECRETKEYBYTES: 32,
  PWHASH_SALTBYTES: 16,
  PWHASH_OPSLIMIT: 2,
  PWHASH_MEMLIMIT: 67108864, // 64 MB
  PWHASH_ALG: 2, // Argon2id
} as const;
