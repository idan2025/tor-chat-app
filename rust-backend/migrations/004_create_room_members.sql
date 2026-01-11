-- Create room_members table
CREATE TABLE IF NOT EXISTS room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- Create index on room_id for faster room member queries
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);

-- Create index on user_id for faster user room queries
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);

-- Create index on joined_at for sorting
CREATE INDEX IF NOT EXISTS idx_room_members_joined_at ON room_members(joined_at DESC);

-- Create composite index for checking membership
CREATE INDEX IF NOT EXISTS idx_room_members_room_user ON room_members(room_id, user_id);
