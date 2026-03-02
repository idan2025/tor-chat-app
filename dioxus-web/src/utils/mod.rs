pub mod storage;

use chrono::{DateTime, Datelike, Local, Utc};
use wasm_bindgen::JsCast;

pub fn format_time(dt: &DateTime<Utc>) -> String {
    let local = dt.with_timezone(&Local);
    local.format("%H:%M").to_string()
}

pub fn format_date(dt: &DateTime<Utc>) -> String {
    dt.format("%Y-%m-%d %H:%M").to_string()
}

pub fn format_date_separator(dt: &DateTime<Utc>) -> String {
    let local = dt.with_timezone(&Local);
    let now = Local::now();
    let today = now.date_naive();
    let msg_date = local.date_naive();

    if msg_date == today {
        "Today".to_string()
    } else if msg_date == today.pred_opt().unwrap_or(today) {
        "Yesterday".to_string()
    } else if msg_date.year() == today.year() {
        local.format("%B %d").to_string()
    } else {
        local.format("%B %d, %Y").to_string()
    }
}

pub fn format_full_timestamp(dt: &DateTime<Utc>) -> String {
    let local = dt.with_timezone(&Local);
    local.format("%B %d, %Y at %H:%M").to_string()
}

pub fn scroll_to_bottom(container_id: &str) {
    if let Some(window) = web_sys::window() {
        if let Some(document) = window.document() {
            if let Some(el) = document.get_element_by_id(container_id) {
                let scroll_height = el.scroll_height();
                el.set_scroll_top(scroll_height);
            }
        }
    }
}

pub fn scroll_to_message(msg_id: &str) {
    if let Some(window) = web_sys::window() {
        if let Some(document) = window.document() {
            let element_id = format!("msg-{}", msg_id);
            if let Some(el) = document.get_element_by_id(&element_id) {
                if let Ok(html_el) = el.dyn_into::<web_sys::HtmlElement>() {
                    html_el.scroll_into_view();
                }
            }
        }
    }
}

pub fn highlight_message(msg_id: &str) {
    if let Some(window) = web_sys::window() {
        if let Some(document) = window.document() {
            let element_id = format!("msg-{}", msg_id);
            if let Some(el) = document.get_element_by_id(&element_id) {
                let _ = el.class_list().add_1("highlight-flash");
                let el_clone = el.clone();
                let closure = wasm_bindgen::closure::Closure::once(move || {
                    let _ = el_clone.class_list().remove_1("highlight-flash");
                });
                let _ = window.set_timeout_with_callback_and_timeout_and_arguments_0(
                    closure.as_ref().unchecked_ref(),
                    2000,
                );
                closure.forget();
            }
        }
    }
}
