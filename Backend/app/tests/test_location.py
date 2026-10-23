import asyncio
from unittest.mock import AsyncMock, Mock

from app.api import routes_location
from app.services.location_service import NominatimLocationService


def test_geocode_address_parses_and_caches_response(monkeypatch):
    response = Mock()
    response.json.return_value = [
        {"lat": "40.7128", "lon": "-74.0060", "display_name": "New York, NY"}
    ]
    response.raise_for_status = Mock()

    client = AsyncMock()
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    client.get.return_value = response
    monkeypatch.setattr(
        "app.services.location_service.httpx.AsyncClient",
        lambda **kwargs: client,
    )

    service = NominatimLocationService()
    first_result = asyncio.run(service.geocode_address(" New York, NY "))
    second_result = asyncio.run(service.geocode_address("new york, ny"))

    assert first_result == {
        "latitude": 40.7128,
        "longitude": -74.006,
        "label": "New York, NY",
    }
    assert second_result == first_result
    client.get.assert_awaited_once()


def test_nearest_mechanics_uses_geo_search_and_formats_results(monkeypatch):
    mechanic = {
        "_id": "shop-1",
        "shop_name": "Northside Auto",
        "address": "10 Main St",
        "services_offered": ["Brakes"],
        "price_per_hour": 100,
        "distance_meters": 2450,
    }
    cursor = Mock()
    cursor.to_list = AsyncMock(return_value=[mechanic])
    collection = Mock()
    collection.create_index = AsyncMock()
    collection.aggregate.return_value = cursor
    database = {"mechanics": collection}
    monkeypatch.setattr(routes_location.db_instance, "db", database)
    monkeypatch.setattr(
        routes_location.location_service,
        "geocode_address",
        AsyncMock(
            return_value={
                "latitude": 40.7,
                "longitude": -74.0,
                "label": "Customer address",
            }
        ),
    )

    result = asyncio.run(
        routes_location.nearest_mechanics(
            address="Customer address",
            radius_km=25,
            limit=5,
            service_needed="Brakes",
        )
    )

    pipeline = collection.aggregate.call_args.args[0]
    assert pipeline[0]["$geoNear"]["near"]["coordinates"] == [-74.0, 40.7]
    assert pipeline[0]["$geoNear"]["query"] == {"services_offered": "Brakes"}
    assert result["results"][0]["distance_km"] == 2.45
    assert result["attribution"] == "OpenStreetMap contributors"