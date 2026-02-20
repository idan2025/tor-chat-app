use crate::{models::RegisterRequest, state::AppState, Route};
use dioxus::prelude::*;

#[component]
pub fn Register() -> Element {
    let _state = use_context::<AppState>();
    let nav = navigator();
    let mut username = use_signal(String::new);
    let mut password = use_signal(String::new);
    let mut error = use_signal(|| None::<String>);
    let mut success = use_signal(|| false);
    let mut loading = use_signal(|| false);

    let on_submit = move |e: Event<FormData>| {
        e.prevent_default();
        let state = _state.clone();
        spawn(async move {
            loading.set(true);
            error.set(None);

            let u = username();
            let p = password();

            if u.len() < 3 {
                error.set(Some("Username must be at least 3 characters".to_string()));
                loading.set(false);
                return;
            }

            if p.len() < 8 {
                error.set(Some("Password must be at least 8 characters".to_string()));
                loading.set(false);
                return;
            }

            let req = RegisterRequest {
                username: u,
                password: p,
                display_name: None,
            };

            match state.api.register(req).await {
                Ok(_response) => {
                    success.set(true);
                    // Navigate to login after short delay so user sees success message
                    gloo_timers::future::TimeoutFuture::new(1000).await;
                    nav.push(Route::Login {});
                }
                Err(e) => {
                    tracing::error!("Registration failed: {}", e);
                    error.set(Some(e));
                }
            }

            loading.set(false);
        });
    };

    rsx! {
        div {
            class: "flex items-center justify-center min-h-screen bg-gray-900",
            div {
                class: "w-full max-w-md p-8 bg-gray-800 rounded-lg shadow-lg",
                div {
                    class: "text-center mb-8",
                    h1 {
                        class: "text-3xl font-bold text-white mb-2",
                        "Create Account"
                    }
                    p {
                        class: "text-gray-400",
                        "Join the secure network"
                    }
                }

                if success() {
                    div {
                        class: "bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded mb-4",
                        "Account created successfully! Redirecting to login..."
                    }
                }

                if let Some(err) = error() {
                    div {
                        class: "bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4",
                        "{err}"
                    }
                }

                form {
                    onsubmit: on_submit,
                    div {
                        class: "mb-4",
                        label {
                            class: "block text-gray-300 text-sm font-bold mb-2",
                            "Username"
                        }
                        input {
                            r#type: "text",
                            class: "w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500",
                            placeholder: "Choose a username (min 3 characters)",
                            value: "{username}",
                            oninput: move |e| username.set(e.value().clone()),
                        }
                    }

                    div {
                        class: "mb-6",
                        label {
                            class: "block text-gray-300 text-sm font-bold mb-2",
                            "Password"
                        }
                        input {
                            r#type: "password",
                            class: "w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500",
                            placeholder: "Choose a password (min 8 characters)",
                            value: "{password}",
                            oninput: move |e| password.set(e.value().clone()),
                        }
                    }

                    button {
                        r#type: "submit",
                        class: "w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200",
                        disabled: loading() || success(),
                        if loading() {
                            "Creating account..."
                        } else {
                            "Register"
                        }
                    }
                }

                div {
                    class: "mt-6 text-center",
                    p {
                        class: "text-gray-400",
                        "Already have an account? "
                        Link {
                            to: Route::Login {},
                            class: "text-purple-500 hover:text-purple-400",
                            "Login"
                        }
                    }
                }
            }
        }
    }
}
