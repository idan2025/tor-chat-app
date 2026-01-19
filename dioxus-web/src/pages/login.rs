use crate::{models::LoginRequest, state::AppState, utils::storage, Route};
use dioxus::prelude::*;
// navigator and Link available from dioxus::prelude::*

#[component]
pub fn Login() -> Element {
    let state = use_context::<AppState>();
    let nav = navigator();
    let mut username = use_signal(String::new);
    let mut password = use_signal(String::new);
    let mut error = use_signal(|| None::<String>);
    let mut loading = use_signal(|| false);

    let on_submit = move |_| {
        let state = state.clone();
        spawn(async move {
            loading.set(true);
            error.set(None);

            let req = LoginRequest {
                username: username(),
                password: password(),
            };

            match state.api.login(req).await {
                Ok(response) => {
                    if let Some(token) = response.get("token").and_then(|t| t.as_str()) {
                        storage::save_token(token);

                        if let Some(user_data) = response.get("user") {
                            if let Ok(user) = serde_json::from_value(user_data.clone()) {
                                state.set_current_user(user).await;
                            }
                        }

                        // Connect socket
                        state.socket.connect(token).await;

                        nav.push(Route::Chat {});
                    }
                }
                Err(e) => {
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
                    div {
                        class: "text-purple-500 text-5xl mb-4",
                        "🔒"
                    }
                    h1 {
                        class: "text-3xl font-bold text-white mb-2",
                        "Welcome Back"
                    }
                    p {
                        class: "text-gray-400",
                        "Sign in to continue"
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
                    prevent_default: "onsubmit",
                    div {
                        class: "mb-4",
                        label {
                            class: "block text-gray-300 text-sm font-bold mb-2",
                            "Username"
                        }
                        input {
                            r#type: "text",
                            class: "w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500",
                            placeholder: "Enter your username",
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
                            placeholder: "Enter your password",
                            value: "{password}",
                            oninput: move |e| password.set(e.value().clone()),
                        }
                    }

                    button {
                        r#type: "submit",
                        class: "w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200",
                        disabled: loading(),
                        if loading() {
                            "Logging in..."
                        } else {
                            "Login"
                        }
                    }
                }

                div {
                    class: "mt-6 text-center",
                    p {
                        class: "text-gray-400",
                        "Don't have an account? "
                        Link {
                            to: Route::Register {},
                            class: "text-purple-500 hover:text-purple-400",
                            "Register"
                        }
                    }
                }
            }
        }
    }
}
