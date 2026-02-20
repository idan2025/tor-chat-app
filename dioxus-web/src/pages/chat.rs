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

    // Create room modal state
    let mut show_create_modal = use_signal(|| false);
    let mut new_room_name = use_signal(String::new);
    let mut new_room_desc = use_signal(String::new);
    let mut new_room_public = use_signal(|| false);
    let mut create_error = use_signal(|| None::<String>);

    // Members panel state
    let mut show_members = use_signal(|| false);
    let mut members: Signal<Vec<serde_json::Value>> = use_signal(Vec::new);

    // Auth guard
    let has_token = storage::get_token().is_some();

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
            // Load current user for admin checks
            match state.api.get_me().await {
                Ok(user) => state.set_current_user(user),
                Err(e) => {
                    tracing::error!("Failed to get current user: {}", e);
                    if e.contains("401") || e.contains("Unauthorized") {
                        storage::remove_token();
                        nav.push(Route::Login {});
                        return;
                    }
                }
            }

            // Connect socket if not already connected
            if !state.socket.is_connected() {
                if let Some(token) = storage::get_token() {
                    state.socket.connect(&token).await;
                }
            }

            match state.load_rooms().await {
                Ok(()) => {
                    loading.set(false);
                }
                Err(e) => {
                    tracing::error!("Failed to load rooms: {}", e);
                    if e.contains("401") || e.contains("Unauthorized") || e.contains("unauthorized")
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

    let on_send = move |e: Event<FormData>| {
        e.prevent_default();
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
                        // Reload messages from API to show the sent message
                        let _ = state.load_messages(&room_id).await;
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
    let current_user = state.current_user.read();

    let is_admin = current_user.as_ref().is_some_and(|u| u.is_admin);
    let current_user_id = current_user.as_ref().map(|u| u.id);

    // Get selected room info
    let selected_room = selected_room_idx().and_then(|idx| rooms.get(idx).cloned());

    // Check if current user is room creator
    let is_room_creator = selected_room
        .as_ref()
        .and_then(|r| r.creator_id)
        .zip(current_user_id)
        .is_some_and(|(creator, user)| creator == user);

    let can_delete_room = is_room_creator || is_admin;

    rsx! {
        div {
            class: "flex h-screen bg-gray-900",

            // Sidebar
            div {
                class: "w-64 bg-gray-800 border-r border-gray-700 flex flex-col",
                div {
                    class: "p-4 border-b border-gray-700 flex items-center justify-between",
                    h1 {
                        class: "text-xl font-bold text-white",
                        "TOR Chat"
                    }
                    button {
                        class: "w-8 h-8 bg-purple-600 hover:bg-purple-700 text-white rounded-full text-lg font-bold flex items-center justify-center",
                        title: "Create Room",
                        onclick: move |_| {
                            show_create_modal.set(true);
                            create_error.set(None);
                            new_room_name.set(String::new());
                            new_room_desc.set(String::new());
                            new_room_public.set(false);
                        },
                        "+"
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
                                            show_members.set(false);
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

                // Sidebar footer
                div {
                    class: "p-4 border-t border-gray-700 space-y-2",
                    if is_admin {
                        button {
                            class: "w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded",
                            onclick: move |_| {
                                nav.push(Route::Admin {});
                            },
                            "Admin Panel"
                        }
                    }
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
                    // Chat header with room actions
                    div {
                        class: "p-4 border-b border-gray-700 bg-gray-800 flex items-center justify-between",
                        div {
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
                        div {
                            class: "flex gap-2",
                            // Members button
                            {
                                let room_id = room.id.to_string();
                                let api = state.api.clone();
                                rsx! {
                                    button {
                                        class: "bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm",
                                        onclick: move |_| {
                                            let is_showing = show_members();
                                            show_members.set(!is_showing);
                                            if !is_showing {
                                                let api = api.clone();
                                                let rid = room_id.clone();
                                                spawn(async move {
                                                    match api.get_room_members(&rid).await {
                                                        Ok(m) => members.set(m),
                                                        Err(e) => tracing::error!("Failed to load members: {}", e),
                                                    }
                                                });
                                            }
                                        },
                                        "Members"
                                    }
                                }
                            }
                            // Leave button (hidden for room creator)
                            if !is_room_creator {
                                {
                                    let room_id = room.id.to_string();
                                    let state_leave = state.clone();
                                    rsx! {
                                        button {
                                            class: "bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm",
                                            onclick: move |_| {
                                                let state = state_leave.clone();
                                                let rid = room_id.clone();
                                                spawn(async move {
                                                    match state.api.leave_room(&rid).await {
                                                        Ok(()) => {
                                                            selected_room_idx.set(None);
                                                            let _ = state.load_rooms().await;
                                                        }
                                                        Err(e) => tracing::error!("Failed to leave room: {}", e),
                                                    }
                                                });
                                            },
                                            "Leave"
                                        }
                                    }
                                }
                            }
                            // Delete button (creator or admin only)
                            if can_delete_room {
                                {
                                    let room_id = room.id.to_string();
                                    let state_del = state.clone();
                                    rsx! {
                                        button {
                                            class: "bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm",
                                            onclick: move |_| {
                                                let state = state_del.clone();
                                                let rid = room_id.clone();
                                                spawn(async move {
                                                    match state.api.delete_room(&rid).await {
                                                        Ok(()) => {
                                                            selected_room_idx.set(None);
                                                            let _ = state.load_rooms().await;
                                                        }
                                                        Err(e) => tracing::error!("Failed to delete room: {}", e),
                                                    }
                                                });
                                            },
                                            "Delete"
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Main content area (messages + optional members panel)
                    div {
                        class: "flex-1 flex overflow-hidden",

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

                        // Members side panel
                        if show_members() {
                            div {
                                class: "w-56 border-l border-gray-700 bg-gray-800 overflow-y-auto",
                                div {
                                    class: "p-3 border-b border-gray-700",
                                    h3 {
                                        class: "text-white font-semibold text-sm",
                                        "Members"
                                    }
                                }
                                for member in members.read().iter() {
                                    div {
                                        class: "p-3 border-b border-gray-700 flex items-center gap-2",
                                        {
                                            let user = &member["user"];
                                            let is_online = user["isOnline"].as_bool().unwrap_or(false);
                                            let username = user["username"].as_str().unwrap_or("?").to_string();
                                            let is_admin = user["isAdmin"].as_bool().unwrap_or(false);
                                            rsx! {
                                        div {
                                            class: if is_online {
                                                "w-2 h-2 bg-green-500 rounded-full"
                                            } else {
                                                "w-2 h-2 bg-gray-500 rounded-full"
                                            },
                                        }
                                        div {
                                            div {
                                                class: "text-white text-sm",
                                                "{username}"
                                            }
                                            if is_admin {
                                                span {
                                                    class: "text-xs text-purple-400",
                                                    "Admin"
                                                }
                                            }
                                        }
                                            }
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

            // Create Room Modal
            if show_create_modal() {
                div {
                    class: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
                    onclick: move |_| show_create_modal.set(false),
                    div {
                        class: "bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4",
                        onclick: move |e| e.stop_propagation(),
                        h2 {
                            class: "text-xl font-bold text-white mb-4",
                            "Create Room"
                        }
                        if let Some(err) = create_error() {
                            div {
                                class: "bg-red-900 text-red-200 p-2 rounded mb-4 text-sm",
                                "{err}"
                            }
                        }
                        div {
                            class: "space-y-4",
                            div {
                                label {
                                    class: "block text-sm text-gray-400 mb-1",
                                    "Room Name"
                                }
                                input {
                                    r#type: "text",
                                    class: "w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500",
                                    placeholder: "Enter room name",
                                    value: "{new_room_name}",
                                    oninput: move |e| new_room_name.set(e.value().clone()),
                                }
                            }
                            div {
                                label {
                                    class: "block text-sm text-gray-400 mb-1",
                                    "Description (optional)"
                                }
                                input {
                                    r#type: "text",
                                    class: "w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500",
                                    placeholder: "Enter description",
                                    value: "{new_room_desc}",
                                    oninput: move |e| new_room_desc.set(e.value().clone()),
                                }
                            }
                            if is_admin {
                                div {
                                    class: "flex items-center gap-2",
                                    input {
                                        r#type: "checkbox",
                                        class: "w-4 h-4",
                                        checked: new_room_public(),
                                        onchange: move |e| new_room_public.set(e.checked()),
                                    }
                                    label {
                                        class: "text-sm text-gray-300",
                                        "Public room (visible to all users)"
                                    }
                                }
                            } else {
                                p {
                                    class: "text-xs text-gray-500",
                                    "Room will be private. Only admins can create public rooms."
                                }
                            }
                            div {
                                class: "flex gap-2 pt-2",
                                {
                                    let state_create = state.clone();
                                    rsx! {
                                        button {
                                            class: "flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded",
                                            onclick: move |_| {
                                                let name = new_room_name();
                                                if name.trim().is_empty() {
                                                    create_error.set(Some("Room name is required".to_string()));
                                                    return;
                                                }
                                                let desc = new_room_desc();
                                                let description = if desc.trim().is_empty() { None } else { Some(desc) };
                                                let is_public = new_room_public();
                                                let state = state_create.clone();
                                                spawn(async move {
                                                    match state.api.create_room(name, description, is_public).await {
                                                        Ok(_) => {
                                                            show_create_modal.set(false);
                                                            let _ = state.load_rooms().await;
                                                        }
                                                        Err(e) => create_error.set(Some(e)),
                                                    }
                                                });
                                            },
                                            "Create"
                                        }
                                    }
                                }
                                button {
                                    class: "flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded",
                                    onclick: move |_| show_create_modal.set(false),
                                    "Cancel"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
