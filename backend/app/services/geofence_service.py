from typing import Tuple, Dict, Any
from fastapi import HTTPException, status
from app.utils.haversine import calculate_haversine_distance, is_within_geofence
from app.core.config import settings

class GeofenceService:
    @staticmethod
    def validate_gps_accuracy(accuracy_meters: float):
        if accuracy_meters > settings.MAX_ALLOWABLE_GPS_ACCURACY_METERS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"GPS accuracy is too low ({accuracy_meters:.1f}m > 50m). Please move to an open area and try again."
            )

    @staticmethod
    def verify_site_geofence(
        device_lat: float,
        device_lon: float,
        site_lat: float,
        site_lon: float,
        site_radius_meters: float
    ) -> Tuple[bool, float]:
        is_inside, distance = is_within_geofence(
            device_lat, device_lon, site_lat, site_lon, site_radius_meters
        )
        return is_inside, distance

geofence_service = GeofenceService()
