"""
Human Response Delay System
============================
Simulates realistic human interaction timing for Telegram AI accounts.
"""
from __future__ import annotations

import asyncio
import math
import random
import time
from dataclasses import dataclass, field
from datetime import datetime, time as dtime
from enum import Enum
from typing import Any


# ── Enums ─────────────────────────────────────────────────────────────────────

class TypingSpeed(str, Enum):
    SLOW = "slow"           # 80-120 CPM
    HUMAN = "human"         # 150-280 CPM
    FAST = "fast"           # 300-450 CPM
    VARIABLE = "variable"   # random per session


class ActivityLevel(str, Enum):
    ACTIVE = "active"
    IDLE = "idle"
    AWAY = "away"
    SLEEP = "sleep"


# ── Config Dataclasses ────────────────────────────────────────────────────────

@dataclass
class DelayConfig:
    """Global or per-account delay configuration."""
    min_reply_delay: float = 10.0          # seconds
    max_reply_delay: float = 180.0         # seconds
    typing_enabled: bool = True
    typing_speed: TypingSpeed = TypingSpeed.HUMAN
    online_simulation: bool = True
    night_slow_mode: bool = True           # longer delays 23h–7h
    random_breaks: bool = True             # occasional long pauses
    reading_simulation: bool = True        # simulate reading before replying
    reading_speed_wpm: int = 220           # words per minute read speed
    priority_users: list[str] = field(default_factory=list)    # usernames with shorter delays
    priority_multiplier: float = 0.3       # fraction of normal delay for priority users
    night_multiplier: float = 3.0          # multiply delays during night hours
    night_start_hour: int = 23
    night_end_hour: int = 7
    break_probability: float = 0.05        # 5% chance of random break
    break_min_duration: float = 300.0      # 5 minutes
    break_max_duration: float = 1800.0     # 30 minutes
    active_hours_start: int = 8
    active_hours_end: int = 23
    context_adaptation: bool = True        # adapt timing to conversation importance


@dataclass
class GroupDelayConfig:
    """Per-group delay overrides."""
    group_id: int = 0
    min_reply_delay: float | None = None
    max_reply_delay: float | None = None
    priority_level: int = 1                # 1=normal, 2=high, 3=critical
    typing_enabled: bool = True


@dataclass
class ActivitySchedule:
    """Online/offline rotation schedule."""
    active_periods: list[tuple[int, int]] = field(default_factory=lambda: [(8, 12), (13, 17), (18, 22)])
    cooldown_minutes: float = 30.0
    max_continuous_active_minutes: float = 120.0
    random_offline_probability: float = 0.03  # per-check probability of going offline


# ── TypingSimulator ────────────────────────────────────────────────────────────

class TypingSimulator:
    """Simulates realistic typing behavior with interruptions and speed variation."""

    CPM_RANGES = {
        TypingSpeed.SLOW: (80, 120),
        TypingSpeed.HUMAN: (150, 280),
        TypingSpeed.FAST: (300, 450),
        TypingSpeed.VARIABLE: (80, 450),
    }

    @classmethod
    def calculate_typing_duration(
        cls,
        message: str,
        speed: TypingSpeed = TypingSpeed.HUMAN,
        with_interruptions: bool = True,
    ) -> float:
        """
        Returns realistic typing duration in seconds.

        Short  (<50 chars)  : 2–5s
        Medium (50–200)     : 5–15s
        Long   (200–500)    : 15–45s
        Very long (>500)    : 45–90s
        """
        char_count = len(message)
        cpm_min, cpm_max = cls.CPM_RANGES[speed]

        # Gaussian speed for this session
        mean_cpm = (cpm_min + cpm_max) / 2
        std_cpm = (cpm_max - cpm_min) / 6
        cpm = max(cpm_min, min(cpm_max, random.gauss(mean_cpm, std_cpm)))

        base_duration = (char_count / cpm) * 60.0

        # Minimum floors per message size
        if char_count < 50:
            base_duration = max(2.0, base_duration)
        elif char_count < 200:
            base_duration = max(5.0, base_duration)
        elif char_count < 500:
            base_duration = max(15.0, base_duration)
        else:
            base_duration = max(45.0, base_duration)

        # Cap
        base_duration = min(90.0, base_duration)

        # Random interruptions (pause mid-typing, like a human reconsidering)
        if with_interruptions and char_count > 80:
            num_interruptions = random.randint(0, max(1, char_count // 150))
            interruption_time = sum(random.uniform(0.5, 3.0) for _ in range(num_interruptions))
            base_duration += interruption_time

        # Add small random jitter ±15%
        jitter = random.uniform(0.85, 1.15)
        return base_duration * jitter

    @classmethod
    async def simulate(
        cls,
        message: str,
        speed: TypingSpeed = TypingSpeed.HUMAN,
        on_typing_start: Any = None,
        on_typing_stop: Any = None,
    ) -> float:
        """Simulate typing and return actual duration."""
        duration = cls.calculate_typing_duration(message, speed)

        if on_typing_start:
            await on_typing_start()

        await asyncio.sleep(duration)

        if on_typing_stop:
            await on_typing_stop()

        return duration


# ── ReadingSimulationEngine ────────────────────────────────────────────────────

class ReadingSimulationEngine:
    """Simulates the time to read an incoming message before replying."""

    @staticmethod
    def calculate_reading_time(message: str, wpm: int = 220) -> float:
        """
        Estimate reading time based on word count.
        Adds a small pause for comprehension.
        """
        word_count = len(message.split())
        reading_seconds = (word_count / wpm) * 60.0

        # Floor: even a 1-word message takes ~0.5s to register
        reading_seconds = max(0.5, reading_seconds)

        # Comprehension pause: longer for complex/important messages
        if word_count > 50:
            comprehension_pause = random.uniform(1.0, 3.0)
        elif word_count > 20:
            comprehension_pause = random.uniform(0.5, 1.5)
        else:
            comprehension_pause = random.uniform(0.2, 0.8)

        return reading_seconds + comprehension_pause

    @classmethod
    async def simulate_reading(cls, message: str, wpm: int = 220) -> float:
        duration = cls.calculate_reading_time(message, wpm)
        await asyncio.sleep(duration)
        return duration


# ── SmartResponseTimer ─────────────────────────────────────────────────────────

class SmartResponseTimer:
    """
    Intelligently calculates response delay considering:
    - message length
    - time of day
    - user priority
    - account activity level
    - personality profile
    - group activity
    """

    def __init__(self, config: DelayConfig):
        self.config = config

    def _is_night_time(self, hour: int | None = None) -> bool:
        h = hour if hour is not None else datetime.now().hour
        if self.config.night_start_hour > self.config.night_end_hour:
            return h >= self.config.night_start_hour or h < self.config.night_end_hour
        return self.config.night_start_hour <= h < self.config.night_end_hour

    def _is_active_hours(self, hour: int | None = None) -> bool:
        h = hour if hour is not None else datetime.now().hour
        return self.config.active_hours_start <= h < self.config.active_hours_end

    def calculate_base_delay(
        self,
        incoming_message: str = "",
        sender_username: str | None = None,
        group_config: GroupDelayConfig | None = None,
        activity_level: ActivityLevel = ActivityLevel.ACTIVE,
    ) -> float:
        """Calculate the total delay before starting to reply."""
        cfg = self.config
        now_hour = datetime.now().hour

        # Base: random within [min, max] using beta distribution for naturalness
        min_d = cfg.min_reply_delay
        max_d = cfg.max_reply_delay

        # Override with group config if present
        if group_config:
            if group_config.min_reply_delay is not None:
                min_d = group_config.min_reply_delay
            if group_config.max_reply_delay is not None:
                max_d = group_config.max_reply_delay
            # Priority groups get faster replies
            if group_config.priority_level >= 3:
                max_d = min(max_d, min_d * 2)
            elif group_config.priority_level >= 2:
                max_d = min(max_d, max_d * 0.5)

        # Beta distribution (skewed toward shorter delays, feels more natural)
        alpha, beta = 2.0, 5.0
        t = random.betavariate(alpha, beta)
        delay = min_d + t * (max_d - min_d)

        # Night slow mode
        if cfg.night_slow_mode and self._is_night_time(now_hour):
            delay *= cfg.night_multiplier

        # Activity level multiplier
        activity_multipliers = {
            ActivityLevel.ACTIVE: 1.0,
            ActivityLevel.IDLE: 1.8,
            ActivityLevel.AWAY: 4.0,
            ActivityLevel.SLEEP: 0.0,  # no reply during sleep
        }
        multiplier = activity_multipliers.get(activity_level, 1.0)
        if multiplier == 0.0:
            return -1  # signal: do not reply

        delay *= multiplier

        # Priority user: shorter delay
        if sender_username and sender_username in cfg.priority_users:
            delay *= cfg.priority_multiplier

        # Contextual: longer message = slightly longer "thinking" time
        if cfg.context_adaptation and incoming_message:
            word_count = len(incoming_message.split())
            thinking_bonus = math.log1p(word_count) * 1.5
            delay += thinking_bonus

        return max(1.0, delay)

    async def wait_before_reply(
        self,
        incoming_message: str = "",
        sender_username: str | None = None,
        group_config: GroupDelayConfig | None = None,
        activity_level: ActivityLevel = ActivityLevel.ACTIVE,
    ) -> float:
        """Full pre-reply sequence: reading delay + base delay."""
        total = 0.0

        # 1. Reading simulation
        if self.config.reading_simulation and incoming_message:
            reading_time = await ReadingSimulationEngine.simulate_reading(
                incoming_message, self.config.reading_speed_wpm
            )
            total += reading_time

        # 2. Base response delay
        delay = self.calculate_base_delay(
            incoming_message, sender_username, group_config, activity_level
        )

        if delay < 0:
            return -1  # sleep mode, don't reply

        await asyncio.sleep(delay)
        total += delay

        return total


# ── ActivityTimingController ───────────────────────────────────────────────────

class ActivityTimingController:
    """
    Manages online/offline presence simulation.
    Tracks the account's current activity state and transitions.
    """

    def __init__(self, schedule: ActivitySchedule, config: DelayConfig):
        self.schedule = schedule
        self.config = config
        self._state: ActivityLevel = ActivityLevel.IDLE
        self._session_start: float = time.time()
        self._last_activity: float = time.time()
        self._break_until: float = 0.0

    @property
    def current_state(self) -> ActivityLevel:
        return self._state

    def _in_active_period(self) -> bool:
        h = datetime.now().hour
        return any(start <= h < end for start, end in self.schedule.active_periods)

    def update_state(self) -> ActivityLevel:
        """Recalculate and return current activity state."""
        now = time.time()

        # Night / sleep mode
        h = datetime.now().hour
        if not self._in_active_period():
            self._state = ActivityLevel.SLEEP
            return self._state

        # Currently on break
        if now < self._break_until:
            self._state = ActivityLevel.AWAY
            return self._state

        # Decide if a random break should start
        if self.config.random_breaks and random.random() < self.schedule.random_offline_probability:
            break_duration = random.uniform(
                self.schedule.cooldown_minutes * 60,
                min(self.schedule.max_continuous_active_minutes * 60,
                    self.schedule.cooldown_minutes * 60 * 3)
            )
            self._break_until = now + break_duration
            self._state = ActivityLevel.AWAY
            return self._state

        # Max continuous active time
        active_secs = now - self._session_start
        if active_secs > self.schedule.max_continuous_active_minutes * 60:
            break_duration = self.schedule.cooldown_minutes * 60 * random.uniform(0.8, 1.4)
            self._break_until = now + break_duration
            self._session_start = now + break_duration
            self._state = ActivityLevel.AWAY
            return self._state

        # Idle if no activity for >5 minutes
        idle_secs = now - self._last_activity
        if idle_secs > 300:
            self._state = ActivityLevel.IDLE
        else:
            self._state = ActivityLevel.ACTIVE

        return self._state

    def mark_activity(self):
        """Call when the account sends or receives a message."""
        self._last_activity = time.time()
        if self._state != ActivityLevel.ACTIVE:
            self._session_start = time.time()
        self._state = ActivityLevel.ACTIVE

    def get_status_dict(self) -> dict:
        state = self.update_state()
        now = time.time()
        return {
            "state": state.value,
            "in_active_period": self._in_active_period(),
            "on_break": now < self._break_until,
            "break_remaining_seconds": max(0.0, self._break_until - now),
            "session_active_minutes": (now - self._session_start) / 60,
            "last_activity_seconds_ago": now - self._last_activity,
        }


# ── AdaptiveDelayManager ───────────────────────────────────────────────────────

class AdaptiveDelayManager:
    """
    High-level manager that combines all components.
    Learns from interaction patterns to adjust timing.
    """

    def __init__(
        self,
        config: DelayConfig,
        schedule: ActivitySchedule | None = None,
    ):
        self.config = config
        self.schedule = schedule or ActivitySchedule()
        self.timer = SmartResponseTimer(config)
        self.activity = ActivityTimingController(self.schedule, config)
        self._message_history: list[float] = []   # timestamps of sent messages
        self._group_configs: dict[int, GroupDelayConfig] = {}

    def configure_group(self, group_id: int, cfg: GroupDelayConfig):
        self._group_configs[group_id] = cfg

    def _get_safe_interval(self) -> float:
        """Anti-spam: calculate safe interval based on recent volume."""
        now = time.time()
        recent = [t for t in self._message_history if now - t < 3600]
        count = len(recent)
        if count < 5:
            return 0.0
        elif count < 20:
            return random.uniform(15, 45)
        elif count < 60:
            return random.uniform(60, 180)
        elif count < 120:
            return random.uniform(180, 600)
        else:
            return random.uniform(600, 1800)

    async def compute_full_delay(
        self,
        incoming_message: str = "",
        sender_username: str | None = None,
        group_id: int | None = None,
    ) -> dict:
        """
        Computes the complete delay profile for a reply.
        Returns a dict with all timing components.
        """
        # Update activity state
        activity = self.activity.update_state()

        if activity == ActivityLevel.SLEEP:
            return {"should_reply": False, "reason": "sleep_mode", "total_delay": -1}

        group_config = self._group_configs.get(group_id) if group_id else None

        # Reading time estimate
        reading_time = (
            ReadingSimulationEngine.calculate_reading_time(
                incoming_message, self.config.reading_speed_wpm
            ) if self.config.reading_simulation and incoming_message else 0.0
        )

        # Base reply delay
        base_delay = self.timer.calculate_base_delay(
            incoming_message, sender_username, group_config, activity
        )

        # Typing duration
        typing_duration = (
            TypingSimulator.calculate_typing_duration(
                incoming_message or "short reply",
                self.config.typing_speed,
            ) if self.config.typing_enabled else 0.0
        )

        # Anti-spam safety interval
        safe_interval = self._get_safe_interval()

        total = reading_time + max(base_delay, safe_interval)

        return {
            "should_reply": True,
            "activity_state": activity.value,
            "reading_delay_seconds": round(reading_time, 2),
            "response_delay_seconds": round(max(base_delay, safe_interval), 2),
            "typing_duration_seconds": round(typing_duration, 2),
            "total_delay_seconds": round(total, 2),
            "safe_interval_applied": safe_interval > base_delay,
            "night_mode_active": self.timer._is_night_time(),
            "on_break": self.activity.current_state == ActivityLevel.AWAY,
        }

    async def execute_reply_sequence(
        self,
        incoming_message: str,
        outgoing_message: str,
        sender_username: str | None = None,
        group_id: int | None = None,
        on_typing_start: Any = None,
        on_typing_stop: Any = None,
    ) -> dict:
        """
        Execute the full realistic reply sequence:
        1. Reading delay
        2. Response delay (thinking)
        3. Typing simulation
        """
        activity = self.activity.update_state()

        if activity == ActivityLevel.SLEEP:
            return {"executed": False, "reason": "sleep_mode"}

        group_config = self._group_configs.get(group_id) if group_id else None
        timing = {}

        # Step 1: Reading simulation
        if self.config.reading_simulation and incoming_message:
            reading_time = await ReadingSimulationEngine.simulate_reading(
                incoming_message, self.config.reading_speed_wpm
            )
            timing["reading_seconds"] = round(reading_time, 2)

        # Step 2: Response delay
        delay = self.timer.calculate_base_delay(
            incoming_message, sender_username, group_config, activity
        )
        safe = self._get_safe_interval()
        actual_delay = max(delay, safe)
        await asyncio.sleep(actual_delay)
        timing["response_delay_seconds"] = round(actual_delay, 2)
        timing["safe_interval_applied"] = safe > delay

        # Step 3: Typing simulation
        if self.config.typing_enabled:
            typing_time = await TypingSimulator.simulate(
                outgoing_message, self.config.typing_speed, on_typing_start, on_typing_stop
            )
            timing["typing_seconds"] = round(typing_time, 2)

        timing["total_seconds"] = round(sum(v for v in timing.values() if isinstance(v, float)), 2)

        # Record message timestamp for anti-spam tracking
        self._message_history.append(time.time())
        self._message_history = self._message_history[-500:]  # keep last 500
        self.activity.mark_activity()

        return {"executed": True, "timing": timing}


# ── HumanDelayEngine (entry point) ────────────────────────────────────────────

class HumanDelayEngine:
    """
    Top-level engine managing per-account AdaptiveDelayManagers.
    """

    def __init__(self):
        self._managers: dict[int, AdaptiveDelayManager] = {}
        self._default_config = DelayConfig()

    def configure_account(
        self,
        account_id: int,
        config_dict: dict,
        schedule_dict: dict | None = None,
    ) -> AdaptiveDelayManager:
        """Create or update the AdaptiveDelayManager for an account."""
        cfg = DelayConfig(
            min_reply_delay=config_dict.get("min_reply_delay", 10.0),
            max_reply_delay=config_dict.get("max_reply_delay", 180.0),
            typing_enabled=config_dict.get("typing_enabled", True),
            typing_speed=TypingSpeed(config_dict.get("typing_speed", "human")),
            online_simulation=config_dict.get("online_simulation", True),
            night_slow_mode=config_dict.get("night_slow_mode", True),
            random_breaks=config_dict.get("random_breaks", True),
            reading_simulation=config_dict.get("reading_simulation", True),
            reading_speed_wpm=config_dict.get("reading_speed_wpm", 220),
            priority_users=config_dict.get("priority_users", []),
            priority_multiplier=config_dict.get("priority_multiplier", 0.3),
            night_multiplier=config_dict.get("night_multiplier", 3.0),
            night_start_hour=config_dict.get("night_start_hour", 23),
            night_end_hour=config_dict.get("night_end_hour", 7),
            break_probability=config_dict.get("break_probability", 0.05),
            break_min_duration=config_dict.get("break_min_duration", 300.0),
            break_max_duration=config_dict.get("break_max_duration", 1800.0),
            active_hours_start=config_dict.get("active_hours_start", 8),
            active_hours_end=config_dict.get("active_hours_end", 23),
            context_adaptation=config_dict.get("context_adaptation", True),
        )

        sched = None
        if schedule_dict:
            sched = ActivitySchedule(
                active_periods=schedule_dict.get("active_periods", [(8, 12), (13, 17), (18, 22)]),
                cooldown_minutes=schedule_dict.get("cooldown_minutes", 30.0),
                max_continuous_active_minutes=schedule_dict.get("max_continuous_active_minutes", 120.0),
                random_offline_probability=schedule_dict.get("random_offline_probability", 0.03),
            )

        manager = AdaptiveDelayManager(cfg, sched)
        self._managers[account_id] = manager
        return manager

    def get_manager(self, account_id: int) -> AdaptiveDelayManager:
        if account_id not in self._managers:
            self._managers[account_id] = AdaptiveDelayManager(self._default_config)
        return self._managers[account_id]

    def configure_group(self, account_id: int, group_id: int, group_cfg: dict):
        mgr = self.get_manager(account_id)
        gcfg = GroupDelayConfig(
            group_id=group_id,
            min_reply_delay=group_cfg.get("min_reply_delay"),
            max_reply_delay=group_cfg.get("max_reply_delay"),
            priority_level=group_cfg.get("priority_level", 1),
            typing_enabled=group_cfg.get("typing_enabled", True),
        )
        mgr.configure_group(group_id, gcfg)

    async def compute_timing(
        self, account_id: int, incoming: str = "", sender: str | None = None, group_id: int | None = None
    ) -> dict:
        return await self.get_manager(account_id).compute_full_delay(incoming, sender, group_id)

    def get_activity_status(self, account_id: int) -> dict:
        return self.get_manager(account_id).activity.get_status_dict()

    def simulate_timing_preview(self, config_dict: dict, message: str = "Hello, how are you doing today?") -> dict:
        """Preview timing values without actually sleeping — for dashboard display."""
        cfg = DelayConfig(
            min_reply_delay=config_dict.get("min_reply_delay", 10.0),
            max_reply_delay=config_dict.get("max_reply_delay", 180.0),
            typing_enabled=config_dict.get("typing_enabled", True),
            typing_speed=TypingSpeed(config_dict.get("typing_speed", "human")),
            reading_simulation=config_dict.get("reading_simulation", True),
            reading_speed_wpm=config_dict.get("reading_speed_wpm", 220),
            night_slow_mode=config_dict.get("night_slow_mode", True),
            context_adaptation=config_dict.get("context_adaptation", True),
        )
        timer = SmartResponseTimer(cfg)

        reading = ReadingSimulationEngine.calculate_reading_time(message, cfg.reading_speed_wpm)
        base = timer.calculate_base_delay(message)
        typing_short = TypingSimulator.calculate_typing_duration("ok", cfg.typing_speed)
        typing_medium = TypingSimulator.calculate_typing_duration("Sure, let me check that for you!", cfg.typing_speed)
        typing_long = TypingSimulator.calculate_typing_duration(
            "That's a great question! Let me provide you with a comprehensive answer...", cfg.typing_speed
        )

        return {
            "reading_delay_seconds": round(reading, 2),
            "base_response_delay_seconds": round(base, 2),
            "typing_short_message_seconds": round(typing_short, 2),
            "typing_medium_message_seconds": round(typing_medium, 2),
            "typing_long_message_seconds": round(typing_long, 2),
            "total_estimated_seconds": round(reading + base, 2),
            "night_mode_would_apply": timer._is_night_time(),
            "effective_max_delay": round(base * cfg.night_multiplier if timer._is_night_time() else base, 2),
        }


# ── Global singleton ───────────────────────────────────────────────────────────
delay_engine = HumanDelayEngine()
