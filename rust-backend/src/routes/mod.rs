pub mod admin;
pub mod auth;
pub mod rooms;
pub mod tor;
pub mod upload;

// Re-export specific functions to avoid ambiguity
pub use auth::{list_users, login, logout, me, register};
pub use rooms::{
    add_member, create_room, delete_room, get_members, get_messages, get_room, join_room,
    leave_room, list_rooms, remove_member, search_messages,
};
pub use tor::get_status;
pub use upload::upload_file;
