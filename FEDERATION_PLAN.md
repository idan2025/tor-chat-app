# TOR Federation Implementation Plan

> **Status**: Design Complete - Ready for Implementation
> **Author**: TOR Integration Expert
> **Date**: October 30, 2025
> **Version**: 1.0

## Executive Summary

This document outlines a comprehensive plan for implementing **peer-to-peer federation** over TOR hidden services, allowing multiple instances of the TorChat application to communicate securely while preserving privacy and maintaining end-to-end encryption.

**Key Features:**
- ✅ Server-to-server communication over TOR (6-hop circuits)
- ✅ End-to-end encryption preserved throughout federation
- ✅ Custom lightweight protocol optimized for TOR latency
- ✅ Ed25519 signatures for server authentication
- ✅ Three-tier trust model with manual verification
- ✅ Message queue with retry logic for reliability
- ✅ Zero metadata leakage

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How TOR Hidden Services Communicate](#2-how-tor-hidden-services-communicate)
3. [Database Schema](#3-database-schema)
4. [Implementation Components](#4-implementation-components)
5. [Message Routing](#5-message-routing)
6. [E2E Encryption Across Federation](#6-e2e-encryption-across-federation)
7. [Trust Model & Authentication](#7-trust-model--authentication)
8. [Protocol Specification](#8-protocol-specification)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Security Considerations](#10-security-considerations)
11. [Testing Strategy](#11-testing-strategy)
12. [Performance Optimization](#12-performance-optimization)
13. [References & Examples](#13-references--examples)

---

## 1. Architecture Overview

### 1.1 Federation Model: Hub-and-Spoke with Direct Peering

```
┌─────────────────────────────────────────────────────────────┐
│                    TOR Network Layer                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│   Server A                Server B              Server C     │
│   (.onion:xxx)            (.onion:yyy)          (.onion:zzz) │
│   ┌──────────┐            ┌──────────┐          ┌──────────┐│
│   │  Users   │◄──────────►│  Users   │◄────────►│  Users   ││
│   │  Rooms   │            │  Rooms   │          │  Rooms   ││
│   │          │            │          │          │          ││
│   └──────────┘            └──────────┘          └──────────┘│
│        ▲                       ▲                      ▲      │
│        │                       │                      │      │
│        └───────────Federation Protocol────────────────┘      │
│                  (Server-to-Server over TOR)                 │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Key Components

1. **Federation Service**: Manages server-to-server communication
2. **Server Discovery**: Track and verify federated servers
3. **Message Routing**: Route messages across federation
4. **Trust & Authentication**: X.509-like certificate system using Ed25519
5. **E2E Encryption Preservation**: Messages remain encrypted through federation

---

## 2. How TOR Hidden Services Communicate

### 2.1 Hidden Service to Hidden Service Connection

TOR hidden services communicate through **6-hop circuits**:

```
Client HS → Guard → Middle → Rendezvous ← Middle ← Guard ← Server HS
   (3 hops)            Point                (3 hops)
```

**Implementation Details:**

```typescript
// Server makes HTTPS/HTTP requests to other .onion addresses
// Through TOR SOCKS5 proxy

import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

const agent = new SocksProxyAgent('socks5://127.0.0.1:9050');

// Server A (.onion:xxx) calls Server B (.onion:yyy)
const response = await axios.post('http://zzzzzzzzzzzzzzz.onion/federation/message', {
  data: encryptedPayload
}, {
  httpAgent: agent,
  httpsAgent: agent,
  timeout: 60000 // TOR is slow, be patient
});
```

**Key Points:**
- Use existing `torService.getAgent()` for all federated requests
- Expect high latency (5-15 seconds per request)
- Implement aggressive timeouts (30-60 seconds)
- Use persistent connections where possible

### 2.2 Circuit Management Configuration

```
# TOR configuration for optimal federation
MaxCircuitDirtiness 600      # Keep circuits 10 minutes
CircuitBuildTimeout 60       # 60 second timeout for circuit builds
LearnCircuitBuildTimeout 0   # Don't learn timeouts (static)
NumEntryGuards 3             # Use 3 guard nodes
```

---

## 3. Database Schema

### 3.1 Federation Tables

```sql
-- Federation servers table
CREATE TABLE federation_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onion_address VARCHAR(62) NOT NULL UNIQUE, -- .onion v3 address (56 chars + .onion)
  public_key TEXT NOT NULL,                   -- Ed25519 public key for verification
  server_name VARCHAR(255) NOT NULL,          -- Human-readable name
  server_description TEXT,

  -- Trust and verification
  is_trusted BOOLEAN DEFAULT false,           -- Manually trusted by admin
  trust_level INTEGER DEFAULT 0,              -- 0=unknown, 1=known, 2=verified, 3=trusted
  verified_at TIMESTAMPTZ,

  -- Connection info
  last_seen TIMESTAMPTZ,
  last_handshake TIMESTAMPTZ,
  connection_failures INTEGER DEFAULT 0,
  is_online BOOLEAN DEFAULT false,

  -- Metadata
  software_version VARCHAR(50),
  supported_protocols JSONB,                  -- ['tor-chat-v1', 'matrix-v1.3']
  federation_metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_federation_onion ON federation_servers(onion_address);
CREATE INDEX idx_federation_trusted ON federation_servers(is_trusted);
CREATE INDEX idx_federation_online ON federation_servers(is_online);

-- Federated users (remote users from other servers)
CREATE TABLE federated_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id VARCHAR(255) NOT NULL,             -- user_id@server.onion
  remote_server_id UUID REFERENCES federation_servers(id) ON DELETE CASCADE,
  username VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  public_key TEXT NOT NULL,                   -- User's E2E encryption key
  avatar TEXT,

  -- Caching
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  cache_expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(local_id, remote_server_id)
);

CREATE INDEX idx_federated_users_server ON federated_users(remote_server_id);
CREATE INDEX idx_federated_users_local_id ON federated_users(local_id);

-- Federated rooms (rooms that exist across multiple servers)
CREATE TABLE federated_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,

  -- Origin server (where room was created)
  origin_server_id UUID REFERENCES federation_servers(id),
  is_local_origin BOOLEAN DEFAULT false,      -- True if this server created the room

  -- Federation settings
  federation_enabled BOOLEAN DEFAULT true,
  allowed_servers JSONB,                      -- List of .onion addresses allowed, null = all

  -- Room identifier across federation
  global_room_id VARCHAR(255) UNIQUE,         -- room_uuid@origin_server.onion

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_federated_rooms_room ON federated_rooms(room_id);
CREATE INDEX idx_federated_rooms_global ON federated_rooms(global_room_id);

-- Federated messages routing
CREATE TABLE federated_message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  destination_server_id UUID REFERENCES federation_servers(id) ON DELETE CASCADE,

  -- Delivery status
  status VARCHAR(20) DEFAULT 'pending',       -- pending, sending, delivered, failed
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  last_error TEXT,

  -- Payload
  encrypted_payload JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_fed_queue_status ON federated_message_queue(status, next_attempt_at);
CREATE INDEX idx_fed_queue_dest ON federated_message_queue(destination_server_id);
```

---

## 4. Implementation Components

### 4.1 File Structure

```
packages/backend/src/
├── models/
│   ├── FederationServer.ts          # New model
│   ├── FederatedUser.ts              # New model
│   ├── FederatedRoom.ts              # New model
│   └── FederationMessageQueue.ts     # New model
├── services/
│   ├── federation.ts                 # Main federation service
│   ├── federation-queue.ts           # Queue processor
│   └── federation-trust.ts           # Trust management
├── routes/
│   ├── federation.ts                 # Federation API endpoints
│   └── admin/federation.ts           # Admin federation management
├── middleware/
│   └── federation-auth.ts            # Verify federation signatures
└── scripts/
    ├── test-federation.ts            # Testing script
    └── migrate-federation.ts         # Database migrations
```

### 4.2 Federation Service (Core)

Located at: `packages/backend/src/services/federation.ts`

**Key Methods:**
- `handshakeWithServer(onionAddress)` - Establish connection with remote server
- `sendMessageToFederation(message, targetServers)` - Send message to federated servers
- `processFederatedMessage(payload)` - Process incoming federated message
- `signData(data)` - Sign data with server's Ed25519 private key
- `verifySignature(data, signature, publicKey)` - Verify remote server signature
- `pingServer(onionAddress)` - Health check remote server
- `addServer(onionAddress, trustLevel)` - Add new federated server

### 4.3 Federation API Endpoints

Located at: `packages/backend/src/routes/federation.ts`

**Endpoints:**
- `POST /federation/handshake` - Server handshake for trust establishment
- `POST /federation/message` - Receive federated message
- `GET /federation/ping` - Health check endpoint
- `GET /federation/info` - Server information

### 4.4 Message Queue Service

Located at: `packages/backend/src/services/federation-queue.ts`

**Features:**
- Automatic retry with exponential backoff
- Maximum 5 attempts per message
- Queue processing every 30 seconds
- Failure tracking and logging

---

## 5. Message Routing

### 5.1 Message Flow

```
User A (Server A)  →  Local Server A  →  Federation Layer  →  Server B  →  User B (Server B)
    |                       |                    |                |              |
    | E2E Encrypted        | Verify              | TOR            | Decrypt      | E2E Encrypted
    | Message              | Forward to          | 6-hop          | Signature    | Message
    |                      | Federation          | Circuit        | Verify Auth  |
```

### 5.2 Room Federation Implementation

```typescript
// When a user sends a message to a federated room

async function handleMessageToFederatedRoom(
  message: Message,
  room: Room,
  socket: Socket
) {
  // 1. Store message locally (already E2E encrypted)
  await Message.create({
    roomId: room.id,
    senderId: message.senderId,
    encryptedContent: message.encryptedContent, // Already encrypted by client
    messageType: message.messageType,
  });

  // 2. Get list of federated servers for this room
  const federatedServers = await federationService.getFederatedServersForRoom(room.id);

  if (federatedServers.length > 0) {
    // 3. Prepare federation payload
    const federationPayload = {
      type: 'message',
      roomId: room.id,
      globalRoomId: `${room.id}@${torService.getHiddenServiceAddress()}`,
      senderId: message.senderId,
      senderServer: torService.getHiddenServiceAddress(),
      encryptedContent: message.encryptedContent, // Pass through E2E encryption
      messageType: message.messageType,
      metadata: message.metadata,
      timestamp: new Date(),
    };

    // 4. Send to all federated servers (async, don't block)
    federationService.sendMessageToFederation(
      federationPayload,
      federatedServers
    ).catch(err => {
      logger.error('Federation delivery error:', err);
    });
  }

  // 5. Broadcast to local users immediately
  socket.to(room.id).emit('newMessage', {
    id: message.id,
    roomId: room.id,
    senderId: message.senderId,
    encryptedContent: message.encryptedContent,
    messageType: message.messageType,
    timestamp: message.createdAt,
  });
}
```

---

## 6. E2E Encryption Across Federation

### 6.1 Encryption Layer Preservation

**Critical Principle**: Federation happens at the **transport layer**, NOT the encryption layer.

```
┌────────────────────────────────────────────────────────────┐
│  Client-Side E2E Encryption (Client A)                     │
│  Message: "Hello"                                           │
│  Encrypted with Room Key → "8f3b2c1d..."                   │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Server A (No Decryption)                                   │
│  - Receives encrypted: "8f3b2c1d..."                       │
│  - Stores as-is in database                                 │
│  - Forwards to Server B (still encrypted)                   │
└────────────────────────────────────────────────────────────┘
                            ↓
                     TOR Network
                     (6-hop circuit)
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Server B (No Decryption)                                   │
│  - Receives encrypted: "8f3b2c1d..."                       │
│  - Verifies server signature (authenticity)                 │
│  - Stores as-is in database                                 │
│  - Broadcasts to Client B (still encrypted)                 │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│  Client-Side E2E Decryption (Client B)                     │
│  Receives: "8f3b2c1d..."                                   │
│  Decrypts with Room Key → "Hello"                          │
└────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Servers NEVER see plaintext
- Room keys are shared through existing client-side key exchange
- Federation only transports encrypted payloads
- Server signatures verify message authenticity (not content)

### 6.2 Room Key Distribution

```typescript
// When User A invites User B (from another server) to room:

const invitation = {
  type: 'room_invitation',
  roomId: room.id,
  globalRoomId: `${room.id}@server-a.onion`,
  fromUserId: userA.id,
  fromServer: 'server-a.onion',
  toUserId: userB.id,
  toServer: 'server-b.onion',

  // Room key encrypted with User B's public key (E2E)
  encryptedRoomKey: await cryptoService.encryptMessage(
    room.encryptionKey,
    userB.publicKey,
    userA.privateKey
  ),

  roomMetadata: {
    name: room.name,
    description: room.description,
  },
};

// Send invitation through federation
await federationService.sendMessageToFederation(invitation, ['server-b.onion']);
```

---

## 7. Trust Model & Authentication

### 7.1 Three-Tier Trust System

```
┌──────────────────────────────────────────────────────────┐
│  Level 0: Unknown                                         │
│  - Server connected but not verified                      │
│  - Messages rejected                                      │
└──────────────────────────────────────────────────────────┘
                        ↓
                  Manual verification
                        ↓
┌──────────────────────────────────────────────────────────┐
│  Level 1: Known                                           │
│  - Handshake completed, signature verified                │
│  - Messages accepted with caution                         │
│  - Displayed with "External Server" badge                 │
└──────────────────────────────────────────────────────────┘
                        ↓
                  Admin approval
                        ↓
┌──────────────────────────────────────────────────────────┐
│  Level 2: Verified                                        │
│  - Admin manually verified server                         │
│  - Out-of-band .onion + public key verification           │
│  - Full federation features enabled                       │
└──────────────────────────────────────────────────────────┘
                        ↓
                  Long-term good behavior
                        ↓
┌──────────────────────────────────────────────────────────┐
│  Level 3: Trusted                                         │
│  - Whitelist member                                       │
│  - Can federate rooms automatically                       │
│  - Reduced verification overhead                          │
└──────────────────────────────────────────────────────────┘
```

### 7.2 TOFU (Trust On First Use) + Manual Verification

Admins can verify and trust servers through the admin panel:

```typescript
// POST /api/admin/federation/trust-server
{
  "serverOnion": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.onion",
  "trustLevel": 2  // 0-3
}
```

---

## 8. Protocol Specification

### 8.1 Custom TorChat Federation Protocol

**Protocol Name**: `tor-chat-federation-v1`

**Transport**: HTTP/1.1 over TOR SOCKS5 proxy

**Authentication**: Ed25519 signatures

**Message Types**:
- `handshake` - Server handshake
- `message` - Federated chat message
- `room_join` - User joins federated room
- `room_leave` - User leaves federated room
- `room_invite` - Invitation to federated room
- `user_lookup` - Query user information
- `server_sync` - Synchronize server state

**Message Format**:
```json
{
  "protocolVersion": "tor-chat-federation-v1",
  "type": "message",
  "originServer": "server-a.onion",
  "timestamp": "2025-10-30T12:00:00Z",
  "payload": {
    "roomId": "uuid",
    "senderId": "uuid",
    "encryptedContent": "base64..."
  },
  "signature": "ed25519-signature"
}
```

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema for federation tables
- [ ] FederationService base implementation
- [ ] Server keypair generation and storage
- [ ] Basic handshake endpoint
- [ ] TOR-to-TOR communication testing

### Phase 2: Core Federation (Week 3-4)
- [ ] Message routing implementation
- [ ] Federation queue system
- [ ] Signature verification
- [ ] Trust level management
- [ ] Admin UI for server management

### Phase 3: Room Federation (Week 5-6)
- [ ] Federated room creation
- [ ] Cross-server room membership
- [ ] Room key distribution
- [ ] Invitation system
- [ ] User lookup across servers

### Phase 4: Reliability (Week 7-8)
- [ ] Message queue with retry logic
- [ ] Circuit failure handling
- [ ] Server health monitoring
- [ ] Automatic reconnection
- [ ] Conflict resolution

### Phase 5: UI & UX (Week 9-10)
- [ ] Federation indicators in UI
- [ ] Server browser/directory
- [ ] Trust verification UI
- [ ] Performance optimizations
- [ ] Testing and debugging

---

## 10. Security Considerations

### 10.1 Attack Vectors & Mitigations

**1. Server Impersonation**
- ✅ Mitigation: Ed25519 signatures on all messages
- ✅ Mitigation: Manual verification of .onion addresses

**2. Message Replay**
- ✅ Mitigation: Timestamp validation (5-minute window)
- ✅ Mitigation: Message ID tracking and deduplication

**3. Timing Attacks**
- ✅ Mitigation: Random delays in message processing
- ✅ Mitigation: Message batching

**4. Sybil Attacks**
- ✅ Mitigation: Trust levels and whitelisting
- ✅ Mitigation: Rate limiting per server

**5. Metadata Leakage**
- ✅ Mitigation: Don't expose user lists publicly
- ✅ Mitigation: Encrypted room metadata
- ✅ Mitigation: Obfuscate server-to-server patterns

### 10.2 Configuration Hardening

```typescript
federation: {
  enabled: process.env.ENABLE_FEDERATION === 'true',

  // Security
  requireManualTrust: true,
  maxConcurrentConnections: 10,
  messageRateLimit: 100, // messages per minute per server

  // Timeouts
  handshakeTimeout: 60000,
  messageTimeout: 45000,

  // Retry policy
  maxRetries: 5,
  retryBackoff: 'exponential',
  maxBackoffDelay: 3600000, // 1 hour

  // Privacy
  exposeServerList: false,
  exposeUserCount: false,
  requireInviteForJoin: true,
}
```

---

## 11. Testing Strategy

### 11.1 Local Testing Setup

```bash
# Start 3 TOR instances with different SOCKS ports

# Server A
docker run -d --name tor-server-a \
  -p 9050:9050 -p 9051:9051 \
  -v /var/lib/tor-a:/var/lib/tor \
  tor

# Server B
docker run -d --name tor-server-b \
  -p 9052:9050 -p 9053:9051 \
  -v /var/lib/tor-b:/var/lib/tor \
  tor

# Server C
docker run -d --name tor-server-c \
  -p 9054:9050 -p 9055:9051 \
  -v /var/lib/tor-c:/var/lib/tor \
  tor
```

### 11.2 Test Scenarios

1. **Two-Server Handshake**: Test basic server-to-server connection
2. **Message Delivery**: Send message from Server A to Server B
3. **Queue Retry**: Test message retry on failure
4. **Trust Verification**: Test trust levels and access control
5. **E2E Encryption**: Verify encryption preserved across federation
6. **Circuit Failure**: Test handling of TOR circuit failures
7. **Load Testing**: Test with multiple concurrent messages
8. **Security Testing**: Attempt impersonation and replay attacks

---

## 12. Performance Optimization

### 12.1 Connection Pooling

```typescript
import { Agent } from 'http';

const torAgent = new Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5,
});
```

### 12.2 Message Batching

```typescript
const messageBatch = [];
setInterval(async () => {
  if (messageBatch.length > 0) {
    await sendBatchedMessages(messageBatch);
    messageBatch.length = 0;
  }
}, 5000); // Send every 5 seconds
```

### 12.3 Priority Queue

```typescript
enum MessagePriority {
  HIGH = 1,    // Real-time messages
  NORMAL = 2,  // Regular messages
  LOW = 3,     // Background sync
}
```

---

## 13. References & Examples

### 13.1 Existing Implementations

**Matrix over TOR**:
```yaml
homeserver:
  server_name: "your-server.onion"

listeners:
  - port: 8008
    bind_addresses: ['127.0.0.1']

federation:
  enabled: true
  client_timeout: 60s

outbound_proxy:
  type: socks5
  host: 127.0.0.1
  port: 9050
```

**Briar Messaging**:
- Each device has hidden service
- Direct .onion-to-.onion communication
- No central server
- Store-and-forward for offline messages

### 13.2 Similar Projects

- **Ricochet Refresh**: Anonymous instant messaging over TOR
- **OnionShare**: Share files securely over TOR
- **SecureDrop**: Whistleblower submission system over TOR
- **Matrix Synapse**: Federated chat with TOR support

---

## Conclusion

This federation implementation provides:

1. ✅ **Privacy-First**: All communication over TOR, E2E encryption preserved
2. ✅ **Secure**: Ed25519 signatures, trust levels, signature verification
3. ✅ **Reliable**: Message queue, retry logic, circuit failure handling
4. ✅ **Scalable**: Can federate with unlimited servers
5. ✅ **Auditable**: Simple custom protocol, open architecture

**Next Steps:**
1. Review this plan with the team
2. Set up development environment with multiple TOR instances
3. Begin Phase 1: Database schema and handshake implementation
4. Iterate and test thoroughly before production deployment

**Configuration:**
- Set `ENABLE_FEDERATION=false` by default
- Enable gradually for trusted server pairs
- Monitor and optimize based on real-world usage

---

**Document Version**: 1.0
**Last Updated**: October 30, 2025
**Status**: Ready for Implementation
**Estimated Timeline**: 10 weeks for full implementation
