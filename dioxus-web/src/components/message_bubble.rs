use crate::models::Message;
use crate::utils;
use dioxus::prelude::*;

#[component]
pub fn MessageBubble(message: Message) -> Element {
    let msg = message;
    let is_image = msg.message_type == "image";
    let is_youtube =
        msg.content.contains("youtube.com/watch?v=") || msg.content.contains("youtu.be/");

    rsx! {
        div {
            class: "mb-4",
            div {
                class: "bg-gray-800 rounded-lg p-3 max-w-md",
                if let Some(user) = &msg.user {
                    div {
                        class: "text-sm font-bold text-purple-400 mb-1",
                        "{user.username}"
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
                div {
                    class: "text-xs text-gray-400 mt-1",
                    "{utils::format_time(&msg.created_at)}"
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
