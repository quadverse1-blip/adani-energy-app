from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Body
from pydantic import BaseModel
from app.core.database import db
from app.core.security import get_current_user_token
from app.utils.haversine import calculate_haversine_distance

router = APIRouter(prefix="/locations", tags=["Location Tracking & Telemetry"])

class LocationPingRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = 10.0
    batteryLevel: Optional[int] = 100
    siteId: Optional[str] = None

@router.post("/ping")
async def ping_location(
    req: LocationPingRequest,
    token_data: dict = Depends(get_current_user_token)
):
    emp_id = token_data["id"]
    emp = db.get_employee(emp_id)
    if emp:
        emp["latitude"] = req.latitude
        emp["longitude"] = req.longitude
        emp["lastSeen"] = datetime.utcnow().strftime("%I:%M %p")
        emp["batteryLevel"] = req.batteryLevel or 100
        emp["accuracy"] = f"±{int(req.accuracy or 10)}m Lock"
        emp["hasGps"] = True
        db.employees[emp_id] = emp
    return {"status": "ok", "message": "Location updated successfully"}

@router.get("/live")
async def get_live_fleet_radar(token_data: dict = Depends(get_current_user_token)):
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    all_sites = db.get_all_sites()
    all_employees = db.get_all_employees()
    sites_map = {s["_id"]: s for s in all_sites}

    # Default site reference if any sites exist
    default_site = all_sites[0] if all_sites else None

    technicians = []
    
    # Track each field personnel (technicians and supervisors)
    for emp in all_employees:
        role = emp.get("role", "").lower()
        if role not in ["technician", "supervisor"]:
            continue
            
        emp_id = emp["_id"]
        today_att = db.get_today_attendance(emp_id, today_str)
        
        # Resolve assigned site
        assigned_site_id = emp.get("assignedSiteId") or (emp.get("assignedSiteIds") and emp.get("assignedSiteIds")[0])
        assigned_site = sites_map.get(assigned_site_id) or default_site
        
        # Check if coordinates exist on employee or attendance
        emp_lat = emp.get("latitude")
        emp_lon = emp.get("longitude")
        has_gps = False
        lat = None
        lon = None
        check_in_time = None
        att_status_badge = "Not Checked In"
        status = "offline"
        color = "grey"
        dist = 0.0

        if today_att:
            if today_att.get("checkOut"):
                status = "completed"
                color = "grey"
                co = today_att["checkOut"]
                lat = co.get("latitude")
                lon = co.get("longitude")
                has_gps = lat is not None and lon is not None
                check_in_time = today_att.get("checkIn", {}).get("time")
                att_status_badge = "Completed"
            elif today_att.get("checkIn"):
                ci = today_att["checkIn"]
                lat = ci.get("latitude")
                lon = ci.get("longitude")
                has_gps = lat is not None and lon is not None
                check_in_time = ci.get("time")
                att_status_badge = "Present" if today_att.get("status") == "present" else "Late"
                if has_gps and assigned_site and assigned_site.get("latitude") is not None and assigned_site.get("longitude") is not None:
                    dist = calculate_haversine_distance(
                        lat, lon, assigned_site["latitude"], assigned_site["longitude"]
                    )
                    if dist <= assigned_site.get("radiusMeters", 500):
                        status = "on_duty_inside"
                        color = "green"
                    else:
                        status = "on_duty_outside"
                        color = "amber"
        elif emp_lat is not None and emp_lon is not None:
            lat = float(emp_lat)
            lon = float(emp_lon)
            has_gps = True
            status = "on_duty_inside"
            color = "green"

        if has_gps and lat is not None and lon is not None and assigned_site and assigned_site.get("latitude") is not None and assigned_site.get("longitude") is not None:
            dist = calculate_haversine_distance(
                lat, lon, assigned_site["latitude"], assigned_site["longitude"]
            )

        technicians.append({
            "id": emp["_id"],
            "name": emp.get("name", "Field Technician"),
            "employeeId": emp.get("employeeId", ""),
            "phone": emp.get("phone", ""),
            "avatar": emp.get("avatar"),
            "designation": emp.get("designation", "Field Technician"),
            "status": status,
            "attendanceBadge": att_status_badge,
            "markerColor": color,
            "hasGps": has_gps,
            "latitude": lat,
            "longitude": lon,
            "batteryLevel": emp.get("batteryLevel", 100),
            "accuracy": emp.get("accuracy", "±8m Lock" if has_gps else None),
            "assignedSiteName": assigned_site.get("name") if assigned_site else None,
            "assignedSiteCode": assigned_site.get("code") if assigned_site else None,
            "assignedSiteId": assigned_site.get("_id") if assigned_site else None,
            "checkInTime": check_in_time or "--",
            "distanceMeters": round(dist, 1),
            "lastSeen": emp.get("lastSeen") or (check_in_time if has_gps else "Offline"),
            "locationName": emp.get("locationName") or (assigned_site.get("name") if assigned_site else None)
        })

    # Prepare substations with geofence geometry
    substations = []
    for s in all_sites:
        substations.append({
            "id": s["_id"],
            "name": s["name"],
            "code": s["code"],
            "latitude": s["latitude"],
            "longitude": s["longitude"],
            "radiusMeters": s.get("radiusMeters", 500),
            "voltageClass": s.get("voltageClass", "33 kV Substation & Smart Meter Feeder"),
            "manager": s.get("manager"),
            "address": s.get("address")
        })

    active_count = sum(1 for t in technicians if t["hasGps"])
    offline_count = len(technicians) - active_count

    return {
        "substations": substations,
        "technicians": technicians,
        "totalCount": len(technicians),
        "onDutyCount": active_count,
        "standbyCount": offline_count,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
