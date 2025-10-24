import sodium from 'libsodium-wrappers';

/**
 * Cryptography service for end-to-end encryption
 * Uses libsodium (NaCl) for secure encryption
 */
export class CryptoService {
  private ready: boolean = false;

  constructor() {
    this.initialize();
  }

  async initialize(): Promise<void> {
    await sodium.ready;
    this.ready = true;
  }

  async ensureReady(): Promise<void> {
    if (!this.ready) {
      await this.initialize();
    }
  }

  /**
   * Generate a new keypair for user
   * @returns {Object} Public and private key pair
   */
  async generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    await this.ensureReady();
    const keyPair = sodium.crypto_box_keypair();
    return {
      publicKey: sodium.to_base64(keyPair.publicKey),
      privateKey: sodium.to_base64(keyPair.privateKey),
    };
  }

  /**
   * Encrypt a message for a recipient
   * @param message - Plain text message
   * @param recipientPublicKey - Recipient's public key (base64)
   * @param senderPrivateKey - Sender's private key (base64)
   * @returns Encrypted message (base64)
   */
  async encryptMessage(
    message: string,
    recipientPublicKey: string,
    senderPrivateKey: string
  ): Promise<string> {
    await this.ensureReady();

    const messageBytes = sodium.from_string(message);
    const recipientPubKey = sodium.from_base64(recipientPublicKey);
    const senderPrivKey = sodium.from_base64(senderPrivateKey);
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);

    const ciphertext = sodium.crypto_box_easy(
      messageBytes,
      nonce,
      recipientPubKey,
      senderPrivKey
    );

    // Combine nonce and ciphertext
    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, nonce.length);

    return sodium.to_base64(combined);
  }

  /**
   * Decrypt a message
   * @param encryptedMessage - Encrypted message (base64)
   * @param senderPublicKey - Sender's public key (base64)
   * @param recipientPrivateKey - Recipient's private key (base64)
   * @returns Decrypted plain text message
   */
  async decryptMessage(
    encryptedMessage: string,
    senderPublicKey: string,
    recipientPrivateKey: string
  ): Promise<string> {
    await this.ensureReady();

    const combined = sodium.from_base64(encryptedMessage);
    const nonce = combined.slice(0, sodium.crypto_box_NONCEBYTES);
    const ciphertext = combined.slice(sodium.crypto_box_NONCEBYTES);

    const senderPubKey = sodium.from_base64(senderPublicKey);
    const recipientPrivKey = sodium.from_base64(recipientPrivateKey);

    const decrypted = sodium.crypto_box_open_easy(
      ciphertext,
      nonce,
      senderPubKey,
      recipientPrivKey
    );

    return sodium.to_string(decrypted);
  }

  /**
   * Encrypt message for a room (symmetric encryption)
   * @param message - Plain text message
   * @param roomKey - Room's shared key (base64)
   * @returns Encrypted message (base64)
   */
  async encryptRoomMessage(message: string, roomKey: string): Promise<string> {
    await this.ensureReady();

    const messageBytes = sodium.from_string(message);
    const key = sodium.from_base64(roomKey);
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

    const ciphertext = sodium.crypto_secretbox_easy(messageBytes, nonce, key);

    // Combine nonce and ciphertext
    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, nonce.length);

    return sodium.to_base64(combined);
  }

  /**
   * Decrypt room message (symmetric decryption)
   * @param encryptedMessage - Encrypted message (base64)
   * @param roomKey - Room's shared key (base64)
   * @returns Decrypted plain text message
   */
  async decryptRoomMessage(
    encryptedMessage: string,
    roomKey: string
  ): Promise<string> {
    await this.ensureReady();

    const combined = sodium.from_base64(encryptedMessage);
    const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = combined.slice(sodium.crypto_secretbox_NONCEBYTES);
    const key = sodium.from_base64(roomKey);

    const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);

    return sodium.to_string(decrypted);
  }

  /**
   * Generate a random room key
   * @returns Room key (base64)
   */
  async generateRoomKey(): Promise<string> {
    await this.ensureReady();
    const key = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
    return sodium.to_base64(key);
  }

  /**
   * Hash data (for verification)
   * @param data - Data to hash
   * @returns Hash (base64)
   */
  async hash(data: string): Promise<string> {
    await this.ensureReady();
    const dataBytes = sodium.from_string(data);
    const hash = sodium.crypto_generichash(32, dataBytes);
    return sodium.to_base64(hash);
  }

  /**
   * Generate random bytes
   * @param length - Number of bytes
   * @returns Random bytes (base64)
   */
  async randomBytes(length: number): Promise<string> {
    await this.ensureReady();
    const bytes = sodium.randombytes_buf(length);
    return sodium.to_base64(bytes);
  }
}

export const cryptoService = new CryptoService();
