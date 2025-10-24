import sodium from 'libsodium-wrappers';

class CryptoService {
  private ready: boolean = false;

  async initialize(): Promise<void> {
    await sodium.ready;
    this.ready = true;
  }

  async ensureReady(): Promise<void> {
    if (!this.ready) {
      await this.initialize();
    }
  }

  async encryptRoomMessage(message: string, roomKey: string): Promise<string> {
    await this.ensureReady();

    const messageBytes = sodium.from_string(message);
    const key = sodium.from_base64(roomKey);
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

    const ciphertext = sodium.crypto_secretbox_easy(messageBytes, nonce, key);

    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, nonce.length);

    return sodium.to_base64(combined);
  }

  async decryptRoomMessage(encryptedMessage: string, roomKey: string): Promise<string> {
    await this.ensureReady();

    const combined = sodium.from_base64(encryptedMessage);
    const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = combined.slice(sodium.crypto_secretbox_NONCEBYTES);
    const key = sodium.from_base64(roomKey);

    const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);

    return sodium.to_string(decrypted);
  }
}

export const cryptoService = new CryptoService();
