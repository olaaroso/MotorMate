from typing import Iterable, List


def match_mechanics(mechanics: Iterable[dict], service_needed: str, zip_code: str) -> List[dict]:
    """Score mechanics by zip-code match and service availability."""
    matches = []
    for mechanic in mechanics:
        services = mechanic.get("services_offered", [])
        if service_needed not in services:
            continue

        address = mechanic.get("address", "")
        zip_match = zip_code in address if zip_code else True
        if not zip_match:
            continue

        base_score = 60 + (10 if zip_match else 0)
        rating = mechanic.get("rating", 5.0)
        price = mechanic.get("price_per_hour", 0)
        score = base_score + rating * 10 - (price / 20)
        matches.append({**mechanic, "match_score": round(score, 2)})

    return sorted(matches, key=lambda item: item["match_score"], reverse=True)
