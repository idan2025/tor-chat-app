use crate::{
    components::message_bubble::{DateSeparator, MessageBubble},
    state::AppState,
    utils::{self, storage},
    Route,
};
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
    // Reply state
    let mut reply_to_msg: Signal<Option<crate::models::Message>> = use_signal(|| None);

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
                let current_room_sig = state.current_room;
                state
                    .socket
                    .set_event_handler(move |event: &str, payload: serde_json::Value| {
                        match event {
                            "new_message" => {
                                match serde_json::from_value::<crate::models::Message>(
                                    payload.clone(),
                                ) {
                                    Ok(msg) => {
                                        let mut sig = messages_sig;
                                        let mut msgs = sig.write();
                                        // Avoid duplicates
                                        if !msgs.iter().any(|m| m.id == msg.id) {
                                            msgs.push(msg.clone());
                                        }
                                        drop(msgs);

                                        // Auto-scroll after new message
                                        utils::scroll_to_bottom("messages-container");

                                        // Increment unread count only for rooms NOT currently viewed
                                        if let Some(room_id_str) =
                                            payload.get("roomId").and_then(|v| v.as_str())
                                        {
                                            if let Ok(room_id) = uuid::Uuid::parse_str(room_id_str)
                                            {
                                                let current = current_room_sig.read();
                                                let is_current = current
                                                    .as_ref()
                                                    .is_some_and(|r| r.id == room_id);
                                                if !is_current {
                                                    let mut rsig = rooms_sig;
                                                    let mut rooms = rsig.write();
                                                    if let Some(room) =
                                                        rooms.iter_mut().find(|r| r.id == room_id)
                                                    {
                                                        room.unread_count += 1;
                                                    }
                                                }
                                            }
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
                            "message_pinned" => {
                                if let Some(msg_id_str) =
                                    payload.get("messageId").and_then(|v| v.as_str())
                                {
                                    if let Ok(msg_id) = uuid::Uuid::parse_str(msg_id_str) {
                                        let pinned_by = payload
                                            .get("pinnedBy")
                                            .and_then(|v| v.as_str())
                                            .and_then(|s| uuid::Uuid::parse_str(s).ok());
                                        let pinned_at_str =
                                            payload.get("pinnedAt").and_then(|v| v.as_str());
                                        let pinned_at = pinned_at_str.and_then(|s| {
                                            chrono::DateTime::parse_from_rfc3339(s)
                                                .ok()
                                                .map(|d| d.with_timezone(&chrono::Utc))
                                        });
                                        let mut sig = messages_sig;
                                        let mut msgs = sig.write();
                                        if let Some(m) = msgs.iter_mut().find(|m| m.id == msg_id) {
                                            m.pinned_by = pinned_by;
                                            m.pinned_at = pinned_at;
                                        }
                                    }
                                }
                            }
                            "message_unpinned" => {
                                if let Some(msg_id_str) =
                                    payload.get("messageId").and_then(|v| v.as_str())
                                {
                                    if let Ok(msg_id) = uuid::Uuid::parse_str(msg_id_str) {
                                        let mut sig = messages_sig;
                                        let mut msgs = sig.write();
                                        if let Some(m) = msgs.iter_mut().find(|m| m.id == msg_id) {
                                            m.pinned_by = None;
                                            m.pinned_at = None;
                                        }
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
                    let reply_id = reply_to_msg().map(|m| m.id.to_string());
                    spawn(async move {
                        match state
                            .api
                            .send_message(&room_id, &content, reply_id.as_deref())
                            .await
                        {
                            Ok(_) => {
                                message_input.set(String::new());
                                reply_to_msg.set(None);
                                let _ = state.load_messages(&room_id).await;
                                utils::scroll_to_bottom("messages-container");
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
                class: "flex items-center justify-center min-h-screen bg-dc-chat",
                p { class: "text-dc-text-muted", "Redirecting to login..." }
            }
        };
    }

    let rooms = state.rooms.read();
    let messages = state.messages.read();
    let current_user = state.current_user.read();

    let is_admin = current_user.as_ref().is_some_and(|u| u.is_admin);
    let current_user_id = current_user.as_ref().map(|u| u.id);
    let current_username = current_user
        .as_ref()
        .map(|u| u.username.clone())
        .unwrap_or_default();
    let current_display = current_user
        .as_ref()
        .and_then(|u| u.display_name.clone())
        .unwrap_or_else(|| current_username.clone());

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
            class: "flex h-screen bg-dc-chat",

            // ─── SIDEBAR ───────────────────────────────────────────
            div {
                class: "w-60 bg-dc-sidebar flex flex-col",

                // Server/App header
                div {
                    class: "h-12 px-4 flex items-center border-b border-dc-dark shadow-sm",
                    // Shield icon
                    svg {
                        class: "w-5 h-5 text-dc-accent mr-2 flex-shrink-0",
                        view_box: "0 0 24 24",
                        fill: "currentColor",
                        path {
                            d: "M12 2L3 7v6c0 5.25 3.83 10.13 9 11.27C17.17 23.13 21 18.25 21 13V7l-9-5zm0 2.18l7 3.89v5.93c0 4.23-3.08 8.17-7 9.13-3.92-.96-7-4.9-7-9.13V8.07l7-3.89z"
                        }
                    }
                    h1 {
                        class: "font-semibold text-white text-base truncate",
                        "TOR Chat"
                    }
                    div { class: "flex-1" }
                    button {
                        class: "w-7 h-7 flex items-center justify-center bg-dc-accent hover:bg-dc-accent-dim text-white rounded-md text-lg transition-colors",
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

                // Channel list
                div {
                    class: "flex-1 overflow-y-auto pt-2 px-2",
                    if loading() {
                        div {
                            class: "px-2 py-4 text-center text-dc-text-muted text-sm",
                            "Loading rooms..."
                        }
                    } else if let Some(err) = error_msg() {
                        div {
                            class: "px-2 py-4 text-center text-red-400 text-sm",
                            "{err}"
                        }
                    } else if rooms.is_empty() {
                        div {
                            class: "px-2 py-8 text-center text-dc-text-faint text-sm",
                            "No rooms yet"
                        }
                    } else {
                        for (idx, room) in rooms.iter().enumerate() {
                            {
                                let room_name = room.name.clone();
                                let room_id = room.id.to_string();
                                let room_is_public = room.is_public;
                                let is_selected = selected_room_idx() == Some(idx);
                                let unread = room.unread_count;
                                let state = state_for_rooms.clone();
                                let room_clone = room.clone();
                                rsx! {
                                    div {
                                        key: "{room_id}",
                                        class: if is_selected {
                                            "flex items-center gap-2 px-2.5 py-2 rounded cursor-pointer mb-0.5 bg-dc-hover text-white border-l-2 border-dc-accent"
                                        } else if unread > 0 {
                                            "flex items-center gap-2 px-2.5 py-2 rounded cursor-pointer mb-0.5 hover:bg-dc-hover text-white border-l-2 border-transparent"
                                        } else {
                                            "flex items-center gap-2 px-2.5 py-2 rounded cursor-pointer mb-0.5 hover:bg-dc-hover text-dc-text-muted border-l-2 border-transparent"
                                        },
                                        onclick: move |_| {
                                            selected_room_idx.set(Some(idx));
                                            show_members.set(false);
                                            reply_to_msg.set(None);
                                            // Set current_room signal for unread tracking
                                            {
                                                let mut cr = state.current_room;
                                                cr.set(Some(room_clone.clone()));
                                            }
                                            // Clear unread count for this room
                                            {
                                                let mut rsig = state.rooms;
                                                let mut rooms = rsig.write();
                                                if let Some(r) = rooms.get_mut(idx) {
                                                    r.unread_count = 0;
                                                }
                                            }
                                            let state = state.clone();
                                            let rid = room_id.clone();
                                            spawn(async move {
                                                state.socket.join_room(&rid).await;
                                                let _ = state.load_messages(&rid).await;
                                                // Scroll to bottom after loading
                                                utils::scroll_to_bottom("messages-container");
                                                // Mark read with latest message (now last = newest with ASC)
                                                let msgs = state.messages.read();
                                                if let Some(latest) = msgs.last() {
                                                    state.socket.emit("mark_read", serde_json::json!({
                                                        "roomId": rid,
                                                        "messageId": latest.id.to_string(),
                                                    })).await;
                                                }
                                            });
                                        },
                                        // Channel icon
                                        span {
                                            class: "text-xl leading-none flex-shrink-0 opacity-70",
                                            if room_is_public { "#" } else { "\u{1F512}" }
                                        }
                                        // Channel name
                                        span {
                                            class: if unread > 0 { "flex-1 truncate text-sm font-semibold" } else { "flex-1 truncate text-sm" },
                                            "{room_name}"
                                        }
                                        // Unread badge
                                        if unread > 0 {
                                            span {
                                                class: "bg-dc-accent text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1",
                                                "{unread}"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // ─── USER PANEL ─────────────────────────────────────
                div {
                    class: "h-[56px] bg-dc-dark px-2 flex items-center gap-2",
                    // Avatar with online dot
                    div {
                        class: "relative flex-shrink-0",
                        div {
                            class: "w-8 h-8 rounded-full bg-dc-accent flex items-center justify-center text-white text-xs font-semibold",
                            {
                                let initial = current_username.chars().next().unwrap_or('?').to_uppercase().to_string();
                                rsx! { "{initial}" }
                            }
                        }
                        // Online status dot
                        div {
                            class: "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-dc-green rounded-full border-2 border-dc-dark"
                        }
                    }
                    div {
                        class: "flex-1 min-w-0",
                        div {
                            class: "text-white text-sm font-medium truncate leading-tight",
                            "{current_display}"
                        }
                        div {
                            class: "text-dc-text-faint text-xs truncate leading-tight",
                            "Online"
                        }
                    }
                    // Action buttons
                    if is_admin {
                        button {
                            class: "text-dc-text-muted hover:text-dc-text p-1 rounded hover:bg-dc-hover",
                            title: "Admin Panel",
                            onclick: move |_| { nav.push(Route::Admin {}); },
                            // gear icon
                            "\u{2699}"
                        }
                    }
                    button {
                        class: "text-dc-text-muted hover:text-red-400 p-1 rounded hover:bg-dc-hover",
                        title: "Logout",
                        onclick: on_logout,
                        // power icon
                        "\u{23FB}"
                    }
                }
            }

            // ─── MAIN CHAT AREA ─────────────────────────────────────
            div {
                class: "flex-1 flex flex-col min-w-0",
                if let Some(room) = &selected_room {
                    // ─── CHAT HEADER ────────────────────────────────
                    div {
                        class: "h-12 min-h-[48px] px-4 flex items-center border-b border-dc-border bg-dc-chat shadow-sm",
                        // Channel icon + name
                        span {
                            class: "text-dc-text-muted text-lg mr-1",
                            if room.is_public { "#" } else { "\u{1F512}" }
                        }
                        h2 {
                            class: "font-semibold text-white text-base",
                            "{room.name}"
                        }
                        if let Some(desc) = &room.description {
                            div {
                                class: "mx-3 w-px h-5 bg-dc-border"
                            }
                            p {
                                class: "text-sm text-dc-text-muted truncate flex-1",
                                "{desc}"
                            }
                        }
                        if room.description.is_none() {
                            div { class: "flex-1" }
                        }
                        // Header action buttons
                        div {
                            class: "flex items-center gap-1 ml-2",
                            // Members toggle
                            {
                                let room_id = room.id.to_string();
                                let api = state.api.clone();
                                rsx! {
                                    button {
                                        class: if show_members() {
                                            "p-1.5 rounded text-dc-text hover:bg-dc-hover"
                                        } else {
                                            "p-1.5 rounded text-dc-text-muted hover:bg-dc-hover hover:text-dc-text"
                                        },
                                        title: "Members",
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
                                        "\u{1F465}"
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
                                            class: "p-1.5 rounded text-dc-text-muted hover:bg-dc-hover hover:text-yellow-400",
                                            title: "Leave Room",
                                            onclick: move |_| {
                                                let state = state_leave.clone();
                                                let rid = room_id.clone();
                                                spawn(async move {
                                                    match state.api.leave_room(&rid).await {
                                                        Ok(()) => {
                                                            selected_room_idx.set(None);
                                                            let mut cr = state.current_room;
                                                            cr.set(None);
                                                            let _ = state.load_rooms().await;
                                                        }
                                                        Err(e) => tracing::error!("Failed to leave room: {}", e),
                                                    }
                                                });
                                            },
                                            "\u{1F6AA}"
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
                                            class: "p-1.5 rounded text-dc-text-muted hover:bg-dc-hover hover:text-red-400",
                                            title: "Delete Room",
                                            onclick: move |_| {
                                                let state = state_del.clone();
                                                let rid = room_id.clone();
                                                spawn(async move {
                                                    match state.api.delete_room(&rid).await {
                                                        Ok(()) => {
                                                            selected_room_idx.set(None);
                                                            let mut cr = state.current_room;
                                                            cr.set(None);
                                                            let _ = state.load_rooms().await;
                                                        }
                                                        Err(e) => tracing::error!("Failed to delete room: {}", e),
                                                    }
                                                });
                                            },
                                            "\u{1F5D1}"
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // ─── CONTENT AREA (messages + members) ──────────
                    div {
                        class: "flex-1 flex overflow-hidden",

                        // ─── MESSAGES COLUMN ────────────────────────
                        div {
                            class: "flex-1 flex flex-col min-w-0",

                            // Pinned messages banner
                            {
                                let pinned: Vec<_> = messages.iter().filter(|m| m.pinned_by.is_some()).collect();
                                if !pinned.is_empty() {
                                    rsx! {
                                        div {
                                            class: "px-4 py-2 bg-dc-sidebar border-b border-dc-border",
                                            div {
                                                class: "flex items-center gap-1 text-xs font-semibold text-yellow-400 mb-1",
                                                "\u{1F4CC} Pinned Messages ({pinned.len()})"
                                            }
                                            for pm in pinned.iter() {
                                                {
                                                    let username = pm.user.as_ref().map(|u| u.username.as_str()).unwrap_or("?");
                                                    let content: String = if pm.content.len() > 80 {
                                                        format!("{}...", &pm.content[..80])
                                                    } else {
                                                        pm.content.clone()
                                                    };
                                                    let pin_msg_id = pm.id.to_string();
                                                    rsx! {
                                                        div {
                                                            class: "text-xs text-dc-text-muted truncate cursor-pointer hover:text-dc-text py-0.5",
                                                            onclick: move |_| {
                                                                let mid = pin_msg_id.clone();
                                                                utils::scroll_to_message(&mid);
                                                                utils::highlight_message(&mid);
                                                            },
                                                            span {
                                                                class: "text-dc-accent font-semibold",
                                                                "{username}: "
                                                            }
                                                            "{content}"
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    rsx! {}
                                }
                            }

                            // Messages scroll area
                            div {
                                id: "messages-container",
                                class: "flex-1 overflow-y-auto",
                                if messages.is_empty() {
                                    div {
                                        class: "flex flex-col items-center justify-center h-full text-dc-text-muted",
                                        div {
                                            class: "w-16 h-16 rounded-full border-2 border-dc-accent flex items-center justify-center mb-4",
                                            span {
                                                class: "text-3xl text-dc-accent font-bold",
                                                "#"
                                            }
                                        }
                                        h3 {
                                            class: "text-xl font-semibold text-dc-text mb-1",
                                            "Welcome to #{room.name}!"
                                        }
                                        p {
                                            class: "text-sm mb-1",
                                            "This is the beginning of #{room.name}."
                                        }
                                        p {
                                            class: "text-xs text-dc-text-faint",
                                            "Start the conversation by sending a message below."
                                        }
                                    }
                                } else {
                                    // Render messages with grouping and date separators
                                    {
                                        let msgs: Vec<_> = messages.iter().collect();
                                        let mut elements: Vec<Element> = Vec::new();
                                        let mut prev_date: Option<chrono::NaiveDate> = None;
                                        let mut prev_user_id: Option<uuid::Uuid> = None;
                                        let mut prev_time: Option<chrono::DateTime<chrono::Utc>> = None;

                                        for (i, msg) in msgs.iter().enumerate() {
                                            let msg_date = msg.created_at.date_naive();
                                            // Date separator
                                            if prev_date.is_none() || prev_date.unwrap() != msg_date {
                                                let date_text = utils::format_date_separator(&msg.created_at);
                                                elements.push(rsx! {
                                                    DateSeparator { key: "date-{i}", date_text: date_text }
                                                });
                                                prev_user_id = None;
                                            }

                                            // Message grouping: same user within 5 minutes
                                            let is_continuation = prev_user_id == Some(msg.user_id)
                                                && prev_time.is_some_and(|pt| {
                                                    (msg.created_at - pt).num_minutes() < 5
                                                })
                                                && msg.reply_message.is_none();

                                            let socket_pin = state.socket.clone();
                                            let socket_unpin = state.socket.clone();
                                            elements.push(rsx! {
                                                MessageBubble {
                                                    key: "{msg.id}",
                                                    message: (*msg).clone(),
                                                    is_continuation: is_continuation,
                                                    is_admin: is_admin,
                                                    on_reply: move |m: crate::models::Message| {
                                                        reply_to_msg.set(Some(m));
                                                    },
                                                    on_pin: move |m: crate::models::Message| {
                                                        let socket = socket_pin.clone();
                                                        let mid = m.id.to_string();
                                                        spawn(async move {
                                                            socket.emit("pin_message", serde_json::json!({
                                                                "messageId": mid,
                                                            })).await;
                                                        });
                                                    },
                                                    on_unpin: move |m: crate::models::Message| {
                                                        let socket = socket_unpin.clone();
                                                        let mid = m.id.to_string();
                                                        spawn(async move {
                                                            socket.emit("unpin_message", serde_json::json!({
                                                                "messageId": mid,
                                                            })).await;
                                                        });
                                                    },
                                                }
                                            });

                                            prev_date = Some(msg_date);
                                            prev_user_id = Some(msg.user_id);
                                            prev_time = Some(msg.created_at);
                                        }

                                        rsx! {
                                            div {
                                                class: "py-4",
                                                {elements.into_iter()}
                                            }
                                        }
                                    }
                                }
                            }

                            // ─── INPUT AREA ─────────────────────────
                            div {
                                class: "px-4 pb-4",
                                // Reply preview bar
                                if let Some(reply_msg) = reply_to_msg() {
                                    div {
                                        class: "flex items-center gap-2 mb-2 bg-dc-sidebar rounded-t-lg px-3 py-2 border-l-2 border-dc-accent",
                                        div {
                                            class: "flex-1 min-w-0",
                                            div {
                                                class: "text-xs font-semibold text-dc-accent",
                                                "Replying to {reply_msg.user.as_ref().map(|u| u.username.as_str()).unwrap_or(\"?\")}"
                                            }
                                            div {
                                                class: "text-xs text-dc-text-muted truncate",
                                                "{reply_msg.content}"
                                            }
                                        }
                                        button {
                                            class: "text-dc-text-muted hover:text-dc-text text-lg px-1",
                                            onclick: move |_| reply_to_msg.set(None),
                                            "\u{00D7}"
                                        }
                                    }
                                }
                                // File selection indicator
                                {
                                    let file_opt = selected_file();
                                    if let Some((ref fname, _)) = file_opt {
                                        rsx! {
                                            div {
                                                class: "flex items-center gap-2 mb-2 bg-dc-sidebar rounded px-3 py-1.5",
                                                span {
                                                    class: "text-xs text-dc-text-muted",
                                                    "\u{1F4CE} {fname}"
                                                }
                                                if !is_uploading() {
                                                    button {
                                                        class: "text-xs text-red-400 hover:text-red-300",
                                                        onclick: move |_| {
                                                            selected_file.set(None);
                                                            upload_status.set(None);
                                                        },
                                                        "\u{00D7}"
                                                    }
                                                }
                                            }
                                        }
                                    } else {
                                        rsx! {}
                                    }
                                }
                                // Upload status
                                {
                                    let status = upload_status();
                                    if let Some(msg) = status {
                                        rsx! {
                                            div {
                                                class: if msg.starts_with("Error") {
                                                    "mb-1 text-xs text-red-400"
                                                } else {
                                                    "mb-1 text-xs text-dc-green"
                                                },
                                                "{msg}"
                                            }
                                        }
                                    } else {
                                        rsx! {}
                                    }
                                }
                                // Input bar
                                form {
                                    onsubmit: on_send,
                                    class: "flex items-center bg-dc-input rounded-lg border border-dc-border",
                                    // File attach button
                                    label {
                                        class: "px-3 py-2.5 text-dc-text-muted hover:text-dc-text cursor-pointer",
                                        title: "Attach file",
                                        input {
                                            r#type: "file",
                                            class: "hidden",
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
                                        "\u{2795}"
                                    }
                                    input {
                                        r#type: "text",
                                        class: "flex-1 bg-transparent px-1 py-3 text-dc-text placeholder-dc-text-faint focus:outline-none text-[0.9375rem]",
                                        placeholder: "Message #{room.name}",
                                        value: "{message_input}",
                                        oninput: move |e| message_input.set(e.value().clone()),
                                    }
                                    // Send file button (shown when file is selected)
                                    {
                                        let file_opt = selected_file();
                                        if file_opt.is_some() && !is_uploading() {
                                            let file = file_opt.unwrap();
                                            let state_upload = state.clone();
                                            let selected_room = selected_room.clone();
                                            rsx! {
                                                button {
                                                    r#type: "button",
                                                    class: "px-3 py-2.5 text-dc-green hover:text-green-400",
                                                    title: "Send File",
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
                                                                            match state.api.send_image_message(&room_id, file_url).await {
                                                                                Ok(_) => {
                                                                                    upload_status.set(None);
                                                                                    selected_file.set(None);
                                                                                    let _ = state.load_messages(&room_id).await;
                                                                                    utils::scroll_to_bottom("messages-container");
                                                                                }
                                                                                Err(e) => upload_status.set(Some(format!("Error sending: {}", e))),
                                                                            }
                                                                        } else {
                                                                            upload_status.set(Some("Error: Invalid response".to_string()));
                                                                        }
                                                                    }
                                                                    Err(e) => upload_status.set(Some(format!("Error uploading: {}", e))),
                                                                }
                                                                is_uploading.set(false);
                                                            });
                                                        }
                                                    },
                                                    "\u{1F4E4}"
                                                }
                                            }
                                        } else {
                                            rsx! {}
                                        }
                                    }
                                    button {
                                        r#type: "submit",
                                        class: "px-3 py-3 text-dc-accent hover:bg-dc-accent hover:text-white rounded-r-lg transition-colors",
                                        title: "Send",
                                        "\u{27A4}"
                                    }
                                }
                            }
                        }

                        // ─── MEMBERS PANEL ──────────────────────────
                        if show_members() {
                            div {
                                class: "w-60 bg-dc-sidebar border-l border-dc-border overflow-y-auto flex-shrink-0",
                                // Panel header
                                div {
                                    class: "px-4 py-3",
                                    h3 {
                                        class: "text-xs font-semibold text-dc-text-muted uppercase tracking-wide",
                                        "Members"
                                    }
                                }
                                // Add member button (admin only)
                                if is_room_creator || is_admin {
                                    {
                                        let api = state.api.clone();
                                        rsx! {
                                            div {
                                                class: "px-3 mb-2",
                                                button {
                                                    class: "w-full text-xs text-dc-accent hover:text-white hover:bg-dc-hover py-1.5 px-2 rounded text-left",
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
                                                    "+ Add Member"
                                                }
                                            }
                                        }
                                    }
                                }
                                // Admins section
                                {
                                    let admin_members: Vec<_> = members.read().iter()
                                        .filter(|m| m["role"].as_str() == Some("admin"))
                                        .cloned().collect();
                                    let regular_members: Vec<_> = members.read().iter()
                                        .filter(|m| m["role"].as_str() != Some("admin"))
                                        .cloned().collect();

                                    rsx! {
                                        if !admin_members.is_empty() {
                                            div {
                                                class: "px-4 pt-2 pb-1",
                                                h4 {
                                                    class: "text-xs font-semibold text-dc-text-muted uppercase tracking-wide",
                                                    "Admin \u{2014} {admin_members.len()}"
                                                }
                                            }
                                            for member in admin_members.iter() {
                                                { render_member_item(member, &selected_room, current_user_id, is_room_creator, is_admin, &state, &mut members) }
                                            }
                                        }
                                        if !regular_members.is_empty() {
                                            div {
                                                class: "px-4 pt-3 pb-1",
                                                h4 {
                                                    class: "text-xs font-semibold text-dc-text-muted uppercase tracking-wide",
                                                    "Members \u{2014} {regular_members.len()}"
                                                }
                                            }
                                            for member in regular_members.iter() {
                                                { render_member_item(member, &selected_room, current_user_id, is_room_creator, is_admin, &state, &mut members) }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // No room selected
                    div {
                        class: "flex-1 flex flex-col items-center justify-center text-dc-text-muted",
                        // Shield icon in accent circle with glow
                        div {
                            class: "w-20 h-20 rounded-full bg-dc-accent/10 flex items-center justify-center mb-6 accent-glow",
                            svg {
                                class: "w-10 h-10 text-dc-accent",
                                view_box: "0 0 24 24",
                                fill: "currentColor",
                                path {
                                    d: "M12 2L3 7v6c0 5.25 3.83 10.13 9 11.27C17.17 23.13 21 18.25 21 13V7l-9-5zm0 2.18l7 3.89v5.93c0 4.23-3.08 8.17-7 9.13-3.92-.96-7-4.9-7-9.13V8.07l7-3.89z"
                                }
                            }
                        }
                        h2 {
                            class: "text-2xl font-bold text-dc-text mb-2",
                            if loading() { "Loading..." } else { "No Room Selected" }
                        }
                        if !loading() {
                            p {
                                class: "text-sm mb-4",
                                "Select a channel from the sidebar to start chatting"
                            }
                            a {
                                class: "text-xs text-dc-accent hover:underline",
                                href: "https://github.com/idan2025/tor-chat-app/releases/latest",
                                target: "_blank",
                                rel: "noopener noreferrer",
                                "Download Apps"
                            }
                        }
                    }
                }
            }

            // ─── ADD MEMBER MODAL ───────────────────────────────────
            if show_add_member_modal() {
                div {
                    class: "fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50",
                    onclick: move |_| show_add_member_modal.set(false),
                    div {
                        class: "bg-dc-sidebar rounded-lg p-5 w-96 max-w-full mx-4 max-h-[80vh] flex flex-col border border-dc-border shadow-xl",
                        onclick: move |e| e.stop_propagation(),
                        h2 {
                            class: "text-lg font-semibold text-white mb-4",
                            "Add Members"
                        }
                        if let Some(err) = add_member_error() {
                            div {
                                class: "bg-red-900/50 text-red-200 p-2 rounded mb-3 text-sm",
                                "{err}"
                            }
                        }
                        input {
                            r#type: "text",
                            class: "w-full px-3 py-2 bg-dc-input border border-dc-border rounded text-dc-text placeholder-dc-text-faint focus:outline-none focus:border-dc-accent mb-3 text-sm",
                            placeholder: "Search users...",
                            value: "{add_member_search}",
                            oninput: move |e| add_member_search.set(e.value().clone()),
                        }
                        div {
                            class: "flex-1 overflow-y-auto space-y-1",
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
                                            class: "text-dc-text-faint text-sm text-center py-4",
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
                                                        class: "flex items-center justify-between p-2 rounded hover:bg-dc-hover",
                                                        div {
                                                            class: "flex items-center gap-2",
                                                            div {
                                                                class: "w-8 h-8 rounded-full bg-dc-accent flex items-center justify-center text-white text-xs font-semibold",
                                                                {
                                                                    let i = uname.chars().next().unwrap_or('?').to_uppercase().to_string();
                                                                    rsx! { "{i}" }
                                                                }
                                                            }
                                                            div {
                                                                div {
                                                                    class: "text-dc-text text-sm",
                                                                    "{uname}"
                                                                }
                                                                if let Some(dn) = &display {
                                                                    div {
                                                                        class: "text-xs text-dc-text-faint",
                                                                        "{dn}"
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        button {
                                                            class: "bg-dc-accent hover:bg-indigo-500 text-white text-xs px-3 py-1 rounded",
                                                            onclick: move |_| {
                                                                let api = api.clone();
                                                                let rid = room_id.clone();
                                                                let uid = uid.clone();
                                                                let api_refresh = api_refresh.clone();
                                                                let rid_refresh = rid_refresh.clone();
                                                                spawn(async move {
                                                                    match api.add_room_member(&rid, &uid).await {
                                                                        Ok(()) => {
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
                            class: "mt-4 w-full bg-dc-input hover:bg-dc-hover text-dc-text py-2 px-4 rounded text-sm",
                            onclick: move |_| show_add_member_modal.set(false),
                            "Close"
                        }
                    }
                }
            }

            // ─── CREATE ROOM MODAL ──────────────────────────────────
            if show_create_modal() {
                div {
                    class: "fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50",
                    onclick: move |_| show_create_modal.set(false),
                    div {
                        class: "bg-dc-sidebar rounded-lg p-5 w-96 max-w-full mx-4 border border-dc-border shadow-xl",
                        onclick: move |e| e.stop_propagation(),
                        h2 {
                            class: "text-lg font-semibold text-white mb-4",
                            "Create Channel"
                        }
                        if let Some(err) = create_error() {
                            div {
                                class: "bg-red-900/50 text-red-200 p-2 rounded mb-3 text-sm",
                                "{err}"
                            }
                        }
                        div {
                            class: "space-y-4",
                            div {
                                label {
                                    class: "block text-xs font-semibold text-dc-text-muted uppercase tracking-wide mb-1",
                                    "Channel Name"
                                }
                                input {
                                    r#type: "text",
                                    class: "w-full px-3 py-2 bg-dc-input border border-dc-border rounded text-dc-text placeholder-dc-text-faint focus:outline-none focus:border-dc-accent text-sm",
                                    placeholder: "new-channel",
                                    value: "{new_room_name}",
                                    oninput: move |e| new_room_name.set(e.value().clone()),
                                }
                            }
                            div {
                                label {
                                    class: "block text-xs font-semibold text-dc-text-muted uppercase tracking-wide mb-1",
                                    "Description (optional)"
                                }
                                input {
                                    r#type: "text",
                                    class: "w-full px-3 py-2 bg-dc-input border border-dc-border rounded text-dc-text placeholder-dc-text-faint focus:outline-none focus:border-dc-accent text-sm",
                                    placeholder: "What's this channel about?",
                                    value: "{new_room_desc}",
                                    oninput: move |e| new_room_desc.set(e.value().clone()),
                                }
                            }
                            if is_admin {
                                div {
                                    class: "flex items-center gap-2",
                                    input {
                                        r#type: "checkbox",
                                        class: "w-4 h-4 accent-dc-accent",
                                        checked: new_room_public(),
                                        onchange: move |e| new_room_public.set(e.checked()),
                                    }
                                    label {
                                        class: "text-sm text-dc-text-muted",
                                        "Public channel (visible to all users)"
                                    }
                                }
                            } else {
                                p {
                                    class: "text-xs text-dc-text-faint",
                                    "Channel will be private. Only admins can create public channels."
                                }
                            }
                            div {
                                class: "flex gap-2 pt-2",
                                {
                                    let state_create = state.clone();
                                    rsx! {
                                        button {
                                            class: "flex-1 bg-dc-accent hover:bg-indigo-500 text-white py-2 px-4 rounded text-sm font-medium",
                                            onclick: move |_| {
                                                let name = new_room_name();
                                                if name.trim().is_empty() {
                                                    create_error.set(Some("Channel name is required".to_string()));
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
                                    class: "flex-1 bg-dc-input hover:bg-dc-hover text-dc-text py-2 px-4 rounded text-sm",
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

fn render_member_item(
    member: &serde_json::Value,
    selected_room: &Option<crate::models::Room>,
    current_user_id: Option<uuid::Uuid>,
    is_room_creator: bool,
    is_admin: bool,
    state: &AppState,
    members_sig: &mut Signal<Vec<serde_json::Value>>,
) -> Element {
    let member_user_id = member["userId"].as_str().unwrap_or("").to_string();
    let user = &member["user"];
    let is_online = user["isOnline"].as_bool().unwrap_or(false);
    let username = user["username"].as_str().unwrap_or("?").to_string();
    let is_creator = selected_room
        .as_ref()
        .and_then(|r| r.creator_id)
        .map(|c| c.to_string() == member_user_id)
        .unwrap_or(false);
    let can_remove = (is_room_creator || is_admin)
        && !is_creator
        && current_user_id
            .map(|u| u.to_string() != member_user_id)
            .unwrap_or(false);

    let room_id_for_remove = selected_room
        .as_ref()
        .map(|r| r.id.to_string())
        .unwrap_or_default();
    let api_for_remove = state.api.clone();
    let api_for_refresh = state.api.clone();
    let rid_for_refresh = room_id_for_remove.clone();
    let member_uid = member_user_id.clone();
    let mut members = *members_sig;

    let initial = username
        .chars()
        .next()
        .unwrap_or('?')
        .to_uppercase()
        .to_string();

    rsx! {
        div {
            class: "flex items-center gap-2 px-3 py-1.5 mx-2 rounded hover:bg-dc-hover cursor-default",
            // Avatar with online indicator
            div {
                class: "relative flex-shrink-0",
                div {
                    class: "w-8 h-8 rounded-full bg-dc-input flex items-center justify-center text-dc-text text-xs font-semibold",
                    "{initial}"
                }
                div {
                    class: if is_online {
                        "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-dc-green border-2 border-dc-sidebar"
                    } else {
                        "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-dc-text-faint border-2 border-dc-sidebar"
                    },
                }
            }
            div {
                class: "flex-1 min-w-0",
                div {
                    class: "text-dc-text text-sm truncate",
                    "{username}"
                }
            }
            if can_remove {
                button {
                    class: "text-xs text-dc-text-faint hover:text-red-400 opacity-0 group-hover:opacity-100",
                    title: "Remove",
                    onclick: move |_| {
                        let api = api_for_remove.clone();
                        let rid = room_id_for_remove.clone();
                        let uid = member_uid.clone();
                        let api_refresh = api_for_refresh.clone();
                        let rid_refresh = rid_for_refresh.clone();
                        spawn(async move {
                            match api.remove_room_member(&rid, &uid).await {
                                Ok(()) => {
                                    if let Ok(m) = api_refresh.get_room_members(&rid_refresh).await {
                                        members.set(m);
                                    }
                                }
                                Err(e) => tracing::error!("Failed to remove member: {}", e),
                            }
                        });
                    },
                    "\u{00D7}"
                }
            }
        }
    }
}
