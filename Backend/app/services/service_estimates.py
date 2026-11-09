from typing import Iterable, List, Optional

from app.services.scheduling import WINDOW_MINUTES

DEFAULT_SERVICE_MINUTES = WINDOW_MINUTES


def normalize_service_estimates(
    services_offered: Iterable[str],
    estimates: Iterable[dict],
) -> List[dict]:
    """
    Keeps one estimate per offered service (matched case-insensitively) and
    stores it under the service's canonical name. Estimates for services
    that are not offered, and estimates with no values, are dropped.
    """
    canonical = {
        str(name).strip().casefold(): str(name).strip()
        for name in services_offered
        if str(name).strip()
    }
    normalized = {}

    for estimate in estimates:
        key = str(estimate.get("name") or "").strip().casefold()
        if key not in canonical or key in normalized:
            continue

        price = estimate.get("estimated_price")
        duration = estimate.get("estimated_duration_minutes")
        if price is None and duration is None:
            continue

        normalized[key] = {
            "name": canonical[key],
            "estimated_price": round(float(price), 2) if price is not None else None,
            "estimated_duration_minutes": int(duration) if duration is not None else None,
        }

    return list(normalized.values())


def find_service_estimate(mechanic: dict, service_name: str) -> Optional[dict]:
    """The mechanic's current estimate for a service they still offer."""
    key = str(service_name or "").strip().casefold()
    if not key:
        return None

    offered = {
        str(name).strip().casefold()
        for name in mechanic.get("services_offered") or []
    }
    if key not in offered:
        return None

    for estimate in mechanic.get("service_estimates") or []:
        if str(estimate.get("name") or "").strip().casefold() == key:
            return estimate
    return None


def service_duration_minutes(estimate: Optional[dict]) -> int:
    duration = (estimate or {}).get("estimated_duration_minutes")
    try:
        duration = int(duration)
    except (TypeError, ValueError):
        return DEFAULT_SERVICE_MINUTES
    return duration if duration > 0 else DEFAULT_SERVICE_MINUTES
