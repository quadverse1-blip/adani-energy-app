import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.places_service import places_service

client = TestClient(app)

def test_get_categories():
    response = client.get("/places/categories")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["count"] > 0
    cat_ids = [c["id"] for c in data["categories"]]
    assert "healthcare" in cat_ids
    assert "fuel" in cat_ids
    assert "financial" in cat_ids
    assert "shop" in cat_ids

def test_nearby_places_mumbai_bkc():
    # Mumbai BKC coordinates
    bkc_lat = 19.0657
    bkc_lon = 72.8687

    # 1 km radius
    resp = client.get(f"/places/nearby?lat={bkc_lat}&lon={bkc_lon}&radius=1000")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["count"] > 0
    
    # Verify sorting by distance ascending
    distances = [p["distance_meters"] for p in data["places"]]
    assert distances == sorted(distances)
    
    # Verify distance fields
    first_place = data["places"][0]
    assert "formatted_distance" in first_place
    assert first_place["distance_type"] == "straight_line"
    assert first_place["city"] == "Mumbai"

def test_nearby_places_category_filter():
    bkc_lat = 19.0657
    bkc_lon = 72.8687
    
    # Filter for fuel only
    resp = client.get(f"/places/nearby?lat={bkc_lat}&lon={bkc_lon}&radius=2000&category=fuel")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] > 0
    for p in data["places"]:
        assert p["category"] == "fuel"

def test_nearby_places_radius_expansion():
    # Pune Hinjewadi coordinates
    pune_lat = 18.5913
    pune_lon = 73.7389

    # 500m
    resp_500 = client.get(f"/places/nearby?lat={pune_lat}&lon={pune_lon}&radius=500")
    # 2000m
    resp_2000 = client.get(f"/places/nearby?lat={pune_lat}&lon={pune_lon}&radius=2000")
    
    data_500 = resp_500.json()
    data_2000 = resp_2000.json()
    
    assert data_2000["count"] >= data_500["count"]

def test_search_places_by_name_and_landmark():
    # Search for Apollo
    resp = client.get("/places/search?q=Apollo")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["count"] > 0
    assert any("apollo" in p["name"].lower() for p in data["results"])

    # Search for Petrol Pump with location bias (BKC)
    resp_pump = client.get("/places/search?q=Petrol&lat=19.0657&lon=72.8687")
    assert resp_pump.status_code == 200
    data_pump = resp_pump.json()
    assert data_pump["count"] > 0
    assert data_pump["results"][0]["distance_meters"] is not None

def test_coverage_evaluation_report():
    resp = client.get("/places/coverage")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    cov = data["coverage"]
    assert cov["total_places"] >= 20
    assert "Mumbai" in cov["district_breakdown"]
    assert "Pune" in cov["district_breakdown"]
    assert "Nashik" in cov["district_breakdown"]
    assert "Nagpur" in cov["district_breakdown"]
    assert "Thane" in cov["district_breakdown"]

