//! Turns "a Roblox process appeared and later went away" into a stored play
//! session.
//!
//! The rules live in [`SessionMachine`], which is a pure state machine driven
//! by ticks. It knows nothing about threads, clocks or the database, so every
//! edge case below is covered by ordinary unit tests.

use serde::{Deserialize, Serialize};

/// What the user asked to start. Carried through the session so the finished
/// record can be attributed to the right game and profile.
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PendingLaunch {
    pub place_id: Option<String>,
    pub game_id: Option<String>,
    pub account_profile_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionEvent {
    /// A Roblox process showed up and the clock started.
    Started { launch: PendingLaunch },
    /// No Roblox process appeared inside the launch window.
    TimedOut { launch: PendingLaunch },
    /// Roblox is gone and the session should be written to the database.
    Ended {
        launch: PendingLaunch,
        duration_seconds: i64,
        possible_crash: bool,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum MachineState {
    Idle,
    Awaiting {
        launch: PendingLaunch,
        armed_at_ms: u64,
    },
    Running {
        launch: PendingLaunch,
        started_at_ms: u64,
        last_seen_ms: u64,
    },
}

/// How long to wait for Roblox to appear after a launch before giving up.
pub const DEFAULT_LAUNCH_TIMEOUT_MS: u64 = 90_000;
/// A restart inside this window continues the same session rather than
/// starting a new one, which is what a Roblox teleport between places looks
/// like from the outside.
pub const DEFAULT_RESTART_GRACE_MS: u64 = 20_000;
/// Sessions shorter than this are flagged as a *possible* crash. Revox cannot
/// tell a crash from a deliberate quit, so this only ever sets a "possible"
/// marker and never claims a crash happened.
pub const SHORT_SESSION_MS: u64 = 60_000;

pub struct SessionMachine {
    state: MachineState,
    launch_timeout_ms: u64,
    restart_grace_ms: u64,
}

impl SessionMachine {
    pub fn new() -> Self {
        Self::with_timings(DEFAULT_LAUNCH_TIMEOUT_MS, DEFAULT_RESTART_GRACE_MS)
    }

    pub fn with_timings(launch_timeout_ms: u64, restart_grace_ms: u64) -> Self {
        Self {
            state: MachineState::Idle,
            launch_timeout_ms,
            restart_grace_ms,
        }
    }

    pub fn is_idle(&self) -> bool {
        matches!(self.state, MachineState::Idle)
    }

    pub fn is_running(&self) -> bool {
        matches!(self.state, MachineState::Running { .. })
    }

    /// Records that the user just launched something. Re-arming while a
    /// session is already running keeps the running session untouched, so a
    /// second click cannot split one play session into two.
    pub fn arm(&mut self, launch: PendingLaunch, now_ms: u64) {
        if self.is_running() {
            return;
        }
        self.state = MachineState::Awaiting {
            launch,
            armed_at_ms: now_ms,
        };
    }

    /// Feeds one observation into the machine. `roblox_running` is whether at
    /// least one Roblox player process exists right now.
    pub fn tick(&mut self, now_ms: u64, roblox_running: bool) -> Option<SessionEvent> {
        match &self.state {
            MachineState::Idle => None,

            MachineState::Awaiting { launch, armed_at_ms } => {
                if roblox_running {
                    let launch = launch.clone();
                    self.state = MachineState::Running {
                        launch: launch.clone(),
                        started_at_ms: now_ms,
                        last_seen_ms: now_ms,
                    };
                    return Some(SessionEvent::Started { launch });
                }
                if now_ms.saturating_sub(*armed_at_ms) >= self.launch_timeout_ms {
                    let launch = launch.clone();
                    self.state = MachineState::Idle;
                    return Some(SessionEvent::TimedOut { launch });
                }
                None
            }

            MachineState::Running {
                launch,
                started_at_ms,
                last_seen_ms,
            } => {
                if roblox_running {
                    self.state = MachineState::Running {
                        launch: launch.clone(),
                        started_at_ms: *started_at_ms,
                        last_seen_ms: now_ms,
                    };
                    return None;
                }
                if now_ms.saturating_sub(*last_seen_ms) < self.restart_grace_ms {
                    // Still inside the grace window: Roblox may be restarting.
                    return None;
                }

                // Playtime is measured to the last confirmed sighting, so the
                // grace window is never counted as time played.
                let played_ms = last_seen_ms.saturating_sub(*started_at_ms);
                let event = SessionEvent::Ended {
                    launch: launch.clone(),
                    duration_seconds: (played_ms / 1000) as i64,
                    possible_crash: played_ms < SHORT_SESSION_MS,
                };
                self.state = MachineState::Idle;
                Some(event)
            }
        }
    }
}

impl Default for SessionMachine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn launch() -> PendingLaunch {
        PendingLaunch {
            place_id: Some("920587237".to_string()),
            game_id: Some("game-1".to_string()),
            account_profile_id: Some("account-1".to_string()),
        }
    }

    #[test]
    fn idle_machine_ignores_ticks() {
        let mut machine = SessionMachine::new();
        assert_eq!(machine.tick(1_000, true), None);
        assert!(machine.is_idle());
    }

    #[test]
    fn starts_a_session_once_roblox_appears() {
        let mut machine = SessionMachine::new();
        machine.arm(launch(), 0);

        assert_eq!(machine.tick(2_000, false), None);
        assert_eq!(
            machine.tick(4_000, true),
            Some(SessionEvent::Started { launch: launch() })
        );
        assert!(machine.is_running());
    }

    #[test]
    fn times_out_when_roblox_never_appears() {
        let mut machine = SessionMachine::with_timings(10_000, 20_000);
        machine.arm(launch(), 0);

        assert_eq!(machine.tick(9_000, false), None);
        assert_eq!(
            machine.tick(10_000, false),
            Some(SessionEvent::TimedOut { launch: launch() })
        );
        assert!(machine.is_idle());
    }

    #[test]
    fn ends_the_session_after_the_grace_window() {
        let mut machine = SessionMachine::with_timings(10_000, 5_000);
        machine.arm(launch(), 0);
        machine.tick(1_000, true);
        machine.tick(121_000, true);

        // Gone, but still inside the grace window.
        assert_eq!(machine.tick(124_000, false), None);
        assert_eq!(
            machine.tick(126_000, false),
            Some(SessionEvent::Ended {
                launch: launch(),
                duration_seconds: 120,
                possible_crash: false,
            })
        );
        assert!(machine.is_idle());
    }

    #[test]
    fn a_restart_inside_the_grace_window_continues_the_same_session() {
        let mut machine = SessionMachine::with_timings(10_000, 5_000);
        machine.arm(launch(), 0);
        machine.tick(1_000, true);
        machine.tick(60_000, true);

        // Roblox disappears briefly, then comes back inside the grace window.
        assert_eq!(machine.tick(62_000, false), None);
        assert_eq!(machine.tick(64_000, true), None);
        assert!(machine.is_running());

        // Duration still counts from the original start, not from the restart.
        machine.tick(100_000, true);
        assert_eq!(machine.tick(103_000, false), None);
        assert_eq!(
            machine.tick(106_000, false),
            Some(SessionEvent::Ended {
                launch: launch(),
                duration_seconds: 99,
                possible_crash: false,
            })
        );
    }

    #[test]
    fn short_sessions_are_only_flagged_as_possible_crashes() {
        let mut machine = SessionMachine::with_timings(10_000, 1_000);
        machine.arm(launch(), 0);
        machine.tick(0, true);
        machine.tick(5_000, true);

        let event = machine.tick(7_000, false);
        assert_eq!(
            event,
            Some(SessionEvent::Ended {
                launch: launch(),
                duration_seconds: 5,
                possible_crash: true,
            })
        );
    }

    #[test]
    fn arming_twice_does_not_split_a_running_session() {
        let mut machine = SessionMachine::with_timings(10_000, 1_000);
        machine.arm(launch(), 0);
        machine.tick(1_000, true);

        machine.arm(PendingLaunch::default(), 2_000);
        assert!(machine.is_running());

        let event = machine.tick(70_000, true);
        assert_eq!(event, None);
        let event = machine.tick(80_000, false);
        assert!(matches!(
            event,
            Some(SessionEvent::Ended { ref launch, .. }) if launch.game_id.as_deref() == Some("game-1")
        ));
    }
}
