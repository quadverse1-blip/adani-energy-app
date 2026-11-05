from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Body
from pydantic import BaseModel
from app.core.database import db
from app.core.security import get_current_user_token
from app.utils.haversine import calculate_haversine_distance
from app.utils.datetime_utils import get_now_ist, get_today_ist_str, is_past_shift_end_auto_checkout

router = APIRouter(prefix="/locations", tags=["Location Tracking & Telemetry"])

class LocationPingRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = 10.0
    batteryLevel: Optional[int] = 100
    siteId: Optional[str] = None
    locationName: Optional[str] = None

@router.post("/ping")
async def ping_location(
    req: LocationPingRequest,
    token_data: dict = Depends(get_current_user_token)
):
    emp_id = token_data["id"]
    emp = db.get_employee(emp_id)
    if emp:
        now_ist = get_now_ist()
        emp["latitude"] = req.latitude
        emp["longitude"] = req.longitude
        emp["lastSeen"] = now_ist.strftime("%I:%M %p")
        emp["lastLocationDate"] = now_ist.strftime("%d %b %Y")
        emp["lastLocationTime"] = now_ist.strftime("%I:%M %p IST")
        emp["lastSeenTimestamp"] = datetime.utcnow().isoformat() + "Z"
        emp["batteryLevel"] = req.batteryLevel or 100
        emp["accuracy"] = f"±{int(req.accuracy or 10)}m Lock"
        emp["hasGps"] = True
        if req.locationName:
            emp["locationName"] = req.locationName
        db.employees[emp_id] = emp
    return {"status": "ok", "message": "Location updated successfully"}

@router.get("/live")
async def get_live_fleet_radar(token_data: dict = Depends(get_current_user_token)):
    today_str = get_today_ist_str()
    all_sites = db.get_all_sites()
    all_employees = db.get_all_employees()
    all_attendance = list(db.attendance.values())
    sites_map = {s["_id"]: s for s in all_sites}

    # Default site reference if any sites exist
    default_site = all_sites[0] if all_sites else None
    now_utc = datetime.utcnow()
    is_after_6pm = is_past_shift_end_auto_checkout()

    technicians = []
    
    # Track all workforce employees
    for emp in all_employees:
        emp_id = emp.get("_id", "")
        emp_code = emp.get("employeeId", "")
        
        # Today's attendance
        today_att = db.get_today_attendance(emp_id, today_str)
        
        # Historical attendance records for this employee (newest first)
        emp_atts = [
            a for a in all_attendance 
            if a.get("employeeId") in [emp_id, emp_code] or a.get("technicianCode") in [emp_id, emp_code]
        ]
        emp_atts.sort(key=lambda a: str(a.get("date") or ""), reverse=True)
        
        # Resolve assigned site
        raw_site_id = emp.get("assignedSiteId") or emp.get("assignedSiteIds")
        if isinstance(raw_site_id, list):
            assigned_site_id = raw_site_id[0] if raw_site_id else None
        else:
            assigned_site_id = raw_site_id
        assigned_site = sites_map.get(assigned_site_id) or default_site
        
        # 1. Determine Online / Offline status
        # Online if: checked in today without checkout and before 6pm, OR sent telemetry ping within past 15 mins
        is_online = False
        check_in_time = None
        att_status_badge = "Offline"
        
        if today_att:
            if today_att.get("checkIn") and not today_att.get("checkOut") and not is_after_6pm:
                is_online = True
                check_in_time = today_att.get("checkIn", {}).get("timeIST") or today_att.get("checkIn", {}).get("time")
                att_status_badge = "Online"
            elif today_att.get("checkOut"):
                att_status_badge = "Completed"
                check_in_time = today_att.get("checkIn", {}).get("timeIST") or today_att.get("checkIn", {}).get("time")
        
        # Also check recent telemetry ping (within last 15 minutes) - active GPS device is Online
        if not is_online and emp.get("lastSeenTimestamp"):
            try:
                ping_time_str = emp["lastSeenTimestamp"].replace("Z", "+00:00")
                ping_dt = datetime.fromisoformat(ping_time_str).replace(tzinfo=None)
                if (now_utc - ping_dt).total_seconds() <= 900:
                    is_online = True
                    att_status_badge = "Online"
            except Exception:
                pass

        # 2. Resolve Last Recorded GPS Coordinates (Never drop last known coordinates)
        lat = None
        lon = None
        coord_source = "none"
        update_date = None
        update_time = None

        # Source A: Live / Stored coordinates directly on employee profile
        if emp.get("latitude") is not None and emp.get("longitude") is not None:
            lat = float(emp["latitude"])
            lon = float(emp["longitude"])
            coord_source = "telemetry"
            update_date = emp.get("lastLocationDate") or today_str
            update_time = emp.get("lastLocationTime") or emp.get("lastSeen") or "Logged"

        # Source B: Today's check-out coordinates
        elif today_att and today_att.get("checkOut") and today_att["checkOut"].get("latitude") is not None:
            co = today_att["checkOut"]
            lat = float(co["latitude"])
            lon = float(co["longitude"])
            coord_source = "checkout"
            update_date = today_str
            update_time = co.get("timeIST") or "06:00 PM IST"

        # Source C: Today's check-in coordinates
        elif today_att and today_att.get("checkIn") and today_att["checkIn"].get("latitude") is not None:
            ci = today_att["checkIn"]
            lat = float(ci["latitude"])
            lon = float(ci["longitude"])
            coord_source = "checkin"
            update_date = today_str
            update_time = ci.get("timeIST") or "09:30 AM IST"

        # Source D: Latest historical punch across all records
        else:
            for ha in emp_atts:
                if ha.get("checkOut") and ha["checkOut"].get("latitude") is not None and ha["checkOut"].get("longitude") is not None:
                    lat = float(ha["checkOut"]["latitude"])
                    lon = float(ha["checkOut"]["longitude"])
                    coord_source = "historical"
                    update_date = ha.get("date") or "Previous Shift"
                    update_time = ha["checkOut"].get("timeIST") or "06:00 PM IST"
                    break
                elif ha.get("checkIn") and ha["checkIn"].get("latitude") is not None and ha["checkIn"].get("longitude") is not None:
                    lat = float(ha["checkIn"]["latitude"])
                    lon = float(ha["checkIn"]["longitude"])
                    coord_source = "historical"
                    update_date = ha.get("date") or "Previous Shift"
                    update_time = ha["checkIn"].get("timeIST") or "09:30 AM IST"
                    break

        # Source E: Assigned Substation Site Base GPS
        if lat is None or lon is None:
            if assigned_site and assigned_site.get("latitude") is not None and assigned_site.get("longitude") is not None:
                lat = float(assigned_site["latitude"])
                lon = float(assigned_site["longitude"])
                coord_source = "site_base"
                update_date = "Assigned Site"
                update_time = "Facility Base GPS"

        has_gps = lat is not None and lon is not None
        is_live = is_online and coord_source in ["telemetry", "checkin"]

        # Geofence distance calculation
        dist = 0.0
        if has_gps and assigned_site and assigned_site.get("latitude") is not None and assigned_site.get("longitude") is not None:
            dist = calculate_haversine_distance(
                lat, lon, assigned_site["latitude"], assigned_site["longitude"]
            )

        # Status & marker color: Vibrant Green for Online, Slate Grey for Offline
        if is_online:
            color = "green"
            status = "on_duty_inside" if dist <= assigned_site.get("radiusMeters", 500) else "on_duty_outside"
        else:
            color = "grey"
            status = "offline"

        # Format update timestamp
        if update_date and update_time:
            if update_date == today_str or update_date == "Today":
                last_update_display = f"Today at {update_time}"
            elif update_date == "Assigned Site":
                last_update_display = f"Worksite Base: {update_time}"
            else:
                last_update_display = f"{update_date} at {update_time}"
        else:
            last_update_display = "Location Pending Sync"

        location_name = (
            emp.get("locationName") 
            or (assigned_site.get("name") if assigned_site else None)
            or (f"{lat:.4f}° N, {lon:.4f}° E" if lat and lon else "Location Unavailable")
        )

        technicians.append({
            "id": emp["_id"],
            "name": emp.get("name", "Field Technician"),
            "employeeId": emp.get("employeeId", ""),
            "phone": emp.get("phone", ""),
            "avatar": emp.get("avatar"),
            "designation": emp.get("designation", "Field Technician"),
            "role": emp.get("role", "technician"),
            "status": "online" if is_online else "offline",
            "isOnline": is_online,
            "isLive": is_live,
            "attendanceBadge": "Online" if is_online else "Offline",
            "markerColor": color,
            "hasGps": has_gps,
            "latitude": lat,
            "longitude": lon,
            "batteryLevel": emp.get("batteryLevel", 100),
            "accuracy": emp.get("accuracy", "±8m Lock" if has_gps else None),
            "assignedSiteName": assigned_site.get("name") if assigned_site else "General Field",
            "assignedSiteCode": assigned_site.get("code") if assigned_site else None,
            "assignedSiteId": assigned_site.get("_id") if assigned_site else None,
            "checkInTime": check_in_time or "--",
            "distanceMeters": round(dist, 1),
            "lastSeen": update_time or (check_in_time if has_gps else "Offline"),
            "lastLocationDate": update_date or "--",
            "lastLocationTime": update_time or "--",
            "lastLocationUpdate": last_update_display,
            "locationName": location_name,
            "coordSource": coord_source
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

    active_count = sum(1 for t in technicians if t["isOnline"])
    offline_count = len(technicians) - active_count

    return {
        "substations": substations,
        "technicians": technicians,
        "totalCount": len(technicians),
        "onDutyCount": active_count,
        "standbyCount": offline_count,
        "onlineCount": active_count,
        "offlineCount": offline_count,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
