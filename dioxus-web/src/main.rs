mod api;
mod components;
mod models;
mod pages;
mod socket;
mod state;
mod utils;

use dioxus::prelude::*;
use dioxus_router::prelude::*;
use pages::*;

#[derive(Clone, Routable, PartialEq)]
#[rustfmt::skip]
enum Route {
    #[route("/")]
    Home {},
    #[route("/login")]
    Login {},
    #[route("/register")]
    Register {},
    #[route("/chat")]
    Chat {},
    #[route("/admin")]
    Admin {},
}

fn main() {
    // Initialize tracing
    tracing_wasm::set_as_global_default();

    // Launch the web app
    dioxus_web::launch(App);
}

#[component]
fn App() -> Element {
    use_context_provider(|| state::AppState::new());

    rsx! {
        Router::<Route> {}
    }
}

#[component]
fn Home() -> Element {
    let mut state = use_context::<state::AppState>();
    let nav = navigator();

    use_effect(move || {
        spawn(async move {
            if let Some(token) = utils::storage::get_token() {
                if state::auth::verify_token(&token).await.is_ok() {
                    nav.push(Route::Chat {});
                } else {
                    nav.push(Route::Login {});
                }
            } else {
                nav.push(Route::Login {});
            }
        });
    });

    rsx! {
        div {
            class: "flex items-center justify-center min-h-screen bg-gray-900",
            div {
                class: "text-center",
                h1 {
                    class: "text-4xl font-bold text-purple-500 mb-4",
                    "TOR Chat"
                }
                p {
                    class: "text-gray-400 mb-8",
                    "Secure & Anonymous Messaging"
                }
                div {
                    class: "animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"
                }
            }
        }
    }
}
