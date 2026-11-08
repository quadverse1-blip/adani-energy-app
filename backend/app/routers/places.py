from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.services.places_service import places_service

router = APIRouter(prefix="/places", tags=["Nearby Places & POI Search"])

@router.get("/nearby", summary="Search nearby places and businesses around employee coordinates")
async def get_nearby_places(
    lat: float = Query(..., description="Latitude of employee position (WGS84)", ge=-90.0, le=90.0),
    lon: float = Query(..., description="Longitude of employee position (WGS84)", ge=-180.0, le=180.0),
    radius: float = Query(1000.0, description="Search radius in meters (e.g. 500, 1000, 2000, 5000)", ge=50.0, le=25000.0),
    category: Optional[str] = Query(None, description="Filter category: healthcare, fuel, financial, food, shop, transit, civic, education"),
    query: Optional[str] = Query(None, description="Optional text filter: e.g. Apollo, Petrol, SBI, D-Mart"),
    limit: int = Query(50, description="Maximum results to return", ge=1, le=100)
):
    """
    Returns nearby real-world places (shops, pharmacies, petrol pumps, banks, hospitals, stations)
    within the specified radius of the employee's current GPS position throughout Maharashtra.
    Distances are calculated using high-precision Haversine formula and sorted ascending.
    """
    try:
        results = places_service.search_nearby(
            lat=lat,
            lon=lon,
            radius_meters=radius,
            category=category,
            query=query,
            limit=limit
        )
        return {
            "status": "success",
            "center": {"latitude": lat, "longitude": lon},
            "radius_meters": radius,
            "filter_category": category,
            "query": query,
            "count": len(results),
            "places": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch nearby places: {str(e)}")

@router.get("/search", summary="Search places by name, landmark, road or business")
async def search_places(
    q: str = Query(..., description="Search query string: e.g. 'Apollo Hospital', 'Hinjewadi Petrol Pump', 'BKC'", min_length=1),
    lat: Optional[float] = Query(None, description="Optional bias latitude for proximity ranking", ge=-90.0, le=90.0),
    lon: Optional[float] = Query(None, description="Optional bias longitude for proximity ranking", ge=-180.0, le=180.0),
    limit: int = Query(30, description="Maximum results to return", ge=1, le=50)
):
    """
    Search places across Maharashtra by shop name, landmark, locality, brand, or category.
    When employee latitude and longitude are supplied, results are ranked with proximity weighting.
    """
    try:
        results = places_service.search_text(query=q, lat=lat, lon=lon, limit=limit)
        return {
            "status": "success",
            "query": q,
            "bias_location": {"latitude": lat, "longitude": lon} if lat is not None and lon is not None else None,
            "count": len(results),
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Place search failed: {str(e)}")

@router.get("/categories", summary="List supported place categories with metadata")
async def get_categories():
    """
    Returns all POI categories with icons, theme colors, and available place counts.
    """
    try:
        cats = places_service.get_categories()
        return {
            "status": "success",
            "count": len(cats),
            "categories": cats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")

@router.get("/reverse-geocode", summary="Reverse geocode coordinates to street and locality")
async def reverse_geocode_place(
    lat: float = Query(..., description="Latitude", ge=-90.0, le=90.0),
    lon: float = Query(..., description="Longitude", ge=-180.0, le=180.0)
):
    """
    Translates employee GPS coordinates into real road, locality, city, and state name.
    """
    try:
        return places_service.reverse_geocode(lat, lon)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reverse geocode failed: {str(e)}")

@router.get("/coverage", summary="Maharashtra OSM POI coverage evaluation report")
async def get_coverage_report():
    """
    Returns verified POI statistics across Maharashtra districts (Mumbai, Pune, Nashik, Nagpur, Thane).
    """
    try:
        report = places_service.get_coverage_report()
        return {
            "status": "success",
            "coverage": report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate coverage report: {str(e)}")

