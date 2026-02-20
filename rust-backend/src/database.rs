use sqlx::PgPool;

pub async fn create_schema(pool: &PgPool) -> anyhow::Result<()> {
    tracing::info!("Creating database schema...");

    sqlx::raw_sql(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            public_key TEXT,
            display_name VARCHAR(100),
            avatar TEXT,
            is_online BOOLEAN DEFAULT FALSE,
            last_seen TIMESTAMPTZ,
            is_admin BOOLEAN DEFAULT FALSE,
            is_banned BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS rooms (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL,
            description TEXT,
            type VARCHAR(20) NOT NULL DEFAULT 'public',
            encryption_key TEXT NOT NULL DEFAULT '',
            creator_id UUID REFERENCES users(id),
            max_members INTEGER DEFAULT 100,
            is_public BOOLEAN DEFAULT FALSE,
            avatar TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id),
            content TEXT NOT NULL DEFAULT '',
            message_type VARCHAR(20) NOT NULL DEFAULT 'text',
            reply_to UUID REFERENCES messages(id),
            forwarded_from UUID REFERENCES messages(id),
            reactions JSONB DEFAULT '{}',
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS room_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role VARCHAR(20) NOT NULL DEFAULT 'member',
            joined_at TIMESTAMPTZ DEFAULT NOW(),
            last_read_message_id UUID REFERENCES messages(id),
            last_read_at TIMESTAMPTZ,
            UNIQUE(room_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_rooms_creator_id ON rooms(creator_id);
        CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
        CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
        CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_room_members_room_user ON room_members(room_id, user_id);
        "#,
    )
    .execute(pool)
    .await?;

    tracing::info!("Database schema created successfully");
    Ok(())
}
