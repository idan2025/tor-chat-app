use crate::{state::AppState, utils, utils::storage, Route};
use dioxus::prelude::*;

#[component]
pub fn Chat() -> Element {
    let state = use_context::<AppState>();
    let nav = navigator();
    let mut selected_room_idx = use_signal(|| None::<usize>);
    let mut message_input = use_signal(String::new);
    let mut loading = use_signal(|| true);
    let mut error_msg = use_signal(|| None::<String>);

    // Auth guard - check token exists, redirect if not
    let has_token = storage::get_token().is_some();

    // Clone state for each closure that needs it
    let state_for_effect = state.clone();
    let state_for_send = state.clone();
    let state_for_logout = state.clone();
    let state_for_rooms = state.clone();

    use_effect(move || {
        if !has_token {
            nav.push(Route::Login {});
            return;
        }

        let state = state_for_effect.clone();
        spawn(async move {
            match state.load_rooms().await {
                Ok(()) => {
                    loading.set(false);
                }
                Err(e) => {
                    tracing::error!("Failed to load rooms: {}", e);
                    if e.contains("401")
                        || e.contains("Unauthorized")
                        || e.contains("unauthorized")
                    {
                        storage::remove_token();
                        nav.push(Route::Login {});
                    } else {
                        error_msg.set(Some(format!("Failed to load rooms: {}", e)));
                        loading.set(false);
                    }
                }
            }
        });
    });

    let on_send = move |_| {
        let rooms = state_for_send.rooms.read();
        let selected = selected_room_idx();
        if let Some(idx) = selected {
            if let Some(room) = rooms.get(idx) {
                let content = message_input();
                if !content.is_empty() {
                    let room_id = room.id.to_string();
                    let state = state_for_send.clone();
                    spawn(async move {
                        state.socket.send_message(&room_id, &content).await;
                        message_input.set(String::new());
                    });
                }
            }
        }
    };

    let on_logout = move |_| {
        let state = state_for_logout.clone();
        spawn(async move {
            state.clear_auth().await;
            nav.push(Route::Login {});
        });
    };

    if !has_token {
        return rsx! {
            div {
                class: "flex items-center justify-center min-h-screen bg-gray-900",
                p { class: "text-gray-400", "Redirecting to login..." }
            }
        };
    }

    let rooms = state.rooms.read();
    let messages = state.messages.read();

    // Get selected room info
    let selected_room = selected_room_idx().and_then(|idx| rooms.get(idx).cloned());

    rsx! {
        div {
            class: "flex h-screen bg-gray-900",

            // Sidebar
            div {
                class: "w-64 bg-gray-800 border-r border-gray-700 flex flex-col",
                div {
                    class: "p-4 border-b border-gray-700",
                    h1 {
                        class: "text-xl font-bold text-white",
                        "TOR Chat"
                    }
                }

                div {
                    class: "flex-1 overflow-y-auto",
                    if loading() {
                        div {
                            class: "p-4 text-center text-gray-400",
                            "Loading rooms..."
                        }
                    } else if let Some(err) = error_msg() {
                        div {
                            class: "p-4 text-center text-red-400 text-sm",
                            "{err}"
                        }
                    } else if rooms.is_empty() {
                        div {
                            class: "p-4 text-center text-gray-400",
                            "No rooms available"
                        }
                    } else {
                        for (idx, room) in rooms.iter().enumerate() {
                            {
                                let room_name = room.name.clone();
                                let room_desc = room.description.clone();
                                let room_id = room.id.to_string();
                                let is_selected = selected_room_idx() == Some(idx);
                                let state = state_for_rooms.clone();
                                rsx! {
                                    div {
                                        key: "{room_id}",
                                        class: if is_selected {
                                            "p-4 bg-gray-700 cursor-pointer border-b border-gray-700"
                                        } else {
                                            "p-4 hover:bg-gray-700 cursor-pointer border-b border-gray-700"
                                        },
                                        onclick: move |_| {
                                            selected_room_idx.set(Some(idx));
                                            let state = state.clone();
                                            let rid = room_id.clone();
                                            spawn(async move {
                                                state.socket.join_room(&rid).await;
                                                let _ = state.load_messages(&rid).await;
                                            });
                                        },
                                        div {
                                            class: "font-semibold text-white",
                                            "{room_name}"
                                        }
                                        if let Some(desc) = &room_desc {
                                            div {
                                                class: "text-sm text-gray-400 truncate",
                                                "{desc}"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                div {
                    class: "p-4 border-t border-gray-700",
                    button {
                        class: "w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded",
                        onclick: on_logout,
                        "Logout"
                    }
                }
            }

            // Chat area
            div {
                class: "flex-1 flex flex-col",
                if let Some(room) = &selected_room {
                    div {
                        class: "p-4 border-b border-gray-700 bg-gray-800",
                        h2 {
                            class: "text-xl font-bold text-white",
                            "{room.name}"
                        }
                        if let Some(desc) = &room.description {
                            p {
                                class: "text-sm text-gray-400",
                                "{desc}"
                            }
                        }
                    }

                    // Messages
                    div {
                        class: "flex-1 overflow-y-auto p-4",
                        if messages.is_empty() {
                            div {
                                class: "text-center text-gray-400 mt-4",
                                "No messages yet. Start the conversation!"
                            }
                        } else {
                            for message in messages.iter().rev() {
                                div {
                                    key: "{message.id}",
                                    class: "mb-4",
                                    div {
                                        class: "bg-gray-800 rounded-lg p-3 max-w-md",
                                        if let Some(user) = &message.user {
                                            div {
                                                class: "text-sm font-bold text-purple-400 mb-1",
                                                "{user.username}"
                                            }
                                        }
                                        div {
                                            class: "text-white",
                                            "{message.content}"
                                        }
                                        div {
                                            class: "text-xs text-gray-400 mt-1",
                                            "{utils::format_time(&message.created_at)}"
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Input
                    div {
                        class: "p-4 border-t border-gray-700 bg-gray-800",
                        form {
                            onsubmit: on_send,
                            class: "flex gap-2",
                            input {
                                r#type: "text",
                                class: "flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500",
                                placeholder: "Type a message...",
                                value: "{message_input}",
                                oninput: move |e| message_input.set(e.value().clone()),
                            }
                            button {
                                r#type: "submit",
                                class: "bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg",
                                "Send"
                            }
                        }
                    }
                } else {
                    div {
                        class: "flex-1 flex items-center justify-center",
                        p {
                            class: "text-gray-400 text-lg",
                            if loading() {
                                "Loading..."
                            } else {
                                "Select a room to start chatting"
                            }
                        }
                    }
                }
            }
        }
    }
}
