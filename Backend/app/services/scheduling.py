from datetime import date, datetime
from typing import Dict, List, Optional, Tuple

WINDOW_MINUTES = 30

DAY_KEYS = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]


def day_key_for(appointment_date: date) -> str:
    return DAY_KEYS[appointment_date.weekday()]


def _parse_clock(value: str) -> Optional[int]:
    """Parses "8:00 AM" / "08:00 AM" into minutes since midnight."""
    try:
        parsed = datetime.strptime(value.strip().upper(), "%I:%M %p")
    except ValueError:
        return None
    return parsed.hour * 60 + parsed.minute


def parse_hours(hours: Optional[str]) -> Optional[Tuple[int, int]]:
    """
    Parses an operating-hours string such as "8:00 AM - 5:00 PM" (the format
    saved by the My Shop page) into (open, close) minutes. Returns None for
    blank, malformed, or zero/negative-length hours, which are treated as closed.
    """
    if not hours or " - " not in hours:
        return None

    open_text, close_text = hours.split(" - ", 1)
    open_minutes = _parse_clock(open_text)
    close_minutes = _parse_clock(close_text)

    if open_minutes is None or close_minutes is None:
        return None

    if close_minutes <= open_minutes:
        return None

    return open_minutes, close_minutes


def minutes_to_hhmm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def hhmm_to_minutes(value: str) -> int:
    hour, minute = value.split(":")
    return int(hour) * 60 + int(minute)


def windows_for_date(
    operating_hours: Optional[Dict[str, str]],
    appointment_date: date,
) -> Tuple[Optional[str], List[Dict[str, str]]]:
    """
    Returns (hours string for that weekday or None if closed, list of
    {"start": "HH:MM", "end": "HH:MM"} 30-minute windows that fit entirely
    within the day's hours). Past windows are not removed here.
    """
    day_hours = (operating_hours or {}).get(day_key_for(appointment_date))
    parsed = parse_hours(day_hours)

    if not parsed:
        return None, []

    open_minutes, close_minutes = parsed
    windows = []
    start = open_minutes

    while start + WINDOW_MINUTES <= close_minutes:
        windows.append(
            {
                "start": minutes_to_hhmm(start),
                "end": minutes_to_hhmm(start + WINDOW_MINUTES),
            }
        )
        start += WINDOW_MINUTES

    return day_hours, windows


def remove_past_windows(
    windows: List[Dict[str, str]],
    appointment_date: date,
    now: Optional[datetime] = None,
) -> List[Dict[str, str]]:
    """
    Drops windows that have already started. Uses server-local time, which is
    fine for local dev; a deployed server would need the shop's time zone.
    """
    now = now or datetime.now()
    today = now.date()

    if appointment_date < today:
        return []

    if appointment_date > today:
        return windows

    current_time = now.strftime("%H:%M")
    return [window for window in windows if window["start"] > current_time]
