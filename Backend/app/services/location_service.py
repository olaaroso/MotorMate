import asyncio
import re
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

    @staticmethod
    def _candidate_queries(address: str) -> list[str]:
        """
        Build progressively broader lookup queries.

        Example:
        123 Mechanic St, Farmingdale, NY 11735
        -> exact address
        -> Farmingdale, NY 11735
        -> 11735, USA

        The ZIP fallback is useful for demo/test mechanic addresses that do not
        exist in OpenStreetMap while still giving MotorMate a useful approximate
        location for nearby-shop searches.
        """
        normalized = " ".join(address.split())
        candidates = [normalized]

        parts = [part.strip() for part in normalized.split(",") if part.strip()]
        if len(parts) >= 2:
            city_region = ", ".join(parts[-2:])
            if city_region.casefold() != normalized.casefold():
                candidates.append(city_region)

        zip_match = re.search(r"\b(\d{5})(?:-\d{4})?\b", normalized)
        if zip_match:
            candidates.append(f"{zip_match.group(1)}, USA")

        # De-duplicate while preserving order.
        unique_candidates = []
        seen = set()
        for candidate in candidates:
            key = candidate.casefold()
            if key not in seen:
                seen.add(key)
                unique_candidates.append(candidate)

        return unique_candidates

    async def geocode_address(self, address: str) -> Optional[dict]:
        normalized_address = " ".join(address.split())
        if not normalized_address:
            return None

        cache_key = normalized_address.casefold()
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        candidates = self._candidate_queries(normalized_address)

        async with self._request_lock:
            # Another request may have populated the cache while we waited.
            cached = self._cache.get(cache_key)
            if cached is not None:
                return cached

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    for candidate in candidates:
                        # Nominatim public usage policy requires <= 1 request/sec.
                        delay = 1.0 - (time.monotonic() - self._last_request_at)
                        if delay > 0:
                            await asyncio.sleep(delay)

                        self._last_request_at = time.monotonic()

                        response = await client.get(
                            self.base_url,
                            params={
                                "q": candidate,
                                "format": "jsonv2",
                                "limit": 1,
                                "countrycodes": "us",
                            },
                            headers={"User-Agent": self.user_agent},
                        )
                        response.raise_for_status()
                        results = response.json()

                        if not isinstance(results, list) or not results:
                            # Do NOT cache misses. A temporary provider/data issue
                            # should be retried on the next mechanic profile save.
                            continue

                        try:
                            result = {
                                "latitude": float(results[0]["lat"]),
                                "longitude": float(results[0]["lon"]),
                                "label": results[0].get(
                                    "display_name",
                                    candidate,
                                ),
                            }
                        except (KeyError, TypeError, ValueError) as exc:
                            raise LocationProviderError(
                                "Location provider returned invalid coordinates."
                            ) from exc

                        if (
                            not -90 <= result["latitude"] <= 90
                            or not -180 <= result["longitude"] <= 180
                        ):
                            raise LocationProviderError(
                                "Location provider returned invalid coordinates."
                            )

                        # Cache the successful result for both the original address
                        # and the candidate that actually matched.
                        self._cache[cache_key] = result
                        self._cache[candidate.casefold()] = result
                        return result

            except httpx.HTTPStatusError as exc:
                raise LocationProviderError(
                    f"Location provider returned HTTP {exc.response.status_code}."
                ) from exc
            except (httpx.HTTPError, ValueError) as exc:
                raise LocationProviderError(
                    "Location provider request failed."
                ) from exc

        return None


location_service = NominatimLocationService()
