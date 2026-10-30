import math
from typing import Tuple

def calculate_haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees).
    Returns distance in meters.
    """
    R = 6371000.0  # Earth's radius in meters

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2.0) ** 2)
    
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    distance = R * c
    return round(distance, 2)

def is_within_geofence(
    device_lat: float, device_lon: float,
    site_lat: float, site_lon: float,
    radius_meters: float
) -> Tuple[bool, float]:
    """
    Returns (is_inside, distance_meters)
    """
    distance = calculate_haversine_distance(device_lat, device_lon, site_lat, site_lon)
    return (distance <= radius_meters, distance)
