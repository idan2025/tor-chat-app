use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;

pub mod migrations;

#[derive(Clone)]
pub struct Database {
    pool: PgPool,
}

impl Database {
    pub async fn connect(database_url: &str) -> anyhow::Result<Self> {
        tracing::info!("Connecting to database...");

        let pool = PgPoolOptions::new()
            .max_connections(50)
            .min_connections(5)
            .acquire_timeout(Duration::from_secs(30))
            .connect(database_url)
            .await?;

        tracing::info!("Database connected successfully");

        Ok(Self { pool })
    }

    pub async fn migrate(&self) -> anyhow::Result<()> {
        tracing::info!("Running database migrations...");
        sqlx::migrate!("./migrations").run(&self.pool).await?;
        tracing::info!("Migrations completed successfully");
        Ok(())
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }
}
