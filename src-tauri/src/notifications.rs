//! Decides when a friend's presence is worth telling the user about.
//!
//! The rules live in [`PresenceWatcher`], a pure diff over successive presence
//! readings. It has no timers and no notification API, so every edge case
//! below — especially "do not flood on the first poll" — is a unit test.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::contracts::{FriendEntry, PresenceState};

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FriendEvent {
    /// Went from offline to online, but is not in a game.
    CameOnline { user_id: String, name: String },
    /// Entered a game, or moved from one experience to another.
    StartedPlaying {
        user_id: String,
        name: String,
        game: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Seen {
    state: PresenceState,
    location: Option<String>,
}

#[derive(Default)]
pub struct PresenceWatcher {
    seen: HashMap<String, Seen>,
    /// The first poll only records; it never notifies. Otherwise starting Revox
    /// while ten friends are online would fire ten notifications at once.
    primed: bool,
}

impl PresenceWatcher {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_primed(&self) -> bool {
        self.primed
    }

    /// Clears everything, so the next poll primes again.
    ///
    /// Used when the user turns notifications off, or relinks a different
    /// Roblox profile — the previous profile's friends must not leak into the
    /// new one's comparison.
    pub fn reset(&mut self) {
        self.seen.clear();
        self.primed = false;
    }

    pub fn diff(&mut self, friends: &[FriendEntry]) -> Vec<FriendEvent> {
        let mut events = Vec::new();

        for friend in friends {
            let state = friend
                .presence
                .as_ref()
                .map(|presence| presence.state)
                .unwrap_or(PresenceState::Unknown);
            let location = friend
                .presence
                .as_ref()
                .and_then(|presence| presence.last_location.clone())
                .filter(|value| !value.trim().is_empty());

            let now = Seen {
                state,
                location: location.clone(),
            };
            let before = self.seen.insert(friend.user.id.clone(), now.clone());

            if !self.primed {
                continue;
            }

            let name = if friend.user.display_name.trim().is_empty() {
                friend.user.name.clone()
            } else {
                friend.user.display_name.clone()
            };

            match (before.as_ref(), state) {
                // Entering a game, or hopping to a different experience.
                (_, PresenceState::InGame) => {
                    let was_in_same_game = before
                        .as_ref()
                        .is_some_and(|previous| {
                            previous.state == PresenceState::InGame
                                && previous.location == location
                        });
                    if !was_in_same_game {
                        events.push(FriendEvent::StartedPlaying {
                            user_id: friend.user.id.clone(),
                            name,
                            game: location.unwrap_or_default(),
                        });
                    }
                }

                // Coming online counts only as a transition out of being away.
                (Some(previous), PresenceState::Online)
                    if matches!(
                        previous.state,
                        PresenceState::Offline | PresenceState::Unknown
                    ) =>
                {
                    events.push(FriendEvent::CameOnline {
                        user_id: friend.user.id.clone(),
                        name,
                    });
                }

                _ => {}
            }
        }

        // A friend who dropped out of the list entirely is forgotten, so
        // re-appearing later is treated as a fresh transition rather than
        // compared against a stale reading.
        let present: Vec<&String> = friends.iter().map(|friend| &friend.user.id).collect();
        self.seen.retain(|id, _| present.contains(&id));

        self.primed = true;
        events
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::{RobloxUser, UserPresence};

    fn friend(id: &str, state: PresenceState, location: Option<&str>) -> FriendEntry {
        FriendEntry {
            user: RobloxUser {
                id: id.to_string(),
                name: format!("user{id}"),
                display_name: format!("User {id}"),
                ..Default::default()
            },
            presence: Some(UserPresence {
                user_id: id.to_string(),
                state,
                last_location: location.map(str::to_owned),
                place_id: None,
                root_place_id: None,
                game_instance_id: None,
                universe_id: None,
                last_online: None,
            }),
        }
    }

    #[test]
    fn the_first_poll_never_notifies() {
        let mut watcher = PresenceWatcher::new();

        let events = watcher.diff(&[
            friend("1", PresenceState::InGame, Some("Doors")),
            friend("2", PresenceState::Online, None),
        ]);

        assert!(events.is_empty());
        assert!(watcher.is_primed());
    }

    #[test]
    fn reports_a_friend_starting_a_game() {
        let mut watcher = PresenceWatcher::new();
        watcher.diff(&[friend("1", PresenceState::Online, None)]);

        let events = watcher.diff(&[friend("1", PresenceState::InGame, Some("Doors"))]);

        assert_eq!(
            events,
            [FriendEvent::StartedPlaying {
                user_id: "1".to_string(),
                name: "User 1".to_string(),
                game: "Doors".to_string(),
            }]
        );
    }

    #[test]
    fn stays_quiet_while_a_friend_keeps_playing_the_same_game() {
        let mut watcher = PresenceWatcher::new();
        watcher.diff(&[friend("1", PresenceState::InGame, Some("Doors"))]);

        assert!(watcher
            .diff(&[friend("1", PresenceState::InGame, Some("Doors"))])
            .is_empty());
    }

    #[test]
    fn reports_a_move_to_a_different_experience() {
        let mut watcher = PresenceWatcher::new();
        watcher.diff(&[friend("1", PresenceState::InGame, Some("Doors"))]);

        let events = watcher.diff(&[friend("1", PresenceState::InGame, Some("Brookhaven"))]);

        assert_eq!(
            events,
            [FriendEvent::StartedPlaying {
                user_id: "1".to_string(),
                name: "User 1".to_string(),
                game: "Brookhaven".to_string(),
            }]
        );
    }

    #[test]
    fn reports_coming_online_only_from_offline() {
        let mut watcher = PresenceWatcher::new();
        watcher.diff(&[friend("1", PresenceState::Offline, None)]);

        let events = watcher.diff(&[friend("1", PresenceState::Online, None)]);
        assert_eq!(
            events,
            [FriendEvent::CameOnline {
                user_id: "1".to_string(),
                name: "User 1".to_string(),
            }]
        );

        // Leaving a game back to the menu is not "came online".
        let mut second = PresenceWatcher::new();
        second.diff(&[friend("1", PresenceState::InGame, Some("Doors"))]);
        assert!(second
            .diff(&[friend("1", PresenceState::Online, None)])
            .is_empty());
    }

    #[test]
    fn going_offline_is_never_announced() {
        let mut watcher = PresenceWatcher::new();
        watcher.diff(&[friend("1", PresenceState::InGame, Some("Doors"))]);

        assert!(watcher
            .diff(&[friend("1", PresenceState::Offline, None)])
            .is_empty());
    }

    #[test]
    fn a_friend_who_leaves_the_list_is_forgotten() {
        let mut watcher = PresenceWatcher::new();
        watcher.diff(&[friend("1", PresenceState::InGame, Some("Doors"))]);

        // Roblox omitted them from one response.
        watcher.diff(&[]);

        // Coming back in the same game is a fresh transition, so it notifies.
        let events = watcher.diff(&[friend("1", PresenceState::InGame, Some("Doors"))]);
        assert_eq!(events.len(), 1);
    }

    #[test]
    fn resetting_makes_the_next_poll_prime_again() {
        let mut watcher = PresenceWatcher::new();
        watcher.diff(&[friend("1", PresenceState::Offline, None)]);
        watcher.reset();

        assert!(!watcher.is_primed());
        assert!(watcher
            .diff(&[friend("1", PresenceState::InGame, Some("Doors"))])
            .is_empty());
    }

    #[test]
    fn falls_back_to_the_username_when_there_is_no_display_name() {
        let mut watcher = PresenceWatcher::new();
        let mut entry = friend("1", PresenceState::Offline, None);
        entry.user.display_name = "   ".to_string();
        watcher.diff(&[entry.clone()]);

        let mut online = entry.clone();
        online.presence.as_mut().unwrap().state = PresenceState::Online;
        let events = watcher.diff(&[online]);

        assert_eq!(
            events,
            [FriendEvent::CameOnline {
                user_id: "1".to_string(),
                name: "user1".to_string(),
            }]
        );
    }
}
