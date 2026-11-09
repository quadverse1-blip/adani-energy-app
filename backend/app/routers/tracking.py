import math
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from app.core.database import db
from app.core.security import get_current_user_token
from app.utils.haversine import calculate_haversine_distance
from app.utils.datetime_utils import get_now_ist, get_today_ist_str, is_past_shift_end_auto_checkout

logger = logging.getLogger("tracking")

router = APIRouter(prefix="/locations", tags=["Location Tracking & Telemetry"])

class LocationPingRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = 10.0
    speed: Optional[float] = None
    heading: Optional[float] = None
    timestamp: Optional[str] = None
    batteryLevel: Optional[int] = 100
    siteId: Optional[str] = None
    locationName: Optional[str] = None

def _time_ago(past_dt: datetime, now_dt: datetime) -> str:
    secs = max(int((now_dt - past_dt).total_seconds()), 0)
    if secs < 60:
        return "Just now"
    mins = secs // 60
    if mins < 60:
        return f"{mins} min ago" if mins == 1 else f"{mins} mins ago"
    hrs = mins // 60
    if hrs < 24:
        rem_m = mins % 60
        return f"{hrs}h {rem_m}m ago" if rem_m > 0 else f"{hrs}h ago"
    days = hrs // 24
    if days == 1:
        return f"Yesterday ({past_dt.strftime('%I:%M %p')})"
    return f"{days} days ago ({past_dt.strftime('%d %b')})"

@router.post("/ping")
async def ping_location(
    req: LocationPingRequest,
    token_data: dict = Depends(get_current_user_token)
):
    """
    Records an active GPS telemetry breadcrumb from the employee's device.
    Saves to persistent location history and updates the employee's live / last-known coordinates.
    """
    emp_id = token_data["id"]
    emp = db.get_employee(emp_id) or db.find_employee_by_identifier(emp_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    now_utc = datetime.utcnow()
    now_ist = get_now_ist()
    today_ist = get_today_ist_str()

    utc_iso = req.timestamp or (now_utc.isoformat() + "Z")
    time_ist_str = now_ist.strftime("%I:%M %p IST")
    date_ist_str = now_ist.strftime("%d %b %Y")

    # 1. Update employee record with latest / last known telemetry
    emp["latitude"] = req.latitude
    emp["longitude"] = req.longitude
    emp["lastSeen"] = now_ist.strftime("%I:%M %p")
    emp["lastLocationDate"] = date_ist_str
    emp["lastLocationTime"] = time_ist_str
    emp["lastSeenTimestamp"] = utc_iso
    emp["batteryLevel"] = req.batteryLevel or 100
    emp["accuracy"] = f"±{int(req.accuracy or 10)}m Lock"
    emp["speed"] = req.speed
    emp["heading"] = req.heading
    emp["hasGps"] = True
    if req.locationName:
        emp["locationName"] = req.locationName
    if req.siteId:
        emp["assignedSiteId"] = req.siteId

    db.employees[emp.get("_id", emp_id)] = emp

    # 2. Record historical breadcrumb point in persistent location_history collection
    ping_doc = {
        "employeeId": emp.get("_id", emp_id),
        "employeeCode": emp.get("employeeId", ""),
        "employeeName": emp.get("name", "Field Technician"),
        "latitude": req.latitude,
        "longitude": req.longitude,
        "accuracy": req.accuracy or 10.0,
        "speed": req.speed or 0.0,
        "heading": req.heading or 0.0,
        "batteryLevel": req.batteryLevel or 100,
        "timestamp": utc_iso,
        "timestampIST": time_ist_str,
        "dateIST": today_ist,
        "locationName": req.locationName or "",
        "siteId": req.siteId or emp.get("assignedSiteId") or ""
    }
    db.save_location_ping(ping_doc)

    return {
        "status": "ok",
        "message": "GPS telemetry recorded successfully",
        "timestamp": utc_iso,
        "timestampIST": time_ist_str
    }

@router.get("/live")
async def get_live_fleet_radar(token_data: dict = Depends(get_current_user_token)):
    """
    Comprehensive fleet radar for the entire Maharashtra state.
    Returns:
    - Substations with geofence circles and manager contact details
    - All employees with verified LIVE vs. LAST KNOWN coordinates
    - Road & straight-line distances to assigned sites
    - Maharashtra district & state boundaries
    """
    today_str = get_today_ist_str()
    all_sites = db.get_all_sites()
    raw_employees = db.get_all_employees()
    all_attendance = list(db.attendance.values())
    sites_map = {s["_id"]: s for s in all_sites}

    # Field force filter: Exclude administrator accounts that do not patrol smart meters
    all_employees = [
        e for e in raw_employees
        if e.get("role") in ["technician", "engineer", "field_operator", "supervisor"]
        and not (e.get("name", "").lower().startswith("demo admin"))
        and not (e.get("employeeId", "").upper().startswith("ADMIN"))
    ]
    if not all_employees:
        all_employees = [e for e in raw_employees if not (e.get("name", "").lower().startswith("demo admin"))]

    # Default site reference if any sites exist
    default_site = all_sites[0] if all_sites else None
    now_utc = datetime.utcnow()
    is_after_6pm = is_past_shift_end_auto_checkout()

    technicians = []

    for emp in all_employees:
        emp_id = emp.get("_id", "")
        emp_code = emp.get("employeeId", "")

        today_att = db.get_today_attendance(emp_id, today_str)

        emp_atts = [
            a for a in all_attendance
            if a.get("employeeId") in [emp_id, emp_code] or a.get("technicianCode") in [emp_id, emp_code]
        ]
        emp_atts.sort(key=lambda a: str(a.get("date") or ""), reverse=True)

        raw_site_id = emp.get("assignedSiteId") or emp.get("assignedSiteIds")
        if isinstance(raw_site_id, list):
            assigned_site_id = raw_site_id[0] if raw_site_id else None
        else:
            assigned_site_id = raw_site_id
        assigned_site = sites_map.get(assigned_site_id) or default_site

        # 1. Determine Online / On Duty status based on today's attendance and shift rules
        is_on_duty = False
        is_online = False
        check_in_time = None
        att_status_badge = "Offline"
        last_ping_dt = None

        if today_att:
            if today_att.get("checkIn") and not today_att.get("checkOut") and not is_after_6pm:
                is_on_duty = True
                is_online = True
                check_in_time = today_att.get("checkIn", {}).get("timeIST") or today_att.get("checkIn", {}).get("time")
                att_status_badge = "Online"
            elif today_att.get("checkOut"):
                att_status_badge = "Completed"
                check_in_time = today_att.get("checkIn", {}).get("timeIST") or today_att.get("checkIn", {}).get("time")

        # Telemetry ping timestamp
        if emp.get("lastSeenTimestamp"):
            try:
                ping_time_str = emp["lastSeenTimestamp"].replace("Z", "+00:00")
                last_ping_dt = datetime.fromisoformat(ping_time_str).replace(tzinfo=None)
                if (now_utc - last_ping_dt).total_seconds() <= 1800:  # 30 minutes active window
                    is_online = True
                    if att_status_badge == "Offline":
                        att_status_badge = "Online"
            except Exception:
                pass

        # 2. Resolve Last Recorded GPS Coordinates strictly from genuine records
        lat = None
        lon = None
        coord_source = "none"
        update_date = None
        update_time = None
        recorded_dt = last_ping_dt

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

        # Source D: Latest historical punch across past attendance records
        else:
            for ha in emp_atts:
                if ha.get("checkOut") and ha["checkOut"].get("latitude") is not None:
                    lat = float(ha["checkOut"]["latitude"])
                    lon = float(ha["checkOut"]["longitude"])
                    coord_source = "historical"
                    update_date = ha.get("date") or "Previous Shift"
                    update_time = ha["checkOut"].get("timeIST") or "06:00 PM IST"
                    break
                elif ha.get("checkIn") and ha["checkIn"].get("latitude") is not None:
                    lat = float(ha["checkIn"]["latitude"])
                    lon = float(ha["checkIn"]["longitude"])
                    coord_source = "historical"
                    update_date = ha.get("date") or "Previous Shift"
                    update_time = ha["checkIn"].get("timeIST") or "09:30 AM IST"
                    break

        # Genuine GPS verification (NO fallback to assigned site!)
        has_gps = (lat is not None and lon is not None)

        # Strict LIVE definition: Valid recent telemetry ping (within 30m) or currently active shift
        is_live = False
        if has_gps:
            if is_online and recorded_dt:
                is_live = (now_utc - recorded_dt).total_seconds() <= 1800
            elif is_on_duty and coord_source in ["telemetry", "checkin"]:
                is_live = True

        time_ago_str = _time_ago(recorded_dt, now_utc) if recorded_dt else (update_time or "Unavailable")

        # Straight-line and road distance calculations
        dist = None
        road_km = None
        est_duration_mins = None
        est_travel_time_str = "Not Available"

        if has_gps and assigned_site and assigned_site.get("latitude") is not None and assigned_site.get("longitude") is not None:
            raw_dist = calculate_haversine_distance(
                lat, lon, assigned_site["latitude"], assigned_site["longitude"]
            )
            dist = round(raw_dist, 1)
            # Estimate road distance with 1.25x detour factor
            road_km = round((dist / 1000.0) * 1.25, 2)
            est_duration_mins = max(int(round((road_km / 35.0) * 60)), 1)
            est_travel_time_str = f"{est_duration_mins} mins" if est_duration_mins < 60 else f"{est_duration_mins // 60}h {est_duration_mins % 60}m"

        # Status & marker classification
        if not has_gps:
            color = "#94A3B8"
            status = "no_location"
            display_label = "LOCATION NOT AVAILABLE"
            last_update_display = "Location Not Available"
            time_ago_str = "No GPS record logged"
            location_name = "Location Not Available"
        elif is_live:
            color = "#10B981"  # Emerald Green for live GPS
            status = "live_online"
            display_label = "LIVE LOCATION"
            last_update_display = f"Live GPS • {update_time}" if update_time else "Live GPS"
            location_name = emp.get("locationName") or (assigned_site.get("name") if assigned_site else f"{lat:.4f}° N, {lon:.4f}° E")
        else:
            color = "#64748B"  # Slate Grey for last-known GPS
            status = "offline"
            display_label = "LAST KNOWN LOCATION"
            if update_date and update_time:
                last_update_display = f"Last Known: {update_date} at {update_time}"
            else:
                last_update_display = "Last Known Location"
            location_name = emp.get("locationName") or (assigned_site.get("name") if assigned_site else f"{lat:.4f}° N, {lon:.4f}° E")

        technicians.append({
            "id": emp["_id"],
            "name": emp.get("name", "Field Technician"),
            "employeeId": emp.get("employeeId", ""),
            "phone": emp.get("phone", ""),
            "avatar": emp.get("avatar"),
            "designation": emp.get("designation", "Field Technician"),
            "role": emp.get("role", "technician"),
            "circle": emp.get("circle", "Maharashtra"),
            "division": emp.get("division", "Grid Operations"),
            "status": status,
            "isOnline": is_online,
            "isOnDuty": is_on_duty,
            "isLive": is_live,
            "isLastKnown": (has_gps and not is_live),
            "displayLabel": display_label,
            "attendanceBadge": att_status_badge,
            "markerColor": color,
            "hasGps": has_gps,
            "latitude": lat,
            "longitude": lon,
            "speed": emp.get("speed"),
            "heading": emp.get("heading"),
            "batteryLevel": emp.get("batteryLevel", 100),
            "accuracy": emp.get("accuracy", "±8m Lock" if has_gps else None),
            "assignedSiteName": assigned_site.get("name") if assigned_site else "General Field",
            "assignedSiteCode": assigned_site.get("code") if assigned_site else None,
            "assignedSiteId": assigned_site.get("_id") if assigned_site else None,
            "assignedSiteLatitude": assigned_site.get("latitude") if assigned_site else None,
            "assignedSiteLongitude": assigned_site.get("longitude") if assigned_site else None,
            "checkInTime": check_in_time or "--",
            "distanceMeters": dist,
            "distanceKm": round(dist / 1000.0, 2) if dist is not None else None,
            "roadDistanceKm": road_km,
            "estimatedTravelMinutes": est_duration_mins,
            "estimatedTravelTime": est_travel_time_str,
            "lastSeen": update_time or (check_in_time if has_gps else "No GPS"),
            "lastLocationDate": update_date or "--",
            "lastLocationTime": update_time or "--",
            "lastLocationUpdate": last_update_display,
            "timeAgo": time_ago_str,
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
            "voltageClass": s.get("voltageClass", "33 kV Substation & Smart Feeder"),
            "manager": s.get("manager"),
            "address": s.get("address")
        })

    live_count = sum(1 for t in technicians if t["isLive"])
    last_known_count = sum(1 for t in technicians if t["isLastKnown"])
    no_location_count = sum(1 for t in technicians if not t["hasGps"])
    on_duty_count = sum(1 for t in technicians if t["isOnDuty"])
    standby_count = last_known_count + no_location_count
    total_count = len(technicians)

    return {
        "substations": substations,
        "technicians": technicians,
        "totalCount": total_count,
        "liveCount": live_count,
        "lastKnownCount": last_known_count,
        "noLocationCount": no_location_count,
        "onDutyCount": on_duty_count,
        "standbyCount": standby_count,
        "onlineCount": live_count,
        "offlineCount": standby_count,
        "summary": {
            "total": total_count,
            "live": live_count,
            "lastKnown": last_known_count,
            "noLocation": no_location_count,
            "onDuty": on_duty_count,
            "standby": standby_count
        },
        "indiaCenter": {
            "latitude": 22.5937,
            "longitude": 78.9629,
            "zoom": 5,
            "minZoom": 4,
            "maxZoom": 20
        },
        "maharashtraCenter": {
            "latitude": 22.5937,
            "longitude": 78.9629,
            "zoom": 5,
            "minZoom": 4,
            "maxZoom": 20
        },
        "mapProvider": "Mappls",
        "mapStyle": "https://apis.mappls.com/maps/vector/style",
        "attribution": "Mappls ● MapmyIndia",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

@router.get("/history/{employee_id}")
async def get_employee_location_history(
    employee_id: str,
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format (defaults to today)"),
    limit: int = Query(500, description="Max GPS points to retrieve"),
    token_data: dict = Depends(get_current_user_token)
):
    """
    Retrieves full timestamped GPS breadcrumb history for an employee on a specific date.
    Calculates:
    - Start location and start time
    - Last recorded location and last recorded time
    - Total recorded distance travelled (excluding jitter < 10m and jumps > 50km)
    - Stationary stops and stop durations
    - Chronological list of GPS points
    """
    target_date = date or get_today_ist_str()
    emp = db.get_employee(employee_id) or db.find_employee_by_identifier(employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    pings = db.get_location_history(emp.get("_id", employee_id), target_date, limit=limit)

    # If no pings recorded yet for target date, check today's attendance punch coordinates
    if not pings:
        att = db.get_today_attendance(emp.get("_id", employee_id), target_date)
        if att:
            if att.get("checkIn") and att["checkIn"].get("latitude"):
                ci = att["checkIn"]
                pings.append({
                    "employeeId": emp.get("_id", employee_id),
                    "latitude": float(ci["latitude"]),
                    "longitude": float(ci["longitude"]),
                    "accuracy": 8.0,
                    "speed": 0.0,
                    "heading": 0.0,
                    "timestamp": ci.get("time") or "",
                    "timestampIST": ci.get("timeIST") or "09:00 AM IST",
                    "dateIST": target_date,
                    "locationName": ci.get("siteName") or "Check-In Point"
                })
            if att.get("checkOut") and att["checkOut"].get("latitude"):
                co = att["checkOut"]
                pings.append({
                    "employeeId": emp.get("_id", employee_id),
                    "latitude": float(co["latitude"]),
                    "longitude": float(co["longitude"]),
                    "accuracy": 8.0,
                    "speed": 0.0,
                    "heading": 0.0,
                    "timestamp": co.get("time") or "",
                    "timestampIST": co.get("timeIST") or "06:00 PM IST",
                    "dateIST": target_date,
                    "locationName": co.get("siteName") or "Check-Out Point"
                })

    # Sort pings chronologically
    pings.sort(key=lambda x: str(x.get("timestamp") or x.get("timestampIST") or ""))

    # Calculate actual distance travelled & detect stops
    total_dist_m = 0.0
    stops = []
    current_stop_start = None
    last_stop_ping = None

    for i in range(len(pings) - 1):
        p1 = pings[i]
        p2 = pings[i + 1]
        lat1, lon1 = float(p1["latitude"]), float(p1["longitude"])
        lat2, lon2 = float(p2["latitude"]), float(p2["longitude"])
        step_m = calculate_haversine_distance(lat1, lon1, lat2, lon2)

        # Ignore tiny sensor jitter (< 10m) and teleports (> 60km)
        if 10.0 <= step_m <= 60000.0:
            total_dist_m += step_m

        # Stop detection: if movement is < 25m
        if step_m < 25.0:
            if not current_stop_start:
                current_stop_start = p1
            last_stop_ping = p2
        else:
            if current_stop_start and last_stop_ping:
                try:
                    t1_str = current_stop_start.get("timestamp", "").replace("Z", "+00:00")
                    t2_str = last_stop_ping.get("timestamp", "").replace("Z", "+00:00")
                    if t1_str and t2_str:
                        dt1 = datetime.fromisoformat(t1_str)
                        dt2 = datetime.fromisoformat(t2_str)
                        dur_mins = int((dt2 - dt1).total_seconds() / 60.0)
                        if dur_mins >= 5:
                            stops.append({
                                "latitude": float(current_stop_start["latitude"]),
                                "longitude": float(current_stop_start["longitude"]),
                                "startTime": current_stop_start.get("timestampIST") or "",
                                "endTime": last_stop_ping.get("timestampIST") or "",
                                "durationMinutes": dur_mins,
                                "durationFormatted": f"{dur_mins} mins" if dur_mins < 60 else f"{dur_mins // 60}h {dur_mins % 60}m"
                            })
                except Exception:
                    pass
                current_stop_start = None
                last_stop_ping = None

    # Handle pending stop at the end
    if current_stop_start and last_stop_ping:
        try:
            t1_str = current_stop_start.get("timestamp", "").replace("Z", "+00:00")
            t2_str = last_stop_ping.get("timestamp", "").replace("Z", "+00:00")
            if t1_str and t2_str:
                dt1 = datetime.fromisoformat(t1_str)
                dt2 = datetime.fromisoformat(t2_str)
                dur_mins = int((dt2 - dt1).total_seconds() / 60.0)
                if dur_mins >= 5:
                    stops.append({
                        "latitude": float(current_stop_start["latitude"]),
                        "longitude": float(current_stop_start["longitude"]),
                        "startTime": current_stop_start.get("timestampIST") or "",
                        "endTime": last_stop_ping.get("timestampIST") or "",
                        "durationMinutes": dur_mins,
                        "durationFormatted": f"{dur_mins} mins" if dur_mins < 60 else f"{dur_mins // 60}h {dur_mins % 60}m"
                    })
        except Exception:
            pass

    start_point = pings[0] if pings else None
    end_point = pings[-1] if pings else None
    total_km = round(total_dist_m / 1000.0, 2)

    return {
        "employeeId": emp.get("_id", employee_id),
        "employeeName": emp.get("name", "Field Technician"),
        "employeeCode": emp.get("employeeId", ""),
        "date": target_date,
        "totalPoints": len(pings),
        "totalDistanceKm": total_km,
        "totalDistanceFormatted": f"{total_km} km" if total_km >= 1.0 else f"{int(total_dist_m)} m",
        "startPoint": {
            "latitude": float(start_point["latitude"]),
            "longitude": float(start_point["longitude"]),
            "time": start_point.get("timestampIST") or start_point.get("timestamp"),
            "locationName": start_point.get("locationName") or "Start Position"
        } if start_point else None,
        "endPoint": {
            "latitude": float(end_point["latitude"]),
            "longitude": float(end_point["longitude"]),
            "time": end_point.get("timestampIST") or end_point.get("timestamp"),
            "locationName": end_point.get("locationName") or "Latest Position"
        } if end_point else None,
        "stops": stops,
        "points": [
            {
                "latitude": float(p["latitude"]),
                "longitude": float(p["longitude"]),
                "accuracy": p.get("accuracy", 10.0),
                "speed": p.get("speed", 0.0),
                "heading": p.get("heading", 0.0),
                "time": p.get("timestampIST") or p.get("timestamp"),
                "timestamp": p.get("timestamp")
            }
            for p in pings
        ],
        "coordinates": [[float(p["latitude"]), float(p["longitude"])] for p in pings]
    }

@router.get("/employee/{employee_id}/last-known")
async def get_employee_last_known_location(
    employee_id: str,
    token_data: dict = Depends(get_current_user_token)
):
    """
    Returns verified LAST KNOWN LOCATION for a specific employee.
    Includes time elapsed, accuracy, speed, heading, assigned site, and road distance.
    """
    emp = db.get_employee(employee_id) or db.find_employee_by_identifier(employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    all_sites = db.get_all_sites()
    sites_map = {s["_id"]: s for s in all_sites}
    assigned_site = sites_map.get(emp.get("assignedSiteId")) or (all_sites[0] if all_sites else None)

    lat = emp.get("latitude")
    lon = emp.get("longitude")
    if lat is None or lon is None:
        if assigned_site and assigned_site.get("latitude"):
            lat = assigned_site["latitude"]
            lon = assigned_site["longitude"]

    now_utc = datetime.utcnow()
    last_ping_dt = None
    if emp.get("lastSeenTimestamp"):
        try:
            ping_time_str = emp["lastSeenTimestamp"].replace("Z", "+00:00")
            last_ping_dt = datetime.fromisoformat(ping_time_str).replace(tzinfo=None)
        except Exception:
            pass

    is_live = False
    if last_ping_dt:
        is_live = (now_utc - last_ping_dt).total_seconds() <= 900

    dist_m = 0.0
    if lat and lon and assigned_site and assigned_site.get("latitude"):
        dist_m = calculate_haversine_distance(lat, lon, assigned_site["latitude"], assigned_site["longitude"])

    road_km = round((dist_m / 1000.0) * 1.25, 2) if dist_m > 0 else 0.0

    return {
        "employeeId": emp.get("_id", employee_id),
        "employeeName": emp.get("name", "Field Technician"),
        "employeeCode": emp.get("employeeId", ""),
        "designation": emp.get("designation", "Field Technician"),
        "circle": emp.get("circle", "Maharashtra"),
        "division": emp.get("division", "Grid Operations"),
        "latitude": lat,
        "longitude": lon,
        "accuracy": emp.get("accuracy", "±8m Lock"),
        "speed": emp.get("speed"),
        "heading": emp.get("heading"),
        "isLive": is_live,
        "statusLabel": "LIVE LOCATION" if is_live else "LAST KNOWN LOCATION",
        "lastSeen": emp.get("lastLocationTime") or emp.get("lastSeen") or "Logged",
        "lastLocationDate": emp.get("lastLocationDate") or get_today_ist_str(),
        "timeAgo": _time_ago(last_ping_dt, now_utc) if last_ping_dt else "Offline",
        "assignedSite": assigned_site,
        "distanceToSiteMeters": round(dist_m, 1),
        "roadDistanceToSiteKm": road_km
    }
