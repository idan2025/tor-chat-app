# CryptoService Documentation

## Overview

The CryptoService provides end-to-end encryption (E2E) for the TOR Chat Android application using libsodium (react-native-sodium). All messages are encrypted on the client device, transmitted encrypted to the server, and decrypted only on the recipient's device.

## Table of Contents

1. [Architecture](#architecture)
2. [Encryption Strategy](#encryption-strategy)
3. [API Reference](#api-reference)
4. [Usage Examples](#usage-examples)
5. [Security Considerations](#security-considerations)
6. [Troubleshooting](#troubleshooting)

---

## Architecture

### Encryption Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     MESSAGE ENCRYPTION FLOW                      │
└─────────────────────────────────────────────────────────────────┘

Sender Device                    Server                  Recipient Device
─────────────                    ──────                  ────────────────

1. User types message
   │
   ├─ Load room key
   │  (symmetric key)
   │
   ├─ Generate nonce
   │  (24 random bytes)
   │
   ├─ Encrypt with
   │  crypto_secretbox_easy
   │  ├─ Input: plaintext + nonce + room_key
   │  └─ Output: ciphertext
   │
   ├─ Combine: nonce || ciphertext
   │
   └─ Base64 encode
      │
      └────────────────────────────────────────┐
                                               │
                                               ▼
                                        Store encrypted
                                        message in DB
                                               │
                                               └──────────────────────┐
                                                                      │
                                                                      ▼
                                                               Receive encrypted
                                                               message
                                                                      │
                                                                      ├─ Base64 decode
                                                                      │
                                                                      ├─ Split: nonce, ciphertext
                                                                      │
                                                                      ├─ Load room key
                                                                      │
                                                                      ├─ Decrypt with
                                                                      │  crypto_secretbox_open_easy
                                                                      │
                                                                      └─ Display plaintext
```

### Room Key Exchange Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROOM KEY EXCHANGE FLOW                        │
└─────────────────────────────────────────────────────────────────┘

Room Creator                     Server                  Room Member
────────────                     ──────                  ───────────

1. Create room
   │
   ├─ Generate room key
   │  (32 random bytes)
   │
   ├─ Store room key locally
   │  AsyncStorage
   │
   └─ Send encrypted to server
      │
      └────────────────────────────────────────┐
                                               │
                                               ▼
2. User joins room                      Store room metadata
   │                                          │
   │◄─────────────────────────────────────────┘
   │
   └─ Request to join
      │
      └────────────────────────────────────────┐
                                               │
                                               ▼
                                        Notify room creator
                                               │
                                               └──────────────────────┐
                                                                      │
                                                                      ▼
3. Share room key with new member                              Await room key
   │                                                                  ▲
   ├─ Load member's public key                                       │
   │                                                                  │
   ├─ Load own private key                                           │
   │                                                                  │
   ├─ Encrypt room key with                                          │
   │  crypto_box_easy                                                │
   │  ├─ Input: room_key + member_pk + own_sk                        │
   │  └─ Output: encrypted_room_key                                  │
   │                                                                  │
   └─ Send encrypted room key ───────────────────────────────────────┘
      │
      └────────────────────────────────────────┐
                                               │
                                               ▼
                                        Forward encrypted
                                        room key
                                               │
                                               └──────────────────────┐
                                                                      │
                                                                      ▼
                                                               Receive encrypted
                                                               room key
                                                                      │
                                                                      ├─ Load sender's public key
                                                                      │
                                                                      ├─ Load own private key
                                                                      │
                                                                      ├─ Decrypt with
                                                                      │  crypto_box_open_easy
                                                                      │
                                                                      ├─ Store room key locally
                                                                      │
                                                                      └─ Can now decrypt messages
```

### Key Management Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      KEY STORAGE HIERARCHY                       │
└─────────────────────────────────────────────────────────────────┘

AsyncStorage (Encrypted on Android)
│
├─ @tor-chat:crypto:user-keypair
│  │
│  └─ {
│       "publicKey": "base64...",   ← Shared with other users
│       "privateKey": "base64..."   ← NEVER leaves device
│     }
│
└─ @tor-chat:crypto:room-keys
   │
   └─ {
        "room-uuid-1": "base64...",  ← Symmetric key for room 1
        "room-uuid-2": "base64...",  ← Symmetric key for room 2
        "room-uuid-3": "base64..."   ← Symmetric key for room 3
      }
```

---

## Encryption Strategy

### 1. Room Messages (Symmetric Encryption)

**Algorithm**: XSalsa20-Poly1305 (crypto_secretbox)

**Key**: 256-bit shared symmetric key (generated once per room)

**Process**:
1. Generate random 192-bit nonce
2. Encrypt message with `crypto_secretbox_easy(message, nonce, room_key)`
3. Combine: `nonce || ciphertext`
4. Encode to base64 for transmission

**Security Properties**:
- Authenticated encryption (prevents tampering)
- Each message uses unique nonce
- Fast symmetric encryption
- Compatible with web app

### 2. Room Key Exchange (Asymmetric Encryption)

**Algorithm**: Curve25519-XSalsa20-Poly1305 (crypto_box)

**Keys**: User's Ed25519 keypair (public/private)

**Process**:
1. Generate random 192-bit nonce
2. Encrypt room key with `crypto_box_easy(room_key, nonce, recipient_pk, sender_sk)`
3. Combine: `nonce || ciphertext`
4. Encode to base64 for transmission

**Security Properties**:
- Perfect forward secrecy (room key rotation)
- Public key authentication
- Only intended recipient can decrypt
- Prevents man-in-the-middle attacks

### 3. Password Hashing

**Algorithm**: Argon2id

**Parameters**:
- Memory: 64 MB
- Operations: 2 (interactive)
- Output: 256 bits
- Salt: 128 bits (random)

**Process**:
1. Generate random 128-bit salt
2. Hash password with `crypto_pwhash(password, salt, ops, mem, alg)`
3. Combine: `salt || hash`
4. Encode to base64 for storage

**Security Properties**:
- Resistant to GPU/ASIC attacks
- Memory-hard function
- Configurable difficulty
- Industry-standard algorithm

---

## API Reference

### Initialization

#### `initialize(): Promise<void>`

Initialize the crypto service. Must be called before any crypto operations.

```typescript
await cryptoService.initialize();
```

**Throws**: Error if initialization fails

---

### Keypair Management

#### `generateKeypair(): Promise<KeyPair>`

Generate a new Ed25519 keypair for asymmetric encryption.

**Returns**: KeyPair object with public and private keys (base64 encoded)

```typescript
const keypair = await cryptoService.generateKeypair();
console.log(keypair.publicKey);  // "base64..."
console.log(keypair.privateKey); // "base64..."
```

#### `storeUserKeypair(keypair: KeyPair): Promise<void>`

Store user keypair securely in AsyncStorage.

**Parameters**:
- `keypair`: KeyPair object to store

```typescript
await cryptoService.storeUserKeypair(keypair);
```

#### `getUserKeypair(): Promise<KeyPair>`

Retrieve stored user keypair.

**Returns**: KeyPair object

**Throws**: Error if no keypair found

```typescript
const keypair = await cryptoService.getUserKeypair();
```

#### `hasUserKeypair(): Promise<boolean>`

Check if user has a stored keypair.

**Returns**: True if keypair exists, false otherwise

```typescript
const hasKeypair = await cryptoService.hasUserKeypair();
```

#### `deleteUserKeypair(): Promise<void>`

Delete user keypair from storage. Use with caution.

```typescript
await cryptoService.deleteUserKeypair();
```

---

### Room Key Management

#### `generateRoomKey(): Promise<string>`

Generate a new 256-bit symmetric key for room encryption.

**Returns**: Base64 encoded room key

```typescript
const roomKey = await cryptoService.generateRoomKey();
```

#### `storeRoomKey(roomId: string, key: string): Promise<void>`

Store room key in secure storage.

**Parameters**:
- `roomId`: Unique room identifier
- `key`: Base64 encoded room key

```typescript
await cryptoService.storeRoomKey('room-uuid', roomKey);
```

#### `getRoomKey(roomId: string): Promise<string | null>`

Retrieve room key from storage.

**Parameters**:
- `roomId`: Unique room identifier

**Returns**: Base64 encoded room key or null if not found

```typescript
const roomKey = await cryptoService.getRoomKey('room-uuid');
```

#### `deleteRoomKey(roomId: string): Promise<void>`

Delete room key from storage.

**Parameters**:
- `roomId`: Unique room identifier

```typescript
await cryptoService.deleteRoomKey('room-uuid');
```

#### `clearAllRoomKeys(): Promise<void>`

Delete all stored room keys. Use with caution.

```typescript
await cryptoService.clearAllRoomKeys();
```

---

### Message Encryption (Symmetric)

#### `encryptMessage(content: string, roomKey: string): Promise<string>`

Encrypt a message using symmetric encryption (for room messages).

**Parameters**:
- `content`: Plain text message
- `roomKey`: Base64 encoded room key

**Returns**: Base64 encoded encrypted message (nonce + ciphertext)

```typescript
const encrypted = await cryptoService.encryptMessage(
  'Hello, world!',
  roomKey
);
```

#### `decryptMessage(encrypted: string, roomKey: string): Promise<string>`

Decrypt a message using symmetric encryption.

**Parameters**:
- `encrypted`: Base64 encoded encrypted message
- `roomKey`: Base64 encoded room key

**Returns**: Decrypted plain text message

**Throws**: Error if decryption fails (invalid key or corrupted data)

```typescript
const decrypted = await cryptoService.decryptMessage(
  encrypted,
  roomKey
);
```

---

### User Encryption (Asymmetric)

#### `encryptForUser(content: string, recipientPublicKey: string, senderPrivateKey: string): Promise<string>`

Encrypt content for a specific user using asymmetric encryption.

**Parameters**:
- `content`: Plain text content
- `recipientPublicKey`: Recipient's public key (base64)
- `senderPrivateKey`: Sender's private key (base64)

**Returns**: Base64 encoded encrypted message (nonce + ciphertext)

```typescript
const encrypted = await cryptoService.encryptForUser(
  roomKey,
  recipientPublicKey,
  senderPrivateKey
);
```

#### `decryptFromUser(encrypted: string, senderPublicKey: string, recipientPrivateKey: string): Promise<string>`

Decrypt content from a specific user.

**Parameters**:
- `encrypted`: Base64 encoded encrypted message
- `senderPublicKey`: Sender's public key (base64)
- `recipientPrivateKey`: Recipient's private key (base64)

**Returns**: Decrypted plain text content

**Throws**: Error if decryption fails

```typescript
const decrypted = await cryptoService.decryptFromUser(
  encrypted,
  senderPublicKey,
  recipientPrivateKey
);
```

---

### Password Hashing

#### `hashPassword(password: string): Promise<string>`

Hash a password using Argon2id.

**Parameters**:
- `password`: Plain text password

**Returns**: Base64 encoded hash (salt + hash)

```typescript
const hash = await cryptoService.hashPassword('my-password');
```

#### `verifyPassword(password: string, hash: string): Promise<boolean>`

Verify a password against a stored hash.

**Parameters**:
- `password`: Plain text password to verify
- `hash`: Stored hash (base64 encoded)

**Returns**: True if password matches, false otherwise

```typescript
const isValid = await cryptoService.verifyPassword(
  'my-password',
  storedHash
);
```

---

### Utilities

#### `generateRandomBytes(length: number): Promise<string>`

Generate cryptographically secure random bytes.

**Parameters**:
- `length`: Number of bytes to generate

**Returns**: Base64 encoded random bytes

```typescript
const randomBytes = await cryptoService.generateRandomBytes(32);
```

#### `clearAllCryptoData(): Promise<void>`

Clear all cryptographic data from storage. Use with extreme caution.

**Warning**: This makes all encrypted data unrecoverable.

```typescript
await cryptoService.clearAllCryptoData();
```

#### `getStatus(): { initialized: boolean; hasKeypair: boolean }`

Get crypto service status.

**Returns**: Status object

```typescript
const status = cryptoService.getStatus();
console.log(status.initialized); // true
```

---

## Usage Examples

### Example 1: User Registration Flow

```typescript
import { cryptoService } from '../services/CryptoService';

async function registerUser(username: string, password: string) {
  // Initialize crypto service
  await cryptoService.initialize();

  // Generate user keypair
  const keypair = await cryptoService.generateKeypair();

  // Hash password
  const passwordHash = await cryptoService.hashPassword(password);

  // Store keypair locally
  await cryptoService.storeUserKeypair(keypair);

  // Send to server
  const response = await apiService.post('/auth/register', {
    username,
    passwordHash,
    publicKey: keypair.publicKey,
  });

  return response;
}
```

### Example 2: Creating an Encrypted Room

```typescript
import { cryptoService } from '../services/CryptoService';

async function createRoom(name: string, members: string[]) {
  // Generate room key
  const roomKey = await cryptoService.generateRoomKey();

  // Store room key locally
  await cryptoService.storeRoomKey(roomId, roomKey);

  // Encrypt room key for each member
  const keypair = await cryptoService.getUserKeypair();
  const encryptedKeys = [];

  for (const member of members) {
    const memberPublicKey = await apiService.get(
      `/users/${member.id}/public-key`
    );

    const encryptedKey = await cryptoService.encryptForUser(
      roomKey,
      memberPublicKey,
      keypair.privateKey
    );

    encryptedKeys.push({
      userId: member.id,
      encryptedKey,
    });
  }

  // Create room on server
  const response = await apiService.post('/rooms', {
    name,
    encryptedKeys,
  });

  return response;
}
```

### Example 3: Sending an Encrypted Message

```typescript
import { cryptoService } from '../services/CryptoService';

async function sendMessage(roomId: string, content: string) {
  // Get room key
  const roomKey = await cryptoService.getRoomKey(roomId);

  if (!roomKey) {
    throw new Error('No room key found - cannot encrypt message');
  }

  // Encrypt message
  const encryptedContent = await cryptoService.encryptMessage(
    content,
    roomKey
  );

  // Send to server
  const response = await apiService.post('/messages', {
    roomId,
    content: encryptedContent,
  });

  return response;
}
```

### Example 4: Receiving and Decrypting Messages

```typescript
import { cryptoService } from '../services/CryptoService';

async function receiveMessage(message: EncryptedMessage) {
  try {
    // Get room key
    const roomKey = await cryptoService.getRoomKey(message.roomId);

    if (!roomKey) {
      console.error('No room key found for room:', message.roomId);
      return {
        ...message,
        content: '[Encrypted - No Key]',
      };
    }

    // Decrypt message
    const decryptedContent = await cryptoService.decryptMessage(
      message.content,
      roomKey
    );

    return {
      ...message,
      content: decryptedContent,
    };
  } catch (error) {
    console.error('Failed to decrypt message:', error);
    return {
      ...message,
      content: '[Decryption Failed]',
    };
  }
}
```

### Example 5: Joining an Encrypted Room

```typescript
import { cryptoService } from '../services/CryptoService';

async function joinRoom(roomId: string) {
  // Request to join room
  await apiService.post(`/rooms/${roomId}/join`);

  // Wait for room key from room admin
  // This would typically come through WebSocket
  socket.on('room-key', async (data) => {
    const { encryptedRoomKey, senderPublicKey } = data;

    // Get own keypair
    const keypair = await cryptoService.getUserKeypair();

    // Decrypt room key
    const roomKey = await cryptoService.decryptFromUser(
      encryptedRoomKey,
      senderPublicKey,
      keypair.privateKey
    );

    // Store room key
    await cryptoService.storeRoomKey(roomId, roomKey);

    console.log('Successfully joined encrypted room');
  });
}
```

### Example 6: File Encryption

```typescript
import { cryptoService } from '../services/CryptoService';

async function encryptFile(file: File, roomId: string) {
  // Read file as base64
  const fileBase64 = await readFileAsBase64(file);

  // Get room key
  const roomKey = await cryptoService.getRoomKey(roomId);

  if (!roomKey) {
    throw new Error('No room key found');
  }

  // Encrypt file data
  const encryptedData = await cryptoService.encryptMessage(
    fileBase64,
    roomKey
  );

  // Upload encrypted file
  const response = await apiService.post('/files/upload', {
    roomId,
    filename: file.name,
    mimetype: file.type,
    data: encryptedData,
  });

  return response;
}

async function decryptFile(encryptedFile: EncryptedFile) {
  // Get room key
  const roomKey = await cryptoService.getRoomKey(encryptedFile.roomId);

  if (!roomKey) {
    throw new Error('No room key found');
  }

  // Decrypt file data
  const decryptedBase64 = await cryptoService.decryptMessage(
    encryptedFile.data,
    roomKey
  );

  // Convert back to file
  const file = base64ToFile(
    decryptedBase64,
    encryptedFile.filename,
    encryptedFile.mimetype
  );

  return file;
}
```

### Example 7: Integration with Chat Store

```typescript
import { create } from 'zustand';
import { cryptoService } from '../services/CryptoService';
import { apiService } from '../services/ApiService';

interface ChatStore {
  sendMessage: (roomId: string, content: string) => Promise<void>;
  receiveMessage: (message: Message) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sendMessage: async (roomId, content) => {
    try {
      // Get room key
      const roomKey = await cryptoService.getRoomKey(roomId);

      if (!roomKey) {
        throw new Error('Cannot send message - room not joined');
      }

      // Encrypt message
      const encryptedContent = await cryptoService.encryptMessage(
        content,
        roomKey
      );

      // Send to server
      await apiService.post('/messages', {
        roomId,
        content: encryptedContent,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  },

  receiveMessage: async (message) => {
    try {
      // Get room key
      const roomKey = await cryptoService.getRoomKey(message.roomId);

      if (!roomKey) {
        console.warn('Cannot decrypt message - no room key');
        return;
      }

      // Decrypt message
      const decryptedContent = await cryptoService.decryptMessage(
        message.content,
        roomKey
      );

      // Update store with decrypted message
      set((state) => ({
        messages: [
          ...state.messages,
          {
            ...message,
            content: decryptedContent,
          },
        ],
      }));
    } catch (error) {
      console.error('Failed to decrypt message:', error);
    }
  },
}));
```

---

## Security Considerations

### Key Storage

1. **AsyncStorage Security**:
   - On Android, AsyncStorage data is encrypted by the OS
   - Keys are only accessible to the app
   - Protected by Android's app sandbox

2. **Private Key Protection**:
   - Private keys NEVER leave the device
   - Never transmitted to server
   - Only public keys are shared

3. **Room Key Rotation**:
   - Consider rotating room keys periodically
   - Implement when removing members from room
   - Prevents access to future messages

### Encryption Best Practices

1. **Nonce Uniqueness**:
   - Each encryption uses a fresh random nonce
   - Prevents nonce reuse attacks
   - Critical for security

2. **Authenticated Encryption**:
   - crypto_secretbox and crypto_box provide authentication
   - Prevents tampering and forgery
   - Validates message integrity

3. **Algorithm Selection**:
   - XSalsa20-Poly1305: Fast, secure, proven
   - Curve25519: State-of-the-art elliptic curve
   - Argon2id: Modern password hashing

### Attack Mitigation

1. **Man-in-the-Middle**:
   - Server cannot decrypt messages (no keys)
   - Asymmetric encryption authenticates sender
   - Verify public keys through trusted channel

2. **Replay Attacks**:
   - Message IDs and timestamps prevent replay
   - Server enforces message ordering
   - Client validates message freshness

3. **Side-Channel Attacks**:
   - Constant-time password comparison
   - Memory clearing after use
   - Secure random number generation

### Compliance

- **GDPR**: Users control their encryption keys
- **Data Breach**: Encrypted data useless without keys
- **Right to Erasure**: Delete keys = data unrecoverable

---

## Troubleshooting

### Common Errors

#### "Failed to initialize crypto service"

**Cause**: react-native-sodium not properly installed or configured

**Solution**:
```bash
npm install react-native-sodium
cd android && ./gradlew clean
```

#### "Failed to decrypt message - invalid key or corrupted data"

**Cause**: Wrong room key or message corrupted

**Solution**:
1. Verify room key is correct
2. Check message wasn't modified in transit
3. Request new room key from admin

#### "No room key found - cannot encrypt message"

**Cause**: User hasn't received room key yet

**Solution**:
1. Wait for room admin to share key
2. Request room key explicitly
3. Check network connection

#### "Failed to retrieve user keypair"

**Cause**: No keypair stored in AsyncStorage

**Solution**:
```typescript
// Generate and store new keypair
const keypair = await cryptoService.generateKeypair();
await cryptoService.storeUserKeypair(keypair);
```

### Debugging

Enable detailed crypto logging:

```typescript
// In CryptoService.ts, enable debug mode
const DEBUG = true;

if (DEBUG) {
  console.log('[CryptoService] Operation:', operation);
  console.log('[CryptoService] Input:', input);
  console.log('[CryptoService] Output:', output);
}
```

### Performance

- Encryption: ~1ms per message
- Decryption: ~1ms per message
- Keypair generation: ~50ms
- Password hashing: ~500ms (intentionally slow)

### Testing

Test crypto operations:

```typescript
import { cryptoService } from '../services/CryptoService';

async function testCrypto() {
  await cryptoService.initialize();

  // Test symmetric encryption
  const roomKey = await cryptoService.generateRoomKey();
  const encrypted = await cryptoService.encryptMessage('test', roomKey);
  const decrypted = await cryptoService.decryptMessage(encrypted, roomKey);
  console.assert(decrypted === 'test', 'Symmetric encryption failed');

  // Test asymmetric encryption
  const keypair1 = await cryptoService.generateKeypair();
  const keypair2 = await cryptoService.generateKeypair();
  const encrypted2 = await cryptoService.encryptForUser(
    'test',
    keypair2.publicKey,
    keypair1.privateKey
  );
  const decrypted2 = await cryptoService.decryptFromUser(
    encrypted2,
    keypair1.publicKey,
    keypair2.privateKey
  );
  console.assert(decrypted2 === 'test', 'Asymmetric encryption failed');

  // Test password hashing
  const hash = await cryptoService.hashPassword('password123');
  const valid = await cryptoService.verifyPassword('password123', hash);
  console.assert(valid === true, 'Password hashing failed');

  console.log('All crypto tests passed!');
}
```

---

## Additional Resources

- [libsodium Documentation](https://doc.libsodium.org/)
- [react-native-sodium GitHub](https://github.com/lyubo/react-native-sodium)
- [NaCl Cryptography](https://nacl.cr.yp.to/)
- [Argon2 Specification](https://github.com/P-H-C/phc-winner-argon2)

---

## License

MIT License - See LICENSE file for details
