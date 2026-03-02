use crate::models::Message;
use crate::utils;
use dioxus::prelude::*;
use regex::Regex;

/// Color palette for avatar backgrounds based on username hash
const AVATAR_COLORS: &[&str] = &[
    "bg-red-600",
    "bg-orange-600",
    "bg-amber-600",
    "bg-emerald-600",
    "bg-teal-600",
    "bg-cyan-600",
    "bg-blue-600",
    "bg-indigo-600",
    "bg-violet-600",
    "bg-purple-600",
    "bg-fuchsia-600",
    "bg-pink-600",
];

fn avatar_color(username: &str) -> &'static str {
    let hash: usize = username.bytes().map(|b| b as usize).sum();
    AVATAR_COLORS[hash % AVATAR_COLORS.len()]
}

fn user_initials(username: &str) -> String {
    let first = username.chars().next().unwrap_or('?');
    first.to_uppercase().to_string()
}

#[component]
pub fn MessageBubble(
    message: Message,
    is_continuation: Option<bool>,
    on_reply: Option<EventHandler<Message>>,
    on_pin: Option<EventHandler<Message>>,
    on_unpin: Option<EventHandler<Message>>,
    is_admin: Option<bool>,
) -> Element {
    let msg = message;
    let is_image = msg.message_type == "image";
    let is_youtube =
        msg.content.contains("youtube.com/watch?v=") || msg.content.contains("youtu.be/");
    let is_pinned = msg.pinned_by.is_some();
    let admin = is_admin.unwrap_or(false);
    let continuation = is_continuation.unwrap_or(false);

    let username = msg
        .user
        .as_ref()
        .map(|u| u.username.as_str())
        .unwrap_or("?");
    let display_name = msg
        .user
        .as_ref()
        .and_then(|u| u.display_name.as_deref())
        .unwrap_or(username);
    let color = avatar_color(username);
    let initials = user_initials(username);
    let msg_id = msg.id.to_string();
    let timestamp = utils::format_time(&msg.created_at);
    let full_timestamp = utils::format_full_timestamp(&msg.created_at);

    rsx! {
        div {
            id: "msg-{msg_id}",
            class: "msg-row group relative px-4 py-0.5",

            // Hover action toolbar
            div {
                class: "msg-actions absolute right-4 -top-3 z-10 flex items-center bg-dc-sidebar border border-dc-border rounded shadow-lg",
                if let Some(handler) = &on_reply {
                    {
                        let msg_clone = msg.clone();
                        let handler = *handler;
                        rsx! {
                            button {
                                class: "px-2 py-1 text-dc-text-muted hover:text-dc-text hover:bg-dc-hover text-sm",
                                title: "Reply",
                                onclick: move |_| handler.call(msg_clone.clone()),
                                "\u{21A9}"
                            }
                        }
                    }
                }
                if admin {
                    if is_pinned {
                        if let Some(handler) = &on_unpin {
                            {
                                let msg_clone = msg.clone();
                                let handler = *handler;
                                rsx! {
                                    button {
                                        class: "px-2 py-1 text-yellow-400 hover:text-yellow-300 hover:bg-dc-hover text-sm",
                                        title: "Unpin",
                                        onclick: move |_| handler.call(msg_clone.clone()),
                                        "\u{1F4CC}"
                                    }
                                }
                            }
                        }
                    } else {
                        if let Some(handler) = &on_pin {
                            {
                                let msg_clone = msg.clone();
                                let handler = *handler;
                                rsx! {
                                    button {
                                        class: "px-2 py-1 text-dc-text-muted hover:text-yellow-400 hover:bg-dc-hover text-sm",
                                        title: "Pin",
                                        onclick: move |_| handler.call(msg_clone.clone()),
                                        "\u{1F4CC}"
                                    }
                                }
                            }
                        }
                    }
                }
            }

            div {
                class: "flex gap-4",

                // Avatar column (40px)
                div {
                    class: "flex-shrink-0 w-10",
                    if !continuation {
                        div {
                            class: "w-10 h-10 rounded-full {color} flex items-center justify-center text-white font-semibold text-sm select-none",
                            "{initials}"
                        }
                    } else {
                        // Show timestamp on hover for continuation messages
                        div {
                            class: "w-10 h-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                            span {
                                class: "text-[10px] text-dc-text-faint",
                                "{timestamp}"
                            }
                        }
                    }
                }

                // Content column
                div {
                    class: "flex-1 min-w-0",

                    // Username + timestamp header (only for non-continuation)
                    if !continuation {
                        div {
                            class: "flex items-baseline gap-2 mb-0.5",
                            span {
                                class: "font-medium text-white hover:underline cursor-pointer text-[0.9375rem]",
                                "{display_name}"
                            }
                            span {
                                class: "text-xs text-dc-text-faint",
                                title: "{full_timestamp}",
                                "{timestamp}"
                            }
                            if is_pinned {
                                span {
                                    class: "text-xs text-yellow-400",
                                    "\u{1F4CC} Pinned"
                                }
                            }
                        }
                    }

                    // Quoted reply block
                    if let Some(reply) = &msg.reply_message {
                        {
                            let reply_username = reply.get("user")
                                .and_then(|u| u.get("username"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("Unknown");
                            let reply_content = reply.get("content")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            let truncated: String = if reply_content.len() > 100 {
                                format!("{}...", &reply_content[..100])
                            } else {
                                reply_content.to_string()
                            };
                            let reply_id = reply.get("id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            rsx! {
                                div {
                                    class: "flex items-center gap-1 mb-1 cursor-pointer group/reply",
                                    onclick: move |_| {
                                        let rid = reply_id.clone();
                                        utils::scroll_to_message(&rid);
                                        utils::highlight_message(&rid);
                                    },
                                    div {
                                        class: "w-0.5 h-full self-stretch bg-dc-text-muted rounded-full mr-1"
                                    }
                                    div {
                                        class: "flex items-center gap-1 text-xs",
                                        span {
                                            class: "font-semibold text-dc-text-muted hover:text-dc-text",
                                            "{reply_username}"
                                        }
                                        span {
                                            class: "text-dc-text-faint truncate max-w-xs group-hover/reply:text-dc-text-muted",
                                            "{truncated}"
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Message content
                    if is_image {
                        img {
                            class: "max-w-md rounded-lg cursor-pointer hover:opacity-90 mt-1",
                            src: "{msg.content}",
                            alt: "Uploaded image",
                            style: "max-height: 350px;",
                        }
                    } else if is_youtube {
                        {
                            let video_id = extract_youtube_id(&msg.content);
                            if let Some(id) = video_id {
                                rsx! {
                                    div {
                                        class: "max-w-lg mt-1",
                                        div {
                                            class: "aspect-video rounded-lg overflow-hidden bg-black",
                                            iframe {
                                                class: "w-full h-full",
                                                src: "https://www.youtube.com/embed/{id}",
                                                title: "YouTube video player",
                                                frame_border: "0",
                                                allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
                                                allowfullscreen: true,
                                            }
                                        }
                                    }
                                }
                            } else {
                                rsx! {
                                    RichTextContent { text: msg.content.clone() }
                                }
                            }
                        }
                    } else {
                        RichTextContent { text: msg.content.clone() }
                    }
                }
            }
        }
    }
}

/// Renders text with clickable URL links
#[component]
fn RichTextContent(text: String) -> Element {
    let url_re = Regex::new(r"(https?://[^\s<>\)\]]+)").unwrap();

    let mut parts: Vec<(bool, String)> = Vec::new();
    let mut last_end = 0;

    for m in url_re.find_iter(&text) {
        if m.start() > last_end {
            parts.push((false, text[last_end..m.start()].to_string()));
        }
        parts.push((true, m.as_str().to_string()));
        last_end = m.end();
    }
    if last_end < text.len() {
        parts.push((false, text[last_end..].to_string()));
    }

    if parts.is_empty() {
        parts.push((false, text));
    }

    rsx! {
        div {
            class: "text-dc-text text-[0.9375rem] leading-[1.375rem] break-words",
            for (is_url, segment) in parts.iter() {
                if *is_url {
                    a {
                        class: "text-blue-400 hover:underline",
                        href: "{segment}",
                        target: "_blank",
                        rel: "noopener noreferrer",
                        "{segment}"
                    }
                } else {
                    span { "{segment}" }
                }
            }
        }
    }
}

/// Date separator between different days
#[component]
pub fn DateSeparator(date_text: String) -> Element {
    rsx! {
        div {
            class: "flex items-center my-4 px-4",
            div { class: "flex-1 h-px bg-dc-border" }
            span {
                class: "px-2 text-xs font-semibold text-dc-text-muted",
                "{date_text}"
            }
            div { class: "flex-1 h-px bg-dc-border" }
        }
    }
}

fn extract_youtube_id(content: &str) -> Option<String> {
    if let Some(pos) = content.find("youtu.be/") {
        let start = pos + 9;
        let end = content[start..]
            .find(|c: char| !c.is_alphanumeric() && c != '-' && c != '_')
            .map(|i| start + i)
            .unwrap_or(content.len());
        return Some(content[start..end].to_string());
    }

    if let Some(pos) = content.find("v=") {
        let start = pos + 2;
        let end = content[start..]
            .find(|c: char| !c.is_alphanumeric() && c != '-' && c != '_')
            .map(|i| start + i)
            .unwrap_or(content.len());
        return Some(content[start..end].to_string());
    }

    None
}
