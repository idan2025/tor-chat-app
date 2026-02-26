use crate::{components::message_bubble::MessageBubble, state::AppState, utils::storage, Route};
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
    // Add member modal state
    let mut show_add_member_modal = use_signal(|| false);
    let mut all_users: Signal<Vec<serde_json::Value>> = use_signal(Vec::new);
    let mut add_member_search = use_signal(String::new);
    let mut add_member_error = use_signal(|| None::<String>);
    // File upload state
    let mut selected_file: Signal<Option<(String, Vec<u8>)>> = use_signal(|| None);
    let mut upload_status = use_signal(|| None::<String>);
    let mut is_uploading = use_signal(|| false);
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

            // Set up real-time event handler and connect socket
            if !state.socket.is_connected() {
                let messages_sig = state.messages;
                let rooms_sig = state.rooms;
                state
                    .socket
                    .set_event_handler(move |event: &str, payload: serde_json::Value| {
                        match event {
                            "new_message" => {
                                match serde_json::from_value::<crate::models::Message>(payload) {
                                    Ok(msg) => {
                                        let mut sig = messages_sig;
                                        let mut msgs = sig.write();
                                        // Avoid duplicates
                                        if !msgs.iter().any(|m| m.id == msg.id) {
                                            msgs.push(msg);
                                        }
                                    }
                                    Err(e) => {
                                        tracing::error!("Failed to parse new_message: {}", e)
                                    }
                                }
                            }
                            "room_created" => {
                                match serde_json::from_value::<crate::models::Room>(payload) {
                                    Ok(room) => {
                                        let mut sig = rooms_sig;
                                        let mut rooms = sig.write();
                                        if !rooms.iter().any(|r| r.id == room.id) {
                                            rooms.push(room);
                                        }
                                    }
                                    Err(e) => {
                                        tracing::error!("Failed to parse room_created: {}", e)
                                    }
                                }
                            }
                            "room_deleted" => {
                                if let Some(room_id_str) =
                                    payload.get("roomId").and_then(|v| v.as_str())
                                {
                                    if let Ok(room_id) = uuid::Uuid::parse_str(room_id_str) {
                                        let mut sig = rooms_sig;
                                        sig.write().retain(|r| r.id != room_id);
                                    }
                                }
                            }
                            _ => {
                                tracing::debug!("Unhandled socket event: {}", event);
                            }
                        }
                    });

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
                        match state.api.send_message(&room_id, &content).await {
                            Ok(_) => {
                                message_input.set(String::new());
                                let _ = state.load_messages(&room_id).await;
                            }
                            Err(e) => {
                                tracing::error!("Failed to send message: {}", e);
                                error_msg.set(Some(format!("Send failed: {}", e)));
                            }
                        }
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
                            new_room_public.set(is_admin);
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
                                let room_is_public = room.is_public;
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
                                            class: "flex items-center gap-2",
                                            div {
                                                class: "font-semibold text-white",
                                                "{room_name}"
                                            }
                                            span {
                                                class: if room_is_public {
                                                    "text-xs px-1.5 py-0.5 rounded bg-green-800 text-green-300"
                                                } else {
                                                    "text-xs px-1.5 py-0.5 rounded bg-yellow-800 text-yellow-300"
                                                },
                                                if room_is_public { "Public" } else { "Private" }
                                            }
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
                    a {
                        class: "block w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded text-center",
                        href: "https://github.com/idan2025/tor-chat-app/releases/latest",
                        target: "_blank",
                        "Download Apps"
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
                                for message in messages.iter() {
                                    MessageBubble {
                                        key: "{message.id}",
                                        message: message.clone(),
                                    }
                                }
                            }
                        }

                        // Members side panel
                        if show_members() {
                            div {
                                class: "w-56 border-l border-gray-700 bg-gray-800 overflow-y-auto",
                                div {
                                    class: "p-3 border-b border-gray-700 flex items-center justify-between",
                                    h3 {
                                        class: "text-white font-semibold text-sm",
                                        "Members"
                                    }
                                    if is_room_creator || is_admin {
                                        {
                                            let api = state.api.clone();
                                            rsx! {
                                                button {
                                                    class: "text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded",
                                                    onclick: move |_| {
                                                        show_add_member_modal.set(true);
                                                        add_member_error.set(None);
                                                        add_member_search.set(String::new());
                                                        let api = api.clone();
                                                        spawn(async move {
                                                            match api.get_users().await {
                                                                Ok(users) => all_users.set(users),
                                                                Err(e) => tracing::error!("Failed to load users: {}", e),
                                                            }
                                                        });
                                                    },
                                                    "+ Add"
                                                }
                                            }
                                        }
                                    }
                                }
                                for member in members.read().iter() {
                                    {
                                        let member_user_id = member["userId"].as_str().unwrap_or("").to_string();
                                        let user = &member["user"];
                                        let is_online = user["isOnline"].as_bool().unwrap_or(false);
                                        let username = user["username"].as_str().unwrap_or("?").to_string();
                                        let member_is_admin = member["role"].as_str() == Some("admin");
                                        let is_creator = selected_room.as_ref()
                                            .and_then(|r| r.creator_id)
                                            .map(|c| c.to_string() == member_user_id)
                                            .unwrap_or(false);
                                        let can_remove = (is_room_creator || is_admin)
                                            && !is_creator
                                            && current_user_id.map(|u| u.to_string() != member_user_id).unwrap_or(false);
                                        let room_id_for_remove = selected_room.as_ref().map(|r| r.id.to_string()).unwrap_or_default();
                                        let api_for_remove = state.api.clone();
                                        let api_for_refresh = state.api.clone();
                                        let rid_for_refresh = room_id_for_remove.clone();
                                        let member_uid = member_user_id.clone();
                                        rsx! {
                                            div {
                                                class: "p-3 border-b border-gray-700 flex items-center gap-2",
                                                div {
                                                    class: if is_online {
                                                        "w-2 h-2 bg-green-500 rounded-full flex-shrink-0"
                                                    } else {
                                                        "w-2 h-2 bg-gray-500 rounded-full flex-shrink-0"
                                                    },
                                                }
                                                div {
                                                    class: "flex-1 min-w-0",
                                                    div {
                                                        class: "text-white text-sm truncate",
                                                        "{username}"
                                                    }
                                                    if member_is_admin {
                                                        span {
                                                            class: "text-xs text-purple-400",
                                                            "Admin"
                                                        }
                                                    }
                                                }
                                                if can_remove {
                                                    button {
                                                        class: "text-xs text-red-400 hover:text-red-300 flex-shrink-0",
                                                        onclick: move |_| {
                                                            let api = api_for_remove.clone();
                                                            let rid = room_id_for_remove.clone();
                                                            let uid = member_uid.clone();
                                                            let api_refresh = api_for_refresh.clone();
                                                            let rid_refresh = rid_for_refresh.clone();
                                                            spawn(async move {
                                                                match api.remove_room_member(&rid, &uid).await {
                                                                    Ok(()) => {
                                                                        // Refresh members list
                                                                        if let Ok(m) = api_refresh.get_room_members(&rid_refresh).await {
                                                                            members.set(m);
                                                                        }
                                                                    }
                                                                    Err(e) => tracing::error!("Failed to remove member: {}", e),
                                                                }
                                                            });
                                                        },
                                                        "Remove"
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
                        // File upload status
                        {
                            let status = upload_status();
                            if let Some(msg) = status {
                                rsx! {
                                    div {
                                        class: if msg.starts_with("Error") {
                                            "mb-2 text-sm text-red-400"
                                        } else {
                                            "mb-2 text-sm text-green-400"
                                        },
                                        "{msg}"
                                    }
                                }
                            } else {
                                rsx! {}
                            }
                        }
                        // Message input form
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
                        // File upload section
                        div {
                            class: "mt-2 flex items-center gap-2",
                            input {
                                r#type: "file",
                                class: "text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-white hover:file:bg-gray-600",
                                accept: "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.gz,.7z,.rar",
                                onchange: move |evt| {
                                    let files = evt.files();
                                    if let Some(file_data) = files.first() {
                                        let file_data = file_data.clone();
                                        spawn(async move {
                                            match file_data.read_bytes().await {
                                                Ok(bytes) => {
                                                    let file_name = file_data.name();
                                                    selected_file.set(Some((file_name.clone(), bytes.to_vec())));
                                                    upload_status.set(Some(format!("Selected: {}", file_name)));
                                                }
                                                Err(e) => {
                                                    upload_status.set(Some(format!("Error reading file: {}", e)));
                                                }
                                            }
                                        });
                                    }
                                },
                            }
                            // Send File button (only shown when file is selected)
                            {
                                let file_opt = selected_file();
                                if file_opt.is_some() && !is_uploading() {
                                    let file = file_opt.unwrap();
                                    let state_upload = state.clone();
                                    let selected_room = selected_room.clone();
                                    rsx! {
                                        button {
                                            class: "bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm",
                                            onclick: move |_| {
                                                if let Some(room) = &selected_room {
                                                    let file = file.clone();
                                                    let room_id = room.id.to_string();
                                                    let state = state_upload.clone();
                                                    spawn(async move {
                                                        is_uploading.set(true);
                                                        upload_status.set(Some("Uploading...".to_string()));

                                                        let (filename, file_bytes) = file;
                                                        match state.api.upload_file(file_bytes, &filename).await {
                                                            Ok(response) => {
                                                                if let Some(file_url) = response.get("file")
                                                                    .and_then(|f| f.get("url"))
                                                                    .and_then(|u| u.as_str()) {
                                                                    // Send the file URL as an image message
                                                                    match state.api.send_image_message(&room_id, file_url).await {
                                                                        Ok(_) => {
                                                                            upload_status.set(Some("Upload complete!".to_string()));
                                                                            selected_file.set(None);
                                                                            // Refresh messages
                                                                            let _ = state.load_messages(&room_id).await;
                                                                        }
                                                                        Err(e) => {
                                                                            upload_status.set(Some(format!("Error sending: {}", e)));
                                                                        }
                                                                    }
                                                                } else {
                                                                    upload_status.set(Some("Error: Invalid response".to_string()));
                                                                }
                                                            }
                                                            Err(e) => {
                                                                upload_status.set(Some(format!("Error uploading: {}", e)));
                                                            }
                                                        }
                                                        is_uploading.set(false);
                                                    });
                                                }
                                            },
                                            "Send File"
                                        }
                                    }
                                } else {
                                    rsx! {}
                                }
                            }
                            // Clear selection button
                            {
                                if selected_file().is_some() && !is_uploading() {
                                    rsx! {
                                        button {
                                            class: "bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm",
                                            onclick: move |_| {
                                                selected_file.set(None);
                                                upload_status.set(None);
                                            },
                                            "Cancel"
                                        }
                                    }
                                } else {
                                    rsx! {}
                                }
                            }
                            // Loading indicator
                            {
                                if is_uploading() {
                                    rsx! {
                                        div {
                                            class: "text-sm text-gray-400",
                                            "Uploading..."
                                        }
                                    }
                                } else {
                                    rsx! {}
                                }
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

            // Add Member Modal
            if show_add_member_modal() {
                div {
                    class: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
                    onclick: move |_| show_add_member_modal.set(false),
                    div {
                        class: "bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4 max-h-[80vh] flex flex-col",
                        onclick: move |e| e.stop_propagation(),
                        h2 {
                            class: "text-xl font-bold text-white mb-4",
                            "Add Members"
                        }
                        if let Some(err) = add_member_error() {
                            div {
                                class: "bg-red-900 text-red-200 p-2 rounded mb-4 text-sm",
                                "{err}"
                            }
                        }
                        input {
                            r#type: "text",
                            class: "w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-purple-500 mb-4",
                            placeholder: "Search users...",
                            value: "{add_member_search}",
                            oninput: move |e| add_member_search.set(e.value().clone()),
                        }
                        div {
                            class: "flex-1 overflow-y-auto space-y-2",
                            {
                                let search = add_member_search().to_lowercase();
                                let member_ids: Vec<String> = members.read().iter()
                                    .filter_map(|m| m["userId"].as_str().map(|s| s.to_string()))
                                    .collect();
                                let filtered: Vec<_> = all_users.read().iter()
                                    .filter(|u| {
                                        let uid = u["id"].as_str().unwrap_or("");
                                        let uname = u["username"].as_str().unwrap_or("").to_lowercase();
                                        !member_ids.contains(&uid.to_string()) &&
                                        (search.is_empty() || uname.contains(&search))
                                    })
                                    .cloned()
                                    .collect();
                                rsx! {
                                    if filtered.is_empty() {
                                        p {
                                            class: "text-gray-400 text-sm text-center py-4",
                                            "No users to add"
                                        }
                                    } else {
                                        for user in filtered {
                                            {
                                                let uid = user["id"].as_str().unwrap_or("").to_string();
                                                let uname = user["username"].as_str().unwrap_or("?").to_string();
                                                let display = user["displayName"].as_str().map(|s| s.to_string());
                                                let api = state.api.clone();
                                                let room_id = selected_room.as_ref().map(|r| r.id.to_string()).unwrap_or_default();
                                                let api_refresh = state.api.clone();
                                                let rid_refresh = room_id.clone();
                                                rsx! {
                                                    div {
                                                        class: "flex items-center justify-between p-2 rounded bg-gray-700",
                                                        div {
                                                            div {
                                                                class: "text-white text-sm",
                                                                "{uname}"
                                                            }
                                                            if let Some(dn) = &display {
                                                                div {
                                                                    class: "text-xs text-gray-400",
                                                                    "{dn}"
                                                                }
                                                            }
                                                        }
                                                        button {
                                                            class: "bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1 rounded",
                                                            onclick: move |_| {
                                                                let api = api.clone();
                                                                let rid = room_id.clone();
                                                                let uid = uid.clone();
                                                                let api_refresh = api_refresh.clone();
                                                                let rid_refresh = rid_refresh.clone();
                                                                spawn(async move {
                                                                    match api.add_room_member(&rid, &uid).await {
                                                                        Ok(()) => {
                                                                            // Refresh members list
                                                                            if let Ok(m) = api_refresh.get_room_members(&rid_refresh).await {
                                                                                members.set(m);
                                                                            }
                                                                        }
                                                                        Err(e) => add_member_error.set(Some(e)),
                                                                    }
                                                                });
                                                            },
                                                            "Add"
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        button {
                            class: "mt-4 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded",
                            onclick: move |_| show_add_member_modal.set(false),
                            "Close"
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
