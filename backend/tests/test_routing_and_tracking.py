import pytest
import asyncio
from app.routers.routing import get_road_route, _generate_fallback_route
from app.core.database import db
from datetime import datetime

def test_osrm_fallback_generation():
    # Test route from BKC Mumbai to Navi Mumbai
    res = _generate_fallback_route(19.0657, 72.8687, 19.1136, 73.0169)
    assert res["success"] is True
    assert res["distanceKm"] > 5.0
    assert res["durationMinutes"] > 0
    assert len(res["coordinates"]) >= 4
    assert res["geojson"]["type"] == "Feature"
    assert res["geojson"]["geometry"]["type"] == "LineString"

def test_get_road_route():
    res = asyncio.run(get_road_route(19.0657, 72.8687, 19.1136, 73.0169, False))
    assert res["success"] is True
    assert res["distanceKm"] > 0
    assert res["durationMinutes"] > 0
    assert len(res["coordinates"]) > 0

def test_location_ping_and_history():
    emp_id = "emp_demo_technician"
    ping_data = {
        "employeeId": emp_id,
        "employeeCode": "TECH001",
        "latitude": 19.0657,
        "longitude": 72.8687,
        "accuracy": 8.5,
        "speed": 12.4,
        "heading": 180.0,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "timestampIST": "02:30 PM IST",
        "dateIST": "2026-11-07",
        "locationName": "BKC Mumbai Substation"
    }
    saved = db.save_location_ping(ping_data)
    assert saved["_id"].startswith("loc_")

    history = db.get_location_history(emp_id, "2026-11-07")
    assert len(history) >= 1
    assert any(h["latitude"] == 19.0657 for h in history)

