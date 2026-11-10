import math
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Query, HTTPException, Depends
from pydantic import BaseModel
import requests

from app.core.security import get_current_user_token
from app.utils.haversine import calculate_haversine_distance

logger = logging.getLogger("routing")

router = APIRouter(prefix="/routing", tags=["OSRM Road Routing & Navigation"])

# Primary & fallback OSRM endpoints
OSRM_SERVERS = [
    "http://router.project-osrm.org",
    "https://routing.openstreetmap.de/routed-car"
]

class GpsPoint(BaseModel):
    latitude: float
    longitude: float
    timestamp: Optional[str] = None
    accuracy: Optional[float] = None
    speed: Optional[float] = None

class MatchRequest(BaseModel):
    points: List[GpsPoint]

def _format_duration(seconds: float) -> str:
    mins = int(round(seconds / 60.0))
    if mins < 60:
        return f"{mins} min" if mins == 1 else f"{mins} mins"
    hrs = mins // 60
    rem_mins = mins % 60
    if rem_mins == 0:
        return f"{hrs} hr" if hrs == 1 else f"{hrs} hrs"
    return f"{hrs}h {rem_mins}m"

def _generate_fallback_route(start_lat: float, start_lon: float, end_lat: float, end_lon: float) -> Dict[str, Any]:
    """
    Robust geometric road-path generator if OSRM is unreachable or timed out.
    Applies Maharashtra terrain / road winding factor (1.25x) and average speed (35 km/h).
    """
    straight_dist_m = calculate_haversine_distance(start_lat, start_lon, end_lat, end_lon)
    straight_km = straight_dist_m / 1000.0
    road_km = round(straight_km * 1.25, 2)
    road_m = round(road_km * 1000.0, 1)

    # Average 35 km/h speed for urban/semi-urban Maharashtra roads
    avg_speed_kmh = 35.0
    duration_hrs = max(road_km / avg_speed_kmh, 0.05)
    duration_sec = duration_hrs * 3600.0

    # Generate smooth intermediate waypoints
    num_steps = max(min(int(straight_km * 3), 20), 4)
    coords_lat_lon = []
    coords_lon_lat = []

    # Subtle curve offset for realistic presentation
    d_lat = end_lat - start_lat
    d_lon = end_lon - start_lon
    perp_lat = -d_lon * 0.08
    perp_lon = d_lat * 0.08

    for i in range(num_steps + 1):
        t = i / float(num_steps)
        # quadratic bezier arc
        arc = math.sin(t * math.pi)
        lat = start_lat + (d_lat * t) + (perp_lat * arc)
        lon = start_lon + (d_lon * t) + (perp_lon * arc)
        coords_lat_lon.append([round(lat, 6), round(lon, 6)])
        coords_lon_lat.append([round(lon, 6), round(lat, 6)])

    return {
        "success": True,
        "isRoadRoute": False,
        "source": "fallback_interpolation",
        "distanceKm": road_km,
        "distanceMeters": road_m,
        "straightLineKm": round(straight_km, 2),
        "durationMinutes": int(round(duration_sec / 60.0)),
        "durationFormatted": _format_duration(duration_sec),
        "coordinates": coords_lat_lon,
        "geojson": {
            "type": "Feature",
            "properties": {
                "distance": road_m,
                "duration": duration_sec,
                "mode": "driving"
            },
            "geometry": {
                "type": "LineString",
                "coordinates": coords_lon_lat
            }
        },
        "steps": [
            {
                "instruction": f"Head towards destination along assigned route ({road_km} km)",
                "distance": road_m,
                "duration": duration_sec
            }
        ]
    }

@router.get("/route")
async def get_road_route(
    start_lat: float = Query(..., description="Start Latitude"),
    start_lon: float = Query(..., description="Start Longitude"),
    end_lat: float = Query(..., description="Destination Latitude"),
    end_lon: float = Query(..., description="Destination Longitude"),
    alternatives: bool = Query(False, description="Calculate alternative routes if available")
):
    """
    Calculates actual road route using OpenStreetMap & OSRM (Open Source Routing Machine).
    Returns road distance (km), duration, and GeoJSON route geometry.
    Gracefully falls back to robust geometric interpolation if OSRM is unreachable.
    """
    # Sanity check: coordinates must not be 0,0
    if abs(start_lat) < 0.001 and abs(start_lon) < 0.001:
        raise HTTPException(status_code=400, detail="Invalid start coordinates (0, 0)")
    if abs(end_lat) < 0.001 and abs(end_lon) < 0.001:
        raise HTTPException(status_code=400, detail="Invalid destination coordinates (0, 0)")

    straight_dist_m = calculate_haversine_distance(start_lat, start_lon, end_lat, end_lon)
    straight_km = round(straight_dist_m / 1000.0, 2)

    # 1. Try OSRM servers with short timeout
    for base_url in OSRM_SERVERS:
        try:
            url = f"{base_url}/route/v1/driving/{start_lon},{start_lat};{end_lon},{end_lat}"
            params = {
                "overview": "full",
                "geometries": "geojson",
                "steps": "true",
                "alternatives": "true" if alternatives else "false"
            }
            resp = requests.get(url, params=params, timeout=4.0)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    primary = data["routes"][0]
                    dist_m = float(primary.get("distance", straight_dist_m))
                    dur_s = float(primary.get("duration", 60.0))
                    road_km = round(dist_m / 1000.0, 2)

                    geom = primary.get("geometry", {})
                    lon_lat_coords = geom.get("coordinates", [])
                    lat_lon_coords = [[c[1], c[0]] for c in lon_lat_coords]

                    # Parse step-by-step navigation instructions
                    steps = []
                    legs = primary.get("legs", [])
                    for leg in legs:
                        for s in leg.get("steps", []):
                            maneuver = s.get("maneuver", {})
                            name = s.get("name") or "road"
                            mtype = maneuver.get("type", "turn")
                            modifier = maneuver.get("modifier", "")
                            instr = f"{mtype.title()} {modifier} onto {name}".strip()
                            steps.append({
                                "instruction": instr,
                                "name": name,
                                "distance": round(s.get("distance", 0), 1),
                                "duration": round(s.get("duration", 0), 1)
                            })

                    return {
                        "success": True,
                        "isRoadRoute": True,
                        "source": "osrm",
                        "distanceKm": road_km,
                        "distanceMeters": round(dist_m, 1),
                        "straightLineKm": straight_km,
                        "durationMinutes": int(round(dur_s / 60.0)),
                        "durationFormatted": _format_duration(dur_s),
                        "coordinates": lat_lon_coords,
                        "geojson": {
                            "type": "Feature",
                            "properties": {
                                "distance": dist_m,
                                "duration": dur_s,
                                "mode": "driving"
                            },
                            "geometry": geom
                        },
                        "steps": steps
                    }
        except Exception as e:
            logger.warning(f"OSRM server {base_url} failed: {e}")
            continue

    # 2. Fallback to robust geometric road calculation
    return _generate_fallback_route(start_lat, start_lon, end_lat, end_lon)

@router.post("/match")
async def match_gps_trail_to_road(req: MatchRequest):
    """
    Snaps raw employee GPS history coordinates to the real OpenStreetMap road network
    using OSRM Match API. Handles GPS gaps, noise, and stationary clusters.
    """
    points = [p for p in req.points if p.latitude != 0 and p.longitude != 0]
    if len(points) < 2:
        return {
            "success": True,
            "snapped": False,
            "coordinates": [[p.latitude, p.longitude] for p in points],
            "distanceKm": 0.0
        }

    # Downsample if too many points for OSRM URL limits
    sampled = points
    if len(points) > 80:
        step = math.ceil(len(points) / 80)
        sampled = points[::step]
        if sampled[-1] != points[-1]:
            sampled.append(points[-1])

    coords_str = ";".join([f"{p.longitude:.6f},{p.latitude:.6f}" for p in sampled])

    for base_url in OSRM_SERVERS:
        try:
            url = f"{base_url}/match/v1/driving/{coords_str}"
            params = {
                "overview": "full",
                "geometries": "geojson",
                "steps": "false"
            }
            resp = requests.get(url, params=params, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and data.get("matchings"):
                    matching = data["matchings"][0]
                    dist_m = float(matching.get("distance", 0))
                    dur_s = float(matching.get("duration", 0))
                    geom = matching.get("geometry", {})
                    lon_lat_coords = geom.get("coordinates", [])
                    lat_lon_coords = [[c[1], c[0]] for c in lon_lat_coords]

                    return {
                        "success": True,
                        "snapped": True,
                        "source": "osrm_match",
                        "distanceKm": round(dist_m / 1000.0, 2),
                        "distanceMeters": round(dist_m, 1),
                        "durationFormatted": _format_duration(dur_s),
                        "coordinates": lat_lon_coords,
                        "geojson": {
                            "type": "Feature",
                            "geometry": geom
                        }
                    }
        except Exception as e:
            logger.warning(f"OSRM match error on {base_url}: {e}")
            continue

    # Fallback: compute distance directly along raw GPS points
    total_dist_m = 0.0
    for i in range(len(points) - 1):
        p1 = points[i]
        p2 = points[i + 1]
        step_m = calculate_haversine_distance(p1.latitude, p1.longitude, p2.latitude, p2.longitude)
        if 5.0 <= step_m <= 50000.0:  # Ignore tiny jitter < 5m and unrealistic jumps > 50km
            total_dist_m += step_m

    raw_coords = [[p.latitude, p.longitude] for p in points]
    return {
        "success": True,
        "snapped": False,
        "source": "raw_gps",
        "distanceKm": round(total_dist_m / 1000.0, 2),
        "distanceMeters": round(total_dist_m, 1),
        "coordinates": raw_coords,
        "geojson": {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[p.longitude, p.latitude] for p in points]
            }
        }
    }

@router.get("/maharashtra")
async def get_maharashtra_info():
    """
    Returns initial map settings and major district centers across Maharashtra state.
    """
    return {
        "state": "Maharashtra",
        "country": "India",
        "center": {
            "latitude": 19.7515,
            "longitude": 75.7139,
            "zoom": 6,
            "minZoom": 5,
            "maxZoom": 19
        },
        "bbox": {
            "minLatitude": 15.6024,
            "maxLatitude": 22.0284,
            "minLongitude": 72.6593,
            "maxLongitude": 80.8909
        },
        "districts": [
            {"name": "Mumbai City", "latitude": 18.9388, "longitude": 72.8354, "code": "MUM"},
            {"name": "Mumbai Suburban (BKC)", "latitude": 19.0657, "longitude": 72.8687, "code": "BKC"},
            {"name": "Navi Mumbai", "latitude": 19.0330, "longitude": 73.0297, "code": "NVM"},
            {"name": "Thane", "latitude": 19.2183, "longitude": 72.9781, "code": "THN"},
            {"name": "Pune", "latitude": 18.5204, "longitude": 73.8567, "code": "PUN"},
            {"name": "Nashik", "latitude": 19.9975, "longitude": 73.7898, "code": "NSK"},
            {"name": "Nagpur", "latitude": 21.1458, "longitude": 79.0882, "code": "NGP"},
            {"name": "Chhatrapati Sambhajinagar", "latitude": 19.8762, "longitude": 75.3433, "code": "CSN"},
            {"name": "Kolhapur", "latitude": 16.7050, "longitude": 74.2433, "code": "KLP"},
            {"name": "Solapur", "latitude": 17.6599, "longitude": 75.9064, "code": "SLP"},
            {"name": "Amravati", "latitude": 20.9320, "longitude": 77.7523, "code": "AMR"},
            {"name": "Nanded", "latitude": 19.1383, "longitude": 77.3210, "code": "NED"},
            {"name": "Jalgaon", "latitude": 21.0077, "longitude": 75.5626, "code": "JLG"}
        ],
        "tileProvider": "Mappls",
        "styleUrl": "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "attribution": "Mappls ● MapmyIndia"
    }

