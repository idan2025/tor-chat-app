use crate::models::Message;
use crate::utils;
use dioxus::prelude::*;

#[component]
pub fn MessageBubble(
    message: Message,
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

    rsx! {
        div {
            class: "mb-4",
            div {
                class: if is_pinned {
                    "bg-gray-800 rounded-lg p-3 max-w-md border-l-4 border-yellow-500"
                } else {
                    "bg-gray-800 rounded-lg p-3 max-w-md"
                },
                // Pinned indicator
                if is_pinned {
                    div {
                        class: "flex items-center gap-1 text-xs text-yellow-400 mb-1",
                        span { "📌 Pinned" }
                    }
                }
                if let Some(user) = &msg.user {
                    div {
                        class: "text-sm font-bold text-purple-400 mb-1",
                        "{user.username}"
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
                        rsx! {
                            div {
                                class: "border-l-4 border-purple-500 pl-2 mb-2 py-1 bg-gray-700 rounded-r",
                                div {
                                    class: "text-xs font-semibold text-purple-300",
                                    "{reply_username}"
                                }
                                div {
                                    class: "text-xs text-gray-300 truncate",
                                    "{truncated}"
                                }
                            }
                        }
                    }
                }
                // Display image if message type is image
                if is_image {
                    img {
                        class: "max-w-full rounded-lg cursor-pointer hover:opacity-90",
                        src: "{msg.content}",
                        alt: "Uploaded image",
                        style: "max-height: 400px;",
                    }
                }
                // Display YouTube embed if content contains YouTube URL
                else if is_youtube {
                    {
                        let video_id = extract_youtube_id(&msg.content);
                        if let Some(id) = video_id {
                            rsx! {
                                div {
                                    class: "relative w-full pb-[56.25%] rounded-lg overflow-hidden bg-black",
                                    iframe {
                                        class: "absolute inset-0 w-full h-full",
                                        src: "https://www.youtube.com/embed/{id}",
                                        title: "YouTube video player",
                                        frame_border: "0",
                                        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
                                        allowfullscreen: true,
                                    }
                                }
                            }
                        } else {
                            rsx! {
                                div {
                                    class: "text-white",
                                    "{msg.content}"
                                }
                            }
                        }
                    }
                }
                // Default text display
                else {
                    div {
                        class: "text-white",
                        "{msg.content}"
                    }
                }
                // Footer: time + action buttons
                div {
                    class: "flex items-center justify-between mt-1",
                    div {
                        class: "text-xs text-gray-400",
                        "{utils::format_time(&msg.created_at)}"
                    }
                    div {
                        class: "flex gap-1",
                        // Reply button
                        if let Some(handler) = &on_reply {
                            {
                                let msg_clone = msg.clone();
                                let handler = *handler;
                                rsx! {
                                    button {
                                        class: "text-xs text-gray-400 hover:text-purple-400 px-1",
                                        title: "Reply",
                                        onclick: move |_| {
                                            handler.call(msg_clone.clone());
                                        },
                                        "↩"
                                    }
                                }
                            }
                        }
                        // Pin/Unpin button (admin only)
                        if admin {
                            if is_pinned {
                                if let Some(handler) = &on_unpin {
                                    {
                                        let msg_clone = msg.clone();
                                        let handler = *handler;
                                        rsx! {
                                            button {
                                                class: "text-xs text-yellow-400 hover:text-yellow-300 px-1",
                                                title: "Unpin",
                                                onclick: move |_| {
                                                    handler.call(msg_clone.clone());
                                                },
                                                "Unpin"
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
                                                class: "text-xs text-gray-400 hover:text-yellow-400 px-1",
                                                title: "Pin",
                                                onclick: move |_| {
                                                    handler.call(msg_clone.clone());
                                                },
                                                "📌"
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
    }
}

// Helper function to extract YouTube video ID from URL
fn extract_youtube_id(content: &str) -> Option<String> {
    // Check for youtu.be links
    if let Some(pos) = content.find("youtu.be/") {
        let start = pos + 9;
        let end = content[start..]
            .find(|c: char| !c.is_alphanumeric() && c != '-' && c != '_')
            .map(|i| start + i)
            .unwrap_or(content.len());
        return Some(content[start..end].to_string());
    }

    // Check for youtube.com/watch?v= links
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
