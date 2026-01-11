pub mod storage;

use chrono::{DateTime, Utc};

pub fn format_time(dt: &DateTime<Utc>) -> String {
    dt.format("%H:%M").to_string()
}

pub fn format_date(dt: &DateTime<Utc>) -> String {
    dt.format("%Y-%m-%d %H:%M").to_string()
}
