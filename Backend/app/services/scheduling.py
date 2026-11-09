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
    duration_minutes: int = WINDOW_MINUTES,
) -> Tuple[Optional[str], List[Dict[str, str]]]:
    """
    Returns (hours string for that weekday or None if closed, list of
    {"start": "HH:MM", "end": "HH:MM"} appointments). Start times step in
    30-minute increments from opening; each appointment lasts
    duration_minutes and must finish by closing. Past windows are not
    removed here.
    """
    day_hours = (operating_hours or {}).get(day_key_for(appointment_date))
    parsed = parse_hours(day_hours)

    if not parsed:
        return None, []

    open_minutes, close_minutes = parsed
    duration_minutes = max(int(duration_minutes or WINDOW_MINUTES), 1)
    windows = []
    start = open_minutes

    while start + duration_minutes <= close_minutes:
        windows.append(
            {
                "start": minutes_to_hhmm(start),
                "end": minutes_to_hhmm(start + duration_minutes),
            }
        )
        start += WINDOW_MINUTES

    return day_hours, windows


def appointment_range(document: dict) -> Optional[Tuple[int, int]]:
    """
    Minutes-since-midnight [start, end) occupied by a service request.
    Requests created before duration-aware scheduling only blocked their
    30-minute window, so a missing or invalid end falls back to that.
    """
    try:
        start = hhmm_to_minutes(str(document.get("appointment_start_time") or ""))
    except ValueError:
        return None

    try:
        end = hhmm_to_minutes(str(document.get("appointment_end_time") or ""))
    except ValueError:
        end = start + WINDOW_MINUTES

    if end <= start:
        end = start + WINDOW_MINUTES

    return start, end


def ranges_overlap(first: Tuple[int, int], second: Tuple[int, int]) -> bool:
    return first[0] < second[1] and second[0] < first[1]


def remove_reserved_windows(
    windows: List[Dict[str, str]],
    reserved_ranges: List[Tuple[int, int]],
) -> List[Dict[str, str]]:
    """Drops windows whose full duration overlaps any reserved appointment."""
    available = []
    for window in windows:
        window_range = (hhmm_to_minutes(window["start"]), hhmm_to_minutes(window["end"]))
        if not any(ranges_overlap(window_range, reserved) for reserved in reserved_ranges):
            available.append(window)
    return available


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
