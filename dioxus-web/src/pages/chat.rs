use crate::{models::Room, state::AppState, utils, Route};
use dioxus::prelude::*;
use dioxus_router::prelude::navigator;

#[component]
pub fn Chat() -> Element {
    let mut state = use_context::<AppState>();
    let nav = navigator();
    let mut selected_room = use_signal(|| None::<Room>);
    let mut message_input = use_signal(|| String::new());

    use_effect(move || {
        spawn(async move {
            if let Err(_) = state.load_rooms().await {
                nav.push(Route::Login {});
            }
        });
    });

    let rooms = use_resource(|| async move { state.rooms.read().unwrap().clone() });

    let messages = use_resource(|| async move { state.messages.read().unwrap().clone() });

    let on_send = move |_| {
        if let Some(room) = selected_room() {
            let content = message_input();
            if !content.is_empty() {
                spawn(async move {
                    state
                        .socket
                        .send_message(&room.id.to_string(), &content)
                        .await;
                    message_input.set(String::new());
                });
            }
        }
    };

    let on_logout = move |_| {
        spawn(async move {
            state.clear_auth().await;
            nav.push(Route::Login {});
        });
    };

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
                    if let Some(rooms_data) = rooms.read().as_ref() {
                        for room in rooms_data {
                            div {
                                key: "{room.id}",
                                class: "p-4 hover:bg-gray-700 cursor-pointer border-b border-gray-700",
                                onclick: move |_| {
                                    let r = room.clone();
                                    spawn(async move {
                                        selected_room.set(Some(r.clone()));
                                        state.socket.join_room(&r.id.to_string()).await;
                                        let _ = state.load_messages(&r.id.to_string()).await;
                                    });
                                },
                                div {
                                    class: "font-semibold text-white",
                                    "{room.name}"
                                }
                                if let Some(desc) = &room.description {
                                    div {
                                        class: "text-sm text-gray-400 truncate",
                                        "{desc}"
                                    }
                                }
                            }
                        }
                    } else {
                        div {
                            class: "p-4 text-center text-gray-400",
                            "Loading rooms..."
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
                if let Some(room) = selected_room() {
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
                        if let Some(msgs) = messages.read().as_ref() {
                            for message in msgs.iter().rev() {
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
                            prevent_default: "onsubmit",
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
                            "Select a room to start chatting"
                        }
                    }
                }
            }
        }
    }
}
