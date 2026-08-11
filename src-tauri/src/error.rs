use serde::{Deserialize, Serialize};

/// A typed, serializable error that crosses the Tauri boundary.
///
/// Every failing command returns one of these so the UI can react to `code`
/// and show the localized message that belongs to it.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, thiserror::Error)]
#[error("{code}: {message}")]
pub struct AppError {
    pub code: String,
    pub message: String,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}
