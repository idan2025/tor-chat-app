-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    encrypted_key TEXT,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_members INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on creator_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_rooms_creator_id ON rooms(creator_id);

-- Create index on is_private for filtering
CREATE INDEX IF NOT EXISTS idx_rooms_is_private ON rooms(is_private);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at DESC);
