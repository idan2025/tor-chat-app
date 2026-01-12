use crate::{state::AppState, Route};
use dioxus::prelude::*;
use dioxus_router::prelude::navigator;

#[component]
pub fn Admin() -> Element {
    let mut state = use_context::<AppState>();
    let nav = navigator();

    let stats = use_resource(|| async move { state.api.admin_get_stats().await });

    let users = use_resource(|| async move { state.api.admin_get_users().await });

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
                            let nav = nav.clone();
                            nav.push(Route::Chat {});
                        },
                        "Back to Chat"
                    }
                }

                // Stats
                if let Some(Ok(stats_data)) = stats.read().as_ref() {
                    div {
                        class: "grid grid-cols-1 md:grid-cols-3 gap-6 mb-8",
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
                }

                // User list
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
                                div {
                                    key: "{user.id}",
                                    class: "flex items-center justify-between p-4 bg-gray-700 rounded",
                                    div {
                                        class: "flex items-center gap-3",
                                        div {
                                            class: if user.is_online { "w-3 h-3 bg-green-500 rounded-full" } else { "w-3 h-3 bg-gray-500 rounded-full" }
                                        }
                                        div {
                                            div {
                                                class: "text-white font-semibold",
                                                "{user.username}"
                                            }
                                            div {
                                                class: "text-sm text-gray-400",
                                                if user.is_admin { "Admin" } else { "User" }
                                            }
                                        }
                                    }
                                    if user.is_banned {
                                        span {
                                            class: "bg-red-600 text-white px-3 py-1 rounded text-sm",
                                            "Banned"
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
        }
    }
}
