use crate::models::Room;
use dioxus::prelude::*;

#[component]
pub fn RoomListItem(room: ReadSignal<Room>, on_click: EventHandler<()>) -> Element {
    let r = room();

    rsx! {
        div {
            class: "p-4 hover:bg-gray-700 cursor-pointer border-b border-gray-700",
            onclick: move |_| on_click.call(()),
            div {
                class: "font-semibold text-white",
                "{r.name}"
            }
            if let Some(desc) = &r.description {
                div {
                    class: "text-sm text-gray-400 truncate",
                    "{desc}"
                }
            }
        }
    }
}
