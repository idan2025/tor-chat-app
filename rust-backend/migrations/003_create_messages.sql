-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    encrypted BOOLEAN DEFAULT FALSE,
    message_type VARCHAR(20) DEFAULT 'text',
    file_url TEXT,
    file_name TEXT,
    file_size BIGINT,
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on room_id for faster room message queries
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);

-- Create index on user_id for faster user message queries
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Create index for replies
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Create reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- Create index on message_id for faster reaction queries
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON message_reactions(message_id);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON message_reactions(user_id);
