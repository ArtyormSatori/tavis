//! Auth sub-facade — the session a turn runs under.
//!
//! # Why an embedder needs this at all
//!
//! A custom provider — anything other than the account's managed backend — is
//! gated on an active app-session JWT (`verify_session_active`,
//! `inference/provider/factory.rs`). The gate is there to stop an unregistered
//! desktop user from configuring every workload at a custom endpoint and
//! bypassing registration entirely; it is not aimed at a library host that was
//! handed an endpoint and a key by its own operator. But the check has no way to
//! tell those apart, so an embedder has to present a session like anyone else.
//!
//! Before this existed, every embedder reached for `Core::raw()` and hand-wrote
//! `openhuman.auth_store_session` — which is how an unrelated host ends up
//! owning a copy of the `{result, logs}` envelope heuristic and a private
//! version of the auth state struct.
//!
//! # Two kinds of session
//!
//! [`Session::backend`] is a real JWT: it is validated against `GET /auth/me`
//! before anything is persisted, and a failure means nothing is stored.
//! [`Session::local`] is the offline form — a token ending in `.local`, carrying
//! its own user payload, which the core recognizes and does not try to validate.
//! It authorizes nothing at the backend; it exists so a host with its own
//! credentials can satisfy a gate that was written about a different situation.

use std::sync::Arc;

use serde::{Deserialize, Serialize};

use super::call::call;
use super::error::CoreError;
use crate::core::runtime::CoreRuntime;

/// A session to install into the core's credential store.
#[derive(Debug, Clone)]
pub struct Session {
    token: String,
    user: Option<serde_json::Value>,
}

impl Session {
    /// A real backend session JWT, validated against `GET /auth/me` when stored.
    pub fn backend(token: impl Into<String>) -> Self {
        Self {
            token: token.into(),
            user: None,
        }
    }

    /// An offline session for a host that brings its own provider credentials.
    ///
    /// The token must have the `.local` third segment the core recognizes —
    /// this constructor builds one, so a caller cannot get the shape subtly
    /// wrong and be told only that validation failed.
    ///
    /// Grants nothing at the backend. Managed inference, billing and team calls
    /// all still fail without a real session; what it unblocks is the
    /// custom-provider gate.
    pub fn local(user_id: impl Into<String>) -> Self {
        let user_id = user_id.into();
        Self {
            // The core detects a local session purely by the third segment
            // being `local`; the first two are opaque to it.
            token: "embedded.harness.local".to_string(),
            user: Some(serde_json::json!({
                "id": user_id,
                "email": "local@openhuman.local",
            })),
        }
    }

    /// Attach or override the user payload.
    ///
    /// Required for a local session (the core refuses one without it) and
    /// ignored for a backend session, which takes its user from `/auth/me`.
    pub fn user(mut self, user: serde_json::Value) -> Self {
        self.user = Some(user);
        self
    }

    /// Whether this is the offline form.
    pub fn is_local(&self) -> bool {
        crate::openhuman::security::credentials::session_support::is_local_session_token(&self.token)
    }
}

/// Current auth state, narrowed to what a host actually branches on.
///
/// Declared here rather than re-exporting the domain's `AuthStateResponse` so
/// the facade's contract is explicit; the extra fields that response carries are
/// desktop-UI concerns.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AuthState {
    /// Whether a session is stored and considered live.
    #[serde(default, rename = "isAuthenticated")]
    pub is_authenticated: bool,
    /// The signed-in user id, when there is one.
    #[serde(default, rename = "userId")]
    pub user_id: Option<String>,
}

/// Typed access to the session store.
///
/// Obtained from [`Core::auth`](super::Core::auth); never constructed directly.
pub struct Auth<'a>(pub(super) &'a Arc<CoreRuntime>);

impl Auth<'_> {
    /// Store a session, replacing any existing one.
    ///
    /// # Errors
    ///
    /// [`CoreError::Rpc`] when a backend session fails `GET /auth/me` — nothing
    /// is persisted in that case, deliberately, so a caller cannot end up
    /// believing it is signed in when it is not.
    pub async fn store(&self, session: Session) -> Result<(), CoreError> {
        log::debug!("[embed][auth] storing session local={}", session.is_local());
        let _: serde_json::Value = call(
            self.0,
            "openhuman.auth_store_session",
            serde_json::json!({
                "token": session.token,
                "user": session.user,
            }),
        )
        .await?;
        Ok(())
    }

    /// Read the current auth state. Does not make a network call.
    pub async fn state(&self) -> Result<AuthState, CoreError> {
        call(self.0, "openhuman.auth_get_state", serde_json::json!({})).await
    }

    /// Remove the stored session.
    pub async fn clear(&self) -> Result<(), CoreError> {
        let _: serde_json::Value =
            call(self.0, "openhuman.auth_clear_session", serde_json::json!({})).await?;
        Ok(())
    }
}

#[cfg(test)]
#[path = "auth_tests.rs"]
mod tests;
