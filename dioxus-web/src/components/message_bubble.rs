use crate::models::Message;
use crate::utils;
use dioxus::prelude::*;

#[component]
pub fn MessageBubble(message: ReadSignal<Message>) -> Element {
    let msg = message();

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
                div {
                    class: "text-white",
                    "{msg.content}"
                }
                div {
                    class: "text-xs text-gray-400 mt-1",
                    "{utils::format_time(&msg.created_at)}"
                }
            }
        }
    }
}
