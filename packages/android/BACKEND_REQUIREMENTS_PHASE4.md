# Backend Requirements for Phase 4: Admin Panel & Advanced Message Features

This document outlines the backend API endpoints and Socket.IO events required to support Phase 4 features in the Android app.

## Admin Panel Endpoints

### 1. Admin Statistics Dashboard
```
GET /api/admin/stats
```
**Authentication:** Required (Admin only)

**Response:**
```json
{
  "totalUsers": 150,
  "totalRooms": 25,
  "totalMessages": 5430,
  "todayMessages": 142,
  "onlineUsers": 12,
  "activeUsers": [
    {
      "id": "user-id",
      "username": "john_doe",
      "email": "john@example.com",
      "publicKey": "...",
      "isOnline": true,
      "isAdmin": false
    }
  ],
  "recentActivity": [
    {
      "id": "activity-id",
      "type": "user_join",
      "userId": "user-id",
      "username": "john_doe",
      "description": "john_doe joined the server",
      "timestamp": "2025-10-31T10:30:00Z"
    }
  ]
}
```

### 2. User Management

#### List All Users
```
GET /api/admin/users?page=1&limit=50&search=query
```
**Authentication:** Required (Admin only)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)
- `search` (optional): Search by username or email

**Response:**
```json
{
  "users": [
    {
      "id": "user-id",
      "username": "john_doe",
      "email": "john@example.com",
      "isAdmin": false,
      "isBanned": false,
      "isOnline": true,
      "createdAt": "2025-01-15T08:00:00Z",
      "lastSeen": "2025-10-31T10:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50,
  "hasMore": true
}
```

#### Promote User to Admin
```
PUT /api/admin/users/:userId/promote
```
**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "message": "User promoted to admin",
  "user": {
    "id": "user-id",
    "username": "john_doe",
    "isAdmin": true
  }
}
```

#### Demote User from Admin
```
PUT /api/admin/users/:userId/demote
```
**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "message": "User demoted from admin",
  "user": {
    "id": "user-id",
    "username": "john_doe",
    "isAdmin": false
  }
}
```

#### Ban User
```
PUT /api/admin/users/:userId/ban
```
**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "message": "User banned successfully",
  "user": {
    "id": "user-id",
    "username": "john_doe",
    "isBanned": true
  }
}
```

**Side Effects:**
- User's active sessions should be terminated
- User cannot login until unbanned
- User's messages should be marked as from banned user (optional)

#### Unban User
```
PUT /api/admin/users/:userId/unban
```
**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "message": "User unbanned successfully",
  "user": {
    "id": "user-id",
    "username": "john_doe",
    "isBanned": false
  }
}
```

#### Delete User
```
DELETE /api/admin/users/:userId
```
**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Side Effects:**
- All user's messages should be deleted or marked as deleted
- User should be removed from all rooms
- User's account and data should be permanently deleted

### 3. Room Management

#### List All Rooms
```
GET /api/admin/rooms?page=1&limit=50
```
**Authentication:** Required (Admin only)

**Response:**
```json
{
  "rooms": [
    {
      "id": "room-id",
      "name": "General Chat",
      "isPublic": true,
      "memberCount": 45,
      "messageCount": 1234,
      "createdBy": "user-id",
      "createdAt": "2025-01-10T12:00:00Z"
    }
  ],
  "total": 25
}
```

#### Delete Room
```
DELETE /api/admin/rooms/:roomId
```
**Authentication:** Required (Admin only)

**Response:**
```json
{
  "success": true,
  "message": "Room deleted successfully"
}
```

**Side Effects:**
- All messages in the room should be deleted
- All members should be removed from the room
- Socket.IO notification should be sent to all room members

#### Update Room
```
PUT /api/admin/rooms/:roomId
```
**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "name": "Updated Room Name",
  "description": "New description",
  "isPublic": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Room updated successfully",
  "room": {
    "id": "room-id",
    "name": "Updated Room Name",
    "description": "New description",
    "isPublic": false
  }
}
```

## Message Management Endpoints

### 1. Edit Message
```
PUT /api/rooms/:roomId/messages/:messageId
```
**Authentication:** Required

**Authorization:**
- User must be the message sender
- Message must be less than 15 minutes old

**Request Body:**
```json
{
  "content": "Updated encrypted message content"
}
```

**Response:**
```json
{
  "success": true,
  "message": {
    "id": "message-id",
    "content": "Updated encrypted message content",
    "isEdited": true,
    "editedAt": "2025-10-31T10:35:00Z"
  }
}
```

### 2. Delete Message
```
DELETE /api/rooms/:roomId/messages/:messageId
```
**Authentication:** Required

**Authorization:**
- User must be the message sender OR
- User must be an admin

**Response:**
```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

**Side Effects:**
- Message should be permanently deleted from database
- Socket.IO event should be emitted to all room members
- Reactions to the message should be deleted

### 3. Forward Message (Optional Backend Support)
The forward feature is currently implemented client-side by sending a new message with the same content. No specific backend endpoint is required unless you want to track forwarded messages.

## Socket.IO Events

### Message Edited Event

**Client → Server:**
```javascript
socket.emit('messageEdited', {
  messageId: 'message-id',
  roomId: 'room-id',
  content: 'encrypted-content'
});
```

**Server → Client (broadcast to room):**
```javascript
socket.on('messageEdited', {
  messageId: 'message-id',
  roomId: 'room-id',
  content: 'encrypted-content',
  editedAt: '2025-10-31T10:35:00Z',
  editedBy: 'user-id'
});
```

### Message Deleted Event

**Server → Client (broadcast to room):**
```javascript
socket.on('messageDeleted', {
  messageId: 'message-id',
  roomId: 'room-id',
  deletedBy: 'user-id',
  deletedAt: '2025-10-31T10:40:00Z'
});
```

### Admin Action Events (Optional)

**User Banned:**
```javascript
socket.on('userBanned', {
  userId: 'user-id',
  username: 'john_doe',
  bannedBy: 'admin-id',
  bannedAt: '2025-10-31T11:00:00Z'
});
```

**Room Deleted:**
```javascript
socket.on('roomDeleted', {
  roomId: 'room-id',
  roomName: 'General Chat',
  deletedBy: 'admin-id',
  deletedAt: '2025-10-31T11:05:00Z'
});
```

## Security Considerations

### 1. Admin Authorization
- All `/api/admin/*` endpoints must check if the authenticated user has `isAdmin: true`
- Return 403 Forbidden if user is not an admin
- Log all admin actions for audit purposes

### 2. Message Edit Authorization
- Verify user is the message owner
- Check message age (< 15 minutes)
- Return 403 Forbidden if unauthorized
- Return 400 Bad Request if message too old

### 3. Message Delete Authorization
- Allow if user is message owner OR admin
- Return 403 Forbidden if unauthorized
- Emit Socket.IO event to notify room members

### 4. Rate Limiting
Recommended rate limits:
- Admin endpoints: 100 requests/minute per admin
- Message edit: 10 edits/minute per user
- Message delete: 20 deletes/minute per user

### 5. Input Validation
- Validate all user inputs (search queries, page numbers, etc.)
- Sanitize username/email searches to prevent SQL injection
- Validate message content length (max 5000 characters)

## Database Schema Updates

### User Model
Add `isBanned` field:
```typescript
interface User {
  // ... existing fields
  isBanned: boolean; // Default: false
}
```

### Message Model
Add edit tracking fields:
```typescript
interface Message {
  // ... existing fields
  isEdited: boolean; // Default: false
  editedAt?: Date; // Timestamp of last edit
  replyTo?: string; // ID of message being replied to
}
```

### Activity Log (New Model - Optional)
```typescript
interface ActivityLog {
  id: string;
  type: 'user_join' | 'user_leave' | 'room_create' | 'room_delete' | 'message_delete' | 'user_ban' | 'user_unban';
  userId: string;
  username: string;
  description: string;
  metadata?: any; // Additional contextual data
  timestamp: Date;
}
```

## Testing Checklist

- [ ] Admin can access `/api/admin/stats` endpoint
- [ ] Non-admin users receive 403 on admin endpoints
- [ ] Admin can list, promote, demote, ban, unban, and delete users
- [ ] Admin can list and delete rooms
- [ ] User can edit own message within 15 minutes
- [ ] User cannot edit message after 15 minutes
- [ ] User can delete own message
- [ ] Admin can delete any message
- [ ] Socket.IO events are emitted for edit/delete actions
- [ ] Real-time updates work for all users in affected rooms
- [ ] Banned users cannot login
- [ ] Deleted rooms remove all members via Socket.IO

## Implementation Priority

1. **High Priority** (Required for Phase 4):
   - Admin stats endpoint
   - User management endpoints (list, promote, demote, ban, unban, delete)
   - Room management endpoints (list, delete)
   - Message edit endpoint with 15-minute window
   - Message delete endpoint with authorization
   - Socket.IO events for edit/delete

2. **Medium Priority** (Nice to have):
   - Activity log tracking
   - Admin action Socket.IO events
   - Room update endpoint

3. **Low Priority** (Future enhancement):
   - User details endpoint
   - Advanced search filters
   - Bulk actions (ban multiple users, etc.)

## Notes

- All endpoints should work through TOR (no special modifications needed)
- Encryption/decryption is handled client-side
- Backend stores encrypted message content
- Admin endpoints should be properly documented in API docs
- Consider adding admin action audit logging for compliance
