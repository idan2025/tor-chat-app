use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;

pub async fn connect(database_url: &str) -> anyhow::Result<PgPool> {
    tracing::info!("Connecting to database...");

    let pool = PgPoolOptions::new()
        .max_connections(50)
        .min_connections(5)
        .acquire_timeout(Duration::from_secs(30))
        .connect(database_url)
        .await?;

    tracing::info!("Database connected successfully");
    Ok(pool)
}

pub async fn create_schema(pool: &PgPool) -> anyhow::Result<()> {
    tracing::info!("Creating database schema...");

    // Use raw_sql which supports multiple statements (simple query protocol)
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

        ALTER TABLE users DROP COLUMN IF EXISTS email;
        ALTER TABLE users DROP COLUMN IF EXISTS is_public;

        CREATE TABLE IF NOT EXISTS rooms (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL,
            description TEXT,
            type VARCHAR(20) NOT NULL CHECK (type IN ('public', 'private')),
            encryption_key TEXT NOT NULL,
            creator_id UUID REFERENCES users(id),
            max_members INTEGER DEFAULT 100,
            is_public BOOLEAN DEFAULT FALSE,
            avatar TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
            sender_id UUID NOT NULL REFERENCES users(id),
            encrypted_content TEXT NOT NULL,
            message_type VARCHAR(20) NOT NULL,
            metadata JSONB DEFAULT '{}',
            attachments TEXT[],
            parent_message_id UUID REFERENCES messages(id),
            is_edited BOOLEAN DEFAULT FALSE,
            edited_at TIMESTAMPTZ,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
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
        CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
        CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);
        CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online);

        CREATE INDEX IF NOT EXISTS idx_rooms_name ON rooms(name);
        CREATE INDEX IF NOT EXISTS idx_rooms_creator_id ON rooms(creator_id);
        CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(type);
        CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
        CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_parent_message_id ON messages(parent_message_id);
        CREATE INDEX IF NOT EXISTS idx_messages_is_deleted ON messages(is_deleted);
        CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
        CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON room_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_room_members_last_read_message_id ON room_members(last_read_message_id);
        CREATE INDEX IF NOT EXISTS idx_room_members_room_user ON room_members(room_id, user_id);
        "#,
    )
    .execute(pool)
    .await?;

    tracing::info!("Database schema created successfully");
    Ok(())
}
