/**
 * CryptoService Usage Examples
 *
 * This file contains comprehensive examples of how to use the CryptoService
 * in various scenarios throughout the Android app.
 *
 * NOTE: These are examples for reference. Import and adapt as needed.
 */

import { cryptoService } from '../services/CryptoService';
import { apiService } from '../services/ApiService';
import type { KeyPair } from '../types/Crypto';

// ==================== EXAMPLE 1: User Registration ====================

/**
 * Complete user registration flow with E2E encryption setup
 */
export async function exampleUserRegistration(
  username: string,
  email: string,
  password: string,
  displayName: string
) {
  console.log('=== User Registration Example ===');

  try {
    // Step 1: Initialize crypto service
    await cryptoService.initialize();
    console.log('✓ Crypto service initialized');

    // Step 2: Generate user keypair for E2E encryption
    const keypair = await cryptoService.generateKeypair();
    console.log('✓ User keypair generated');
    console.log('  Public key:', keypair.publicKey.substring(0, 20) + '...');
    console.log('  Private key:', keypair.privateKey.substring(0, 20) + '...');

    // Step 3: Hash password for secure storage
    const passwordHash = await cryptoService.hashPassword(password);
    console.log('✓ Password hashed securely');

    // Step 4: Store keypair locally (private key never leaves device)
    await cryptoService.storeUserKeypair(keypair);
    console.log('✓ Keypair stored in AsyncStorage');

    // Step 5: Register with server (send public key, not private!)
    const response = await apiService.post('/auth/register', {
      username,
      email,
      displayName,
      passwordHash, // Send hashed password
      publicKey: keypair.publicKey, // Only public key goes to server
    });

    console.log('✓ Registration successful');
    return response;
  } catch (error) {
    console.error('Registration failed:', error);
    throw error;
  }
}

// ==================== EXAMPLE 2: User Login ====================

/**
 * Login flow - verify password and load keypair
 */
export async function exampleUserLogin(username: string, password: string) {
  console.log('=== User Login Example ===');

  try {
    // Step 1: Initialize crypto service
    await cryptoService.initialize();
    console.log('✓ Crypto service initialized');

    // Step 2: Login with credentials
    const response = await apiService.post('/auth/login', {
      username,
      password, // Server will verify hashed password
    });

    console.log('✓ Login successful');

    // Step 3: Load user keypair from storage
    const hasKeypair = await cryptoService.hasUserKeypair();

    if (!hasKeypair) {
      console.warn('⚠ No keypair found - user may need to re-register');
      // Generate new keypair and upload to server
      const keypair = await cryptoService.generateKeypair();
      await cryptoService.storeUserKeypair(keypair);
      await apiService.put('/auth/update-public-key', {
        publicKey: keypair.publicKey,
      });
      console.log('✓ New keypair generated and uploaded');
    } else {
      const keypair = await cryptoService.getUserKeypair();
      console.log('✓ Keypair loaded from storage');
      console.log('  Public key:', keypair.publicKey.substring(0, 20) + '...');
    }

    return response;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

// ==================== EXAMPLE 3: Create Encrypted Room ====================

/**
 * Create a new encrypted chat room and share keys with initial members
 */
export async function exampleCreateRoom(
  roomName: string,
  memberUserIds: string[]
) {
  console.log('=== Create Encrypted Room Example ===');

  try {
    // Step 1: Generate room encryption key
    const roomKey = await cryptoService.generateRoomKey();
    console.log('✓ Room key generated');
    console.log('  Room key:', roomKey.substring(0, 20) + '...');

    // Step 2: Create room on server first
    const roomResponse = await apiService.post('/rooms', {
      name: roomName,
      isEncrypted: true,
    });
    const roomId = roomResponse.room.id;
    console.log('✓ Room created on server, ID:', roomId);

    // Step 3: Store room key locally
    await cryptoService.storeRoomKey(roomId, roomKey);
    console.log('✓ Room key stored locally');

    // Step 4: Get own keypair
    const ownKeypair = await cryptoService.getUserKeypair();

    // Step 5: Encrypt room key for each member
    const encryptedKeys = [];

    for (const userId of memberUserIds) {
      // Fetch member's public key from server
      const memberData = await apiService.get(`/users/${userId}`);
      const memberPublicKey = memberData.publicKey;

      // Encrypt room key for this member
      const encryptedRoomKey = await cryptoService.encryptForUser(
        roomKey,
        memberPublicKey,
        ownKeypair.privateKey
      );

      encryptedKeys.push({
        userId,
        encryptedKey: encryptedRoomKey,
      });

      console.log(`✓ Room key encrypted for user ${userId}`);
    }

    // Step 6: Share encrypted room keys with members
    await apiService.post(`/rooms/${roomId}/share-keys`, {
      encryptedKeys,
    });
    console.log('✓ Room keys shared with all members');

    return roomResponse.room;
  } catch (error) {
    console.error('Room creation failed:', error);
    throw error;
  }
}

// ==================== EXAMPLE 4: Join Encrypted Room ====================

/**
 * Join an encrypted room and receive/decrypt room key
 */
export async function exampleJoinRoom(roomId: string) {
  console.log('=== Join Encrypted Room Example ===');

  try {
    // Step 1: Send join request to server
    await apiService.post(`/rooms/${roomId}/join`);
    console.log('✓ Join request sent');

    // Step 2: Wait for room key (this would typically be via WebSocket)
    // For this example, we'll fetch it via API
    const keyResponse = await apiService.get(`/rooms/${roomId}/my-key`);
    const { encryptedRoomKey, senderPublicKey } = keyResponse;
    console.log('✓ Encrypted room key received');

    // Step 3: Get own keypair
    const ownKeypair = await cryptoService.getUserKeypair();

    // Step 4: Decrypt room key
    const roomKey = await cryptoService.decryptFromUser(
      encryptedRoomKey,
      senderPublicKey,
      ownKeypair.privateKey
    );
    console.log('✓ Room key decrypted');

    // Step 5: Store room key locally
    await cryptoService.storeRoomKey(roomId, roomKey);
    console.log('✓ Room key stored - can now send/receive messages');

    return { success: true, roomId };
  } catch (error) {
    console.error('Failed to join room:', error);
    throw error;
  }
}

// ==================== EXAMPLE 5: Send Encrypted Message ====================

/**
 * Send an encrypted message to a room
 */
export async function exampleSendMessage(roomId: string, content: string) {
  console.log('=== Send Encrypted Message Example ===');

  try {
    // Step 1: Get room key
    const roomKey = await cryptoService.getRoomKey(roomId);

    if (!roomKey) {
      throw new Error(
        'No room key found - user may not have joined room yet'
      );
    }
    console.log('✓ Room key loaded');

    // Step 2: Encrypt message content
    const encryptedContent = await cryptoService.encryptMessage(
      content,
      roomKey
    );
    console.log('✓ Message encrypted');
    console.log('  Original:', content);
    console.log('  Encrypted:', encryptedContent.substring(0, 50) + '...');

    // Step 3: Send encrypted message to server
    const response = await apiService.post('/messages', {
      roomId,
      content: encryptedContent, // Only encrypted content is sent
      type: 'text',
    });

    console.log('✓ Encrypted message sent to server');
    return response.message;
  } catch (error) {
    console.error('Failed to send message:', error);
    throw error;
  }
}

// ==================== EXAMPLE 6: Receive and Decrypt Message ====================

/**
 * Receive an encrypted message and decrypt it
 */
export async function exampleReceiveMessage(message: {
  id: string;
  roomId: string;
  content: string;
  senderId: string;
  createdAt: string;
}) {
  console.log('=== Receive and Decrypt Message Example ===');

  try {
    console.log('Received encrypted message:', message.id);

    // Step 1: Get room key
    const roomKey = await cryptoService.getRoomKey(message.roomId);

    if (!roomKey) {
      console.warn('⚠ No room key found - cannot decrypt message');
      return {
        ...message,
        content: '[Encrypted - No Key Available]',
        encrypted: true,
      };
    }
    console.log('✓ Room key loaded');

    // Step 2: Decrypt message content
    const decryptedContent = await cryptoService.decryptMessage(
      message.content,
      roomKey
    );
    console.log('✓ Message decrypted');
    console.log('  Encrypted:', message.content.substring(0, 50) + '...');
    console.log('  Decrypted:', decryptedContent);

    // Step 3: Return decrypted message
    return {
      ...message,
      content: decryptedContent,
      encrypted: false,
    };
  } catch (error) {
    console.error('Failed to decrypt message:', error);
    // Return message with error indicator
    return {
      ...message,
      content: '[Decryption Failed]',
      encrypted: true,
      error: true,
    };
  }
}

// ==================== EXAMPLE 7: Encrypt File Upload ====================

/**
 * Encrypt and upload a file to a room
 */
export async function exampleEncryptFileUpload(
  roomId: string,
  file: {
    uri: string;
    name: string;
    type: string;
    size: number;
  }
) {
  console.log('=== Encrypt File Upload Example ===');

  try {
    // Step 1: Read file as base64
    const fileBase64 = await readFileAsBase64(file.uri);
    console.log(`✓ File read: ${file.name} (${file.size} bytes)`);

    // Step 2: Get room key
    const roomKey = await cryptoService.getRoomKey(roomId);

    if (!roomKey) {
      throw new Error('No room key found');
    }
    console.log('✓ Room key loaded');

    // Step 3: Encrypt file data
    const encryptedData = await cryptoService.encryptMessage(
      fileBase64,
      roomKey
    );
    console.log('✓ File encrypted');
    console.log(`  Original size: ${fileBase64.length} bytes`);
    console.log(`  Encrypted size: ${encryptedData.length} bytes`);

    // Step 4: Upload encrypted file
    const response = await apiService.post('/files/upload', {
      roomId,
      filename: file.name,
      mimetype: file.type,
      size: file.size,
      data: encryptedData,
    });

    console.log('✓ Encrypted file uploaded');
    return response.file;
  } catch (error) {
    console.error('Failed to encrypt/upload file:', error);
    throw error;
  }
}

// ==================== EXAMPLE 8: Decrypt Downloaded File ====================

/**
 * Download and decrypt a file from a room
 */
export async function exampleDecryptFileDownload(
  fileId: string,
  roomId: string
) {
  console.log('=== Decrypt File Download Example ===');

  try {
    // Step 1: Download encrypted file
    const fileResponse = await apiService.get(`/files/${fileId}`);
    const { data, filename, mimetype } = fileResponse;
    console.log(`✓ Encrypted file downloaded: ${filename}`);

    // Step 2: Get room key
    const roomKey = await cryptoService.getRoomKey(roomId);

    if (!roomKey) {
      throw new Error('No room key found');
    }
    console.log('✓ Room key loaded');

    // Step 3: Decrypt file data
    const decryptedBase64 = await cryptoService.decryptMessage(data, roomKey);
    console.log('✓ File decrypted');

    // Step 4: Convert back to file
    const decryptedFile = {
      data: decryptedBase64,
      filename,
      mimetype,
    };

    console.log(`✓ File ready: ${filename}`);
    return decryptedFile;
  } catch (error) {
    console.error('Failed to decrypt file:', error);
    throw error;
  }
}

// ==================== EXAMPLE 9: Password Verification ====================

/**
 * Verify user password (e.g., for sensitive operations)
 */
export async function exampleVerifyPassword(password: string) {
  console.log('=== Password Verification Example ===');

  try {
    // Step 1: Get stored password hash from server
    const userResponse = await apiService.get('/auth/me');
    const storedHash = userResponse.passwordHash;
    console.log('✓ Stored hash retrieved');

    // Step 2: Verify password
    const isValid = await cryptoService.verifyPassword(password, storedHash);

    if (isValid) {
      console.log('✓ Password verified successfully');
    } else {
      console.log('✗ Password verification failed');
    }

    return isValid;
  } catch (error) {
    console.error('Password verification error:', error);
    throw error;
  }
}

// ==================== EXAMPLE 10: Room Key Rotation ====================

/**
 * Rotate room encryption key (when removing members or periodically)
 */
export async function exampleRotateRoomKey(roomId: string) {
  console.log('=== Room Key Rotation Example ===');

  try {
    // Step 1: Generate new room key
    const newRoomKey = await cryptoService.generateRoomKey();
    console.log('✓ New room key generated');

    // Step 2: Get old room key for comparison
    const oldRoomKey = await cryptoService.getRoomKey(roomId);
    console.log('✓ Old room key retrieved');

    // Step 3: Store new room key
    await cryptoService.storeRoomKey(roomId, newRoomKey);
    console.log('✓ New room key stored');

    // Step 4: Get current room members
    const roomResponse = await apiService.get(`/rooms/${roomId}/members`);
    const members = roomResponse.members;
    console.log(`✓ Found ${members.length} members`);

    // Step 5: Get own keypair
    const ownKeypair = await cryptoService.getUserKeypair();

    // Step 6: Encrypt new room key for all members
    const encryptedKeys = [];

    for (const member of members) {
      const memberPublicKey = member.publicKey;

      const encryptedRoomKey = await cryptoService.encryptForUser(
        newRoomKey,
        memberPublicKey,
        ownKeypair.privateKey
      );

      encryptedKeys.push({
        userId: member.id,
        encryptedKey: encryptedRoomKey,
      });
    }

    console.log(`✓ New room key encrypted for ${members.length} members`);

    // Step 7: Share new room keys
    await apiService.post(`/rooms/${roomId}/rotate-key`, {
      encryptedKeys,
      keyVersion: 2, // Increment version
    });

    console.log('✓ Room key rotated successfully');
    return { success: true, newKeyVersion: 2 };
  } catch (error) {
    console.error('Room key rotation failed:', error);
    throw error;
  }
}

// ==================== EXAMPLE 11: WebSocket Integration ====================

/**
 * Example of integrating CryptoService with WebSocket messages
 */
export async function exampleWebSocketIntegration(socket: any) {
  console.log('=== WebSocket Integration Example ===');

  // Listen for encrypted messages
  socket.on('message', async (encryptedMessage: any) => {
    try {
      console.log('Received encrypted message via WebSocket');

      // Decrypt message
      const decryptedMessage = await exampleReceiveMessage(encryptedMessage);

      // Handle decrypted message (e.g., update UI)
      console.log('Message decrypted:', decryptedMessage.content);

      // Emit to app state management
      // store.dispatch(addMessage(decryptedMessage));
    } catch (error) {
      console.error('Failed to handle WebSocket message:', error);
    }
  });

  // Listen for room key shares
  socket.on('room-key', async (data: any) => {
    try {
      const { roomId, encryptedRoomKey, senderPublicKey } = data;
      console.log('Received room key via WebSocket for room:', roomId);

      // Decrypt room key
      const ownKeypair = await cryptoService.getUserKeypair();
      const roomKey = await cryptoService.decryptFromUser(
        encryptedRoomKey,
        senderPublicKey,
        ownKeypair.privateKey
      );

      // Store room key
      await cryptoService.storeRoomKey(roomId, roomKey);
      console.log('✓ Room key stored - can now decrypt messages');
    } catch (error) {
      console.error('Failed to handle room key:', error);
    }
  });

  // Listen for key rotation events
  socket.on('key-rotation', async (data: any) => {
    try {
      const { roomId, encryptedNewKey, senderPublicKey, version } = data;
      console.log('Room key rotation for room:', roomId);

      // Decrypt new room key
      const ownKeypair = await cryptoService.getUserKeypair();
      const newRoomKey = await cryptoService.decryptFromUser(
        encryptedNewKey,
        senderPublicKey,
        ownKeypair.privateKey
      );

      // Update stored room key
      await cryptoService.storeRoomKey(roomId, newRoomKey);
      console.log(`✓ Room key updated to version ${version}`);
    } catch (error) {
      console.error('Failed to handle key rotation:', error);
    }
  });
}

// ==================== EXAMPLE 12: Error Handling ====================

/**
 * Example of comprehensive error handling with CryptoService
 */
export async function exampleErrorHandling() {
  console.log('=== Error Handling Example ===');

  // Example 1: Handle missing room key
  try {
    const roomId = 'non-existent-room';
    const roomKey = await cryptoService.getRoomKey(roomId);

    if (!roomKey) {
      console.log('✓ Correctly handled missing room key');
      // Show user-friendly message
      // "You haven't joined this room yet. Request access from admin."
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }

  // Example 2: Handle decryption failure
  try {
    const corruptedData = 'invalid-base64-data';
    const roomKey = await cryptoService.generateRoomKey();

    await cryptoService.decryptMessage(corruptedData, roomKey);
  } catch (error) {
    console.log('✓ Correctly handled decryption failure');
    // Show user-friendly message
    // "This message cannot be decrypted. It may be corrupted."
  }

  // Example 3: Handle missing keypair
  try {
    // Clear keypair for testing
    await cryptoService.deleteUserKeypair();

    const hasKeypair = await cryptoService.hasUserKeypair();
    if (!hasKeypair) {
      console.log('✓ Detected missing keypair');
      // Regenerate keypair
      const newKeypair = await cryptoService.generateKeypair();
      await cryptoService.storeUserKeypair(newKeypair);
      console.log('✓ Keypair regenerated');
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Read file as base64 (mock implementation)
 */
async function readFileAsBase64(uri: string): Promise<string> {
  // In real app, use react-native-fs or similar
  // For example:
  // import RNFS from 'react-native-fs';
  // return await RNFS.readFile(uri, 'base64');

  // Mock implementation
  return 'base64-encoded-file-data';
}

/**
 * Run all examples (for testing)
 */
export async function runAllExamples() {
  console.log('\n========================================');
  console.log('RUNNING ALL CRYPTO SERVICE EXAMPLES');
  console.log('========================================\n');

  try {
    // Initialize crypto service
    await cryptoService.initialize();
    console.log('✓ Crypto service initialized\n');

    // Example 1: User registration
    // await exampleUserRegistration('testuser', 'test@example.com', 'password123', 'Test User');

    // Example 9: Password verification
    // await exampleVerifyPassword('password123');

    // Example 2: User login
    // await exampleUserLogin('testuser', 'password123');

    // Example 3: Create room
    // await exampleCreateRoom('Test Room', ['user-id-1', 'user-id-2']);

    // Example 5: Send message
    // await exampleSendMessage('room-id', 'Hello, encrypted world!');

    // Example 12: Error handling
    await exampleErrorHandling();

    console.log('\n========================================');
    console.log('ALL EXAMPLES COMPLETED SUCCESSFULLY');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ Examples failed:', error);
  }
}
