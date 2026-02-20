use crate::{state::AppState, Route};
use dioxus::prelude::*;

#[component]
pub fn Admin() -> Element {
    let state = use_context::<AppState>();
    let nav = navigator();
    let mut active_tab = use_signal(|| "stats".to_string());
    let mut action_error = use_signal(|| None::<String>);

    let api_client = state.api.clone();
    let stats = use_resource(move || {
        let api = api_client.clone();
        async move { api.admin_get_stats().await }
    });

    let api_client2 = state.api.clone();
    let mut users = use_resource(move || {
        let api = api_client2.clone();
        async move { api.admin_get_users().await }
    });

    let api_client3 = state.api.clone();
    let mut admin_rooms = use_resource(move || {
        let api = api_client3.clone();
        async move { api.admin_get_rooms().await }
    });

    rsx! {
        div {
            class: "min-h-screen bg-gray-900 p-8",
            div {
                class: "max-w-6xl mx-auto",
                div {
                    class: "flex justify-between items-center mb-8",
                    h1 {
                        class: "text-3xl font-bold text-white",
                        "Admin Panel"
                    }
                    button {
                        class: "bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded",
                        onclick: move |_| {
                            nav.push(Route::Chat {});
                        },
                        "Back to Chat"
                    }
                }

                // Error banner
                if let Some(err) = action_error() {
                    div {
                        class: "bg-red-900 text-red-200 p-3 rounded mb-4 flex justify-between items-center",
                        span { "{err}" }
                        button {
                            class: "text-red-300 hover:text-white ml-4",
                            onclick: move |_| action_error.set(None),
                            "X"
                        }
                    }
                }

                // Tab navigation
                div {
                    class: "flex gap-1 mb-6 bg-gray-800 p-1 rounded-lg w-fit",
                    {
                        let tabs = vec![("stats", "Stats"), ("users", "Users"), ("rooms", "Rooms")];
                        rsx! {
                            for (key, label) in tabs {
                                button {
                                    key: "{key}",
                                    class: if active_tab() == key {
                                        "px-4 py-2 rounded text-white bg-purple-600 font-semibold"
                                    } else {
                                        "px-4 py-2 rounded text-gray-400 hover:text-white"
                                    },
                                    onclick: move |_| active_tab.set(key.to_string()),
                                    "{label}"
                                }
                            }
                        }
                    }
                }

                // Stats tab
                if active_tab() == "stats" {
                    if let Some(Ok(stats_data)) = stats.read().as_ref() {
                        div {
                            class: "grid grid-cols-1 md:grid-cols-3 gap-6",
                            div {
                                class: "bg-gray-800 p-6 rounded-lg",
                                h3 {
                                    class: "text-lg font-semibold text-white mb-4",
                                    "Users"
                                }
                                if let Some(user_stats) = stats_data.get("users") {
                                    div {
                                        class: "space-y-2",
                                        div {
                                            class: "flex justify-between text-gray-300",
                                            span { "Total:" }
                                            span { "{user_stats[\"total\"]}" }
                                        }
                                        div {
                                            class: "flex justify-between text-green-400",
                                            span { "Online:" }
                                            span { "{user_stats[\"online\"]}" }
                                        }
                                        div {
                                            class: "flex justify-between text-red-400",
                                            span { "Banned:" }
                                            span { "{user_stats[\"banned\"]}" }
                                        }
                                    }
                                }
                            }

                            div {
                                class: "bg-gray-800 p-6 rounded-lg",
                                h3 {
                                    class: "text-lg font-semibold text-white mb-4",
                                    "Rooms"
                                }
                                if let Some(room_stats) = stats_data.get("rooms") {
                                    div {
                                        class: "space-y-2",
                                        div {
                                            class: "flex justify-between text-gray-300",
                                            span { "Total:" }
                                            span { "{room_stats[\"total\"]}" }
                                        }
                                        div {
                                            class: "flex justify-between text-green-400",
                                            span { "Public:" }
                                            span { "{room_stats[\"public\"]}" }
                                        }
                                    }
                                }
                            }

                            div {
                                class: "bg-gray-800 p-6 rounded-lg",
                                h3 {
                                    class: "text-lg font-semibold text-white mb-4",
                                    "Messages"
                                }
                                if let Some(msg_stats) = stats_data.get("messages") {
                                    div {
                                        class: "space-y-2",
                                        div {
                                            class: "flex justify-between text-gray-300",
                                            span { "Total:" }
                                            span { "{msg_stats[\"total\"]}" }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        div {
                            class: "text-center text-gray-400 py-8",
                            "Loading stats..."
                        }
                    }
                }

                // Users tab
                if active_tab() == "users" {
                    div {
                        class: "bg-gray-800 rounded-lg p-6",
                        h2 {
                            class: "text-2xl font-bold text-white mb-4",
                            "Users"
                        }
                        if let Some(Ok(users_data)) = users.read().as_ref() {
                            div {
                                class: "space-y-2",
                                for user in users_data {
                                    {
                                        let user_id = user.id.to_string();
                                        let username = user.username.clone();
                                        let user_is_admin = user.is_admin;
                                        let user_is_banned = user.is_banned;
                                        let user_is_online = user.is_online;

                                        let api_promote = state.api.clone();
                                        let api_demote = state.api.clone();
                                        let api_ban = state.api.clone();
                                        let api_unban = state.api.clone();
                                        let api_delete = state.api.clone();
                                        let uid_promote = user_id.clone();
                                        let uid_demote = user_id.clone();
                                        let uid_ban = user_id.clone();
                                        let uid_unban = user_id.clone();
                                        let uid_delete = user_id.clone();

                                        rsx! {
                                            div {
                                                key: "{user_id}",
                                                class: "flex items-center justify-between p-4 bg-gray-700 rounded",
                                                div {
                                                    class: "flex items-center gap-3",
                                                    div {
                                                        class: if user_is_online { "w-3 h-3 bg-green-500 rounded-full" } else { "w-3 h-3 bg-gray-500 rounded-full" }
                                                    }
                                                    div {
                                                        div {
                                                            class: "text-white font-semibold",
                                                            "{username}"
                                                        }
                                                        div {
                                                            class: "text-sm text-gray-400",
                                                            if user_is_admin { "Admin" } else { "User" }
                                                        }
                                                    }
                                                    if user_is_banned {
                                                        span {
                                                            class: "bg-red-600 text-white px-2 py-0.5 rounded text-xs",
                                                            "Banned"
                                                        }
                                                    }
                                                }
                                                div {
                                                    class: "flex gap-1",
                                                    // Promote / Demote
                                                    if user_is_admin {
                                                        button {
                                                            class: "bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs",
                                                            onclick: move |_| {
                                                                let api = api_demote.clone();
                                                                let uid = uid_demote.clone();
                                                                spawn(async move {
                                                                    if let Err(e) = api.admin_demote_user(&uid).await {
                                                                        action_error.set(Some(e));
                                                                    }
                                                                    users.restart();
                                                                });
                                                            },
                                                            "Demote"
                                                        }
                                                    } else {
                                                        button {
                                                            class: "bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs",
                                                            onclick: move |_| {
                                                                let api = api_promote.clone();
                                                                let uid = uid_promote.clone();
                                                                spawn(async move {
                                                                    if let Err(e) = api.admin_promote_user(&uid).await {
                                                                        action_error.set(Some(e));
                                                                    }
                                                                    users.restart();
                                                                });
                                                            },
                                                            "Promote"
                                                        }
                                                    }
                                                    // Ban / Unban
                                                    if user_is_banned {
                                                        button {
                                                            class: "bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs",
                                                            onclick: move |_| {
                                                                let api = api_unban.clone();
                                                                let uid = uid_unban.clone();
                                                                spawn(async move {
                                                                    if let Err(e) = api.admin_unban_user(&uid).await {
                                                                        action_error.set(Some(e));
                                                                    }
                                                                    users.restart();
                                                                });
                                                            },
                                                            "Unban"
                                                        }
                                                    } else {
                                                        button {
                                                            class: "bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded text-xs",
                                                            onclick: move |_| {
                                                                let api = api_ban.clone();
                                                                let uid = uid_ban.clone();
                                                                spawn(async move {
                                                                    if let Err(e) = api.admin_ban_user(&uid).await {
                                                                        action_error.set(Some(e));
                                                                    }
                                                                    users.restart();
                                                                });
                                                            },
                                                            "Ban"
                                                        }
                                                    }
                                                    // Delete
                                                    button {
                                                        class: "bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs",
                                                        onclick: move |_| {
                                                            let api = api_delete.clone();
                                                            let uid = uid_delete.clone();
                                                            spawn(async move {
                                                                if let Err(e) = api.admin_delete_user(&uid).await {
                                                                    action_error.set(Some(e));
                                                                }
                                                                users.restart();
                                                            });
                                                        },
                                                        "Delete"
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            div {
                                class: "text-center text-gray-400 py-8",
                                "Loading users..."
                            }
                        }
                    }
                }

                // Rooms tab
                if active_tab() == "rooms" {
                    div {
                        class: "bg-gray-800 rounded-lg p-6",
                        h2 {
                            class: "text-2xl font-bold text-white mb-4",
                            "Rooms"
                        }
                        if let Some(Ok(rooms_data)) = admin_rooms.read().as_ref() {
                            div {
                                class: "space-y-2",
                                for room in rooms_data {
                                    {
                                        let room_id = room["id"].as_str().unwrap_or("").to_string();
                                        let room_name = room["name"].as_str().unwrap_or("?").to_string();
                                        let is_public = room["isPublic"].as_bool().unwrap_or(false);
                                        let member_count = room.get("memberCount")
                                            .or_else(|| room.get("member_count"))
                                            .and_then(|v| v.as_i64())
                                            .unwrap_or(0);
                                        let message_count = room.get("messageCount")
                                            .or_else(|| room.get("message_count"))
                                            .and_then(|v| v.as_i64())
                                            .unwrap_or(0);
                                        let creator = room.get("creatorName")
                                            .or_else(|| room.get("creator_name"))
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("unknown")
                                            .to_string();

                                        let api_del = state.api.clone();
                                        let rid_del = room_id.clone();

                                        rsx! {
                                            div {
                                                key: "{room_id}",
                                                class: "flex items-center justify-between p-4 bg-gray-700 rounded",
                                                div {
                                                    class: "flex items-center gap-3",
                                                    div {
                                                        div {
                                                            class: "text-white font-semibold flex items-center gap-2",
                                                            "{room_name}"
                                                            span {
                                                                class: if is_public {
                                                                    "text-xs bg-green-700 text-green-200 px-2 py-0.5 rounded"
                                                                } else {
                                                                    "text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded"
                                                                },
                                                                if is_public { "Public" } else { "Private" }
                                                            }
                                                        }
                                                        div {
                                                            class: "text-sm text-gray-400",
                                                            "by {creator} | {member_count} members | {message_count} messages"
                                                        }
                                                    }
                                                }
                                                button {
                                                    class: "bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs",
                                                    onclick: move |_| {
                                                        let api = api_del.clone();
                                                        let rid = rid_del.clone();
                                                        spawn(async move {
                                                            if let Err(e) = api.admin_delete_room(&rid).await {
                                                                action_error.set(Some(e));
                                                            }
                                                            admin_rooms.restart();
                                                        });
                                                    },
                                                    "Delete"
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            div {
                                class: "text-center text-gray-400 py-8",
                                "Loading rooms..."
                            }
                        }
                    }
                }
            }
        }
    }
}
