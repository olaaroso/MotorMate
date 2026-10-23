import asyncio
import time
from typing import Optional

import httpx

from app.core.config import settings


class LocationProviderError(Exception):
    pass


class NominatimLocationService:
    def __init__(self):
        self.base_url = "https://nominatim.openstreetmap.org/search"
        self.user_agent = settings.NOMINATIM_USER_AGENT
        self._cache: dict[str, Optional[dict]] = {}
        self._request_lock = asyncio.Lock()
        self._last_request_at = 0.0

    async def geocode_address(self, address: str) -> Optional[dict]:
        normalized_address = " ".join(address.split())
        cache_key = normalized_address.casefold()
        if cache_key in self._cache:
            return self._cache[cache_key]

        async with self._request_lock:
            if cache_key in self._cache:
                return self._cache[cache_key]

            delay = 1.0 - (time.monotonic() - self._last_request_at)
            if delay > 0:
                await asyncio.sleep(delay)

            self._last_request_at = time.monotonic()
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(
                        self.base_url,
                        params={"q": normalized_address, "format": "jsonv2", "limit": 1},
                        headers={"User-Agent": self.user_agent},
                    )
                    response.raise_for_status()
                    results = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                raise LocationProviderError("Location provider request failed.") from exc

            if not isinstance(results, list) or not results:
                self._cache[cache_key] = None
                return None

            try:
                result = {
                    "latitude": float(results[0]["lat"]),
                    "longitude": float(results[0]["lon"]),
                    "label": results[0].get("display_name", normalized_address),
                }
            except (KeyError, TypeError, ValueError) as exc:
                raise LocationProviderError("Location provider returned invalid coordinates.") from exc

            if not -90 <= result["latitude"] <= 90 or not -180 <= result["longitude"] <= 180:
                raise LocationProviderError("Location provider returned invalid coordinates.")

            self._cache[cache_key] = result
            return result


location_service = NominatimLocationService()