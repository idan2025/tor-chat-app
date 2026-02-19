use crate::{models::RegisterRequest, state::AppState, utils::storage, Route};
use dioxus::prelude::*;

#[component]
pub fn Register() -> Element {
    let state = use_context::<AppState>();
    let nav = navigator();
    let mut username = use_signal(String::new);
    let mut password = use_signal(String::new);
    let mut error = use_signal(|| None::<String>);
    let mut loading = use_signal(|| false);

    let on_submit = move |e: Event<FormData>| {
        e.prevent_default();
        let state = state.clone();
        spawn(async move {
            loading.set(true);
            error.set(None);

            let req = RegisterRequest {
                username: username(),
                password: password(),
                display_name: None,
            };

            match state.api.register(req).await {
                Ok(response) => {
                    if let Some(token) = response.get("token").and_then(|t| t.as_str()) {
                        // Save token first
                        storage::save_token(token);

                        // Set user state
                        if let Some(user_data) = response.get("user") {
                            if let Ok(user) = serde_json::from_value(user_data.clone()) {
                                state.set_current_user(user).await;
                            }
                        }

                        // Try to connect socket (non-blocking, continue even if fails)
                        let socket_state = state.clone();
                        let socket_token = token.to_string();
                        spawn(async move {
                            socket_state.socket.connect(&socket_token).await;
                        });

                        // Navigate to chat immediately
                        nav.push(Route::Chat {});
                    } else {
                        error.set(Some(
                            "Registration succeeded but no token received".to_string(),
                        ));
                    }
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
                            placeholder: "Choose a username",
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
                            placeholder: "Choose a password",
                            value: "{password}",
                            oninput: move |e| password.set(e.value().clone()),
                        }
                    }

                    button {
                        r#type: "submit",
                        class: "w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200",
                        disabled: loading(),
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
