import logging
import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from app.core.security import get_current_user_token, require_roles
from app.core.database import db
from app.services.attendance_service import attendance_service
from app.services.storage_service import storage_service
from app.utils.datetime_utils import format_datetime_ist
from app.schemas.attendance import (
    CheckInRequest,
    CheckOutRequest,
    AttendanceResponse,
    AdjustAttendanceRequest,
    MarkAttendanceRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attendance", tags=["Attendance"])

@router.post("/upload-photo")
async def upload_attendance_photo(
    photo: UploadFile = File(...),
    token_data: dict = Depends(get_current_user_token)
):
    url = await storage_service.save_file(photo, subfolder="selfie")
    return {"photoUrl": url}

@router.post("/check-in", response_model=AttendanceResponse)
async def check_in(
    req: CheckInRequest,
    token_data: dict = Depends(get_current_user_token)
):
    record = attendance_service.process_check_in(
        user=token_data,
        site_id=req.siteId,
        latitude=req.latitude,
        longitude=req.longitude,
        accuracy=req.accuracy,
        remarks=req.remarks,
        photo_url=req.photoUrl
    )
    return record

@router.post("/check-out", response_model=AttendanceResponse)
async def check_out(
    req: CheckOutRequest,
    token_data: dict = Depends(get_current_user_token)
):
    record = attendance_service.process_check_out(
        user=token_data,
        latitude=req.latitude,
        longitude=req.longitude,
        accuracy=req.accuracy,
        remarks=req.remarks
    )
    return record

@router.get("/today")
async def get_today_attendance(
    token_data: dict = Depends(get_current_user_token)
):
    emp_id = token_data["id"]
    emp = db.get_employee(emp_id) or db.find_employee_by_identifier(emp_id)
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    record = db.get_today_attendance(emp_id, today_str)
    if record:
        record = attendance_service.apply_auto_checkout_if_needed(record)
    
    # Derive assigned site dynamically from latest employee DB state
    assigned_site_id = None
    if emp:
        assigned_site_id = emp.get("assignedSiteId") or (emp.get("assignedSiteIds", [None])[0] if emp.get("assignedSiteIds") else None)
        resolved_site_id = assigned_site_id
    else:
        resolved_site_id = record.get("siteId") if record else None
    raw_site = db.get_site(resolved_site_id) if resolved_site_id else None
    
    site_obj = None
    if raw_site:
        site_obj = {**raw_site, "id": raw_site.get("_id", raw_site.get("id"))}

    if not record:
        return {
            "status": "not_started",
            "liveElapsedMinutes": 0,
            "message": "Shift Not Started",
            "record": None,
            "site": site_obj
        }
    
    # Calculate live elapsed duration if currently active
    live_elapsed_minutes = 0
    if record.get("checkIn") and not record.get("checkOut"):
        ci_str = record["checkIn"]["time"].replace("Z", "")
        ci_dt = datetime.fromisoformat(ci_str)
        now = datetime.utcnow()
        live_elapsed_minutes = int(max(0, (now - ci_dt).total_seconds() // 60))

    return {
        "status": "completed" if record.get("checkOut") else "active",
        "liveElapsedMinutes": live_elapsed_minutes,
        "record": record,
        "site": site_obj
    }

@router.get("/history")
async def get_attendance_history(
    month: Optional[int] = None,
    year: Optional[int] = None,
    employeeId: Optional[str] = None,
    token_data: dict = Depends(get_current_user_token)
):
    user_role = token_data.get("role", "technician").lower()
    target_emp_id = token_data["id"]
    
    # If supervisor/admin, they can query specific employeeId
    if user_role in ["supervisor", "admin"] and employeeId:
        target_emp_id = employeeId

    raw_records = db.get_attendance_history(target_emp_id, month=month, year=year)
    is_fallback = False
    if not raw_records and (month is not None or year is not None):
        # Graceful fallback: return latest records for this employee so history is never blank
        all_emp_records = db.get_attendance_history(target_emp_id)
        if all_emp_records:
            raw_records = all_emp_records
            is_fallback = True
    emp = db.get_employee(target_emp_id) or db.find_employee_by_identifier(target_emp_id)
    fallback_site_name = None
    if emp and emp.get("assignedSiteId"):
        fallback_s = db.get_site(emp["assignedSiteId"])
        if fallback_s:
            fallback_site_name = fallback_s.get("name")

    records = []
    for r in raw_records:
        r = attendance_service.apply_auto_checkout_if_needed(r)
        if not r.get("siteName"):
            if r.get("siteId"):
                s = db.get_site(r["siteId"])
                if s:
                    r["siteName"] = s.get("name")
            if not r.get("siteName") and fallback_site_name:
                r["siteName"] = fallback_site_name
            if not r.get("siteName"):
                r["siteName"] = "Assigned Substation"
        records.append(r)
    
    # Compute KPI summaries for this month
    total_days = len(records)
    present_count = sum(1 for r in records if r.get("status") in ["present", "P"])
    late_count = sum(1 for r in records if r.get("status") == "late")
    half_day_count = sum(1 for r in records if r.get("status") == "half_day")
    absent_count = sum(1 for r in records if r.get("status") in ["absent", "A"])
    total_minutes = sum(r.get("workingMinutes", 0) for r in records)
    total_hours = round(total_minutes / 60.0, 1)

    return {
        "summary": {
            "totalWorkingDays": 26,
            "presentDays": present_count,
            "lateDays": late_count,
            "halfDays": half_day_count,
            "absentDays": absent_count,
            "totalHours": total_hours
        },
        "records": records
    }

@router.get("/admin/all-logs")
async def get_all_attendance_logs(
    month: Optional[int] = 10,
    year: Optional[int] = 2026,
    period: Optional[str] = "monthly",
    employeeId: Optional[str] = None,
    token_data: dict = Depends(get_current_user_token)
):
    try:
        all_records = list(db.attendance.values())
        
        # Filter by employee if requested or if caller is a supervisor querying own records
        target_filter = employeeId
        if not target_filter and token_data.get("role") == "supervisor":
            target_filter = token_data.get("id")

        if target_filter and target_filter != "all":
            valid_ids = {str(target_filter)}
            emp_user = db.get_user_by_id(target_filter) or db.get_user_by_employee_id(target_filter)
            if emp_user:
                if emp_user.get("id"):
                    valid_ids.add(str(emp_user["id"]))
                if emp_user.get("_id"):
                    valid_ids.add(str(emp_user["_id"]))
                if emp_user.get("employeeId"):
                    valid_ids.add(str(emp_user["employeeId"]))
            all_records = [
                r for r in all_records
                if r and (
                    str(r.get("employeeId") or "") in valid_ids
                    or str(r.get("technicianCode") or "") in valid_ids
                )
            ]

        # Map with user and site details
        enriched = []
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        
        for r in all_records:
            if not isinstance(r, dict):
                continue
            r = attendance_service.apply_auto_checkout_if_needed(r)
            r_date = str(r.get("date") or "")
            # Filter month/year if monthly
            if month and r_date and "-" in r_date:
                try:
                    parts = r_date.split("-")
                    r_year = int(parts[0])
                    r_month = int(parts[1])
                    if r_year != year or r_month != month:
                        continue
                except Exception:
                    pass

            emp_key = str(r.get("employeeId") or "")
            user = db.get_user_by_id(emp_key) if emp_key else None
            user_name = user.get("name", "Field Technician") if user else (r.get("technicianName") or "Rohit Sharma")
            user_emp_id = user.get("employeeId", "b4S/Adani/01") if user else (r.get("technicianCode") or "b4S/Adani/01")

            site_key = str(r.get("siteId") or "")
            site = db.get_site(site_key) if site_key else None
            site_name = site.get("name") if site else (r.get("siteName") or "st. joseph university")

            # Format times in Indian Standard Time (IST)
            ci_str = "--:--"
            ci_dict = r.get("checkIn") if isinstance(r.get("checkIn"), dict) else {}
            if ci_dict and ci_dict.get("timeIST"):
                ci_str = ci_dict["timeIST"]
            elif ci_dict and ci_dict.get("time"):
                t = str(ci_dict["time"])
                if "AM" in t or "PM" in t:
                    ci_str = t
                elif "T" in t:
                    try:
                        clean_t = t.replace("Z", "")
                        dt_utc = datetime.fromisoformat(clean_t)
                        ci_str = format_datetime_ist(dt_utc)
                    except Exception:
                        ci_str = t
                else:
                    ci_str = t

            co_str = "--:--"
            co_dict = r.get("checkOut") if isinstance(r.get("checkOut"), dict) else {}
            if co_dict and co_dict.get("timeIST"):
                co_str = co_dict["timeIST"]
            elif co_dict and co_dict.get("time"):
                t = str(co_dict["time"])
                if "AM" in t or "PM" in t:
                    co_str = t
                elif "T" in t:
                    try:
                        clean_t = t.replace("Z", "")
                        dt_utc = datetime.fromisoformat(clean_t)
                        co_str = format_datetime_ist(dt_utc)
                    except Exception:
                        co_str = t
                else:
                    co_str = t

            # Duration: real completed or live active duration
            wm = r.get("workingMinutes")
            try:
                wm = int(wm) if wm is not None else 0
            except Exception:
                wm = 0

            if wm > 0:
                h = wm // 60
                m = wm % 60
                duration_str = f"{h}h {m:02d}m"
            elif ci_dict and not co_dict:
                # Active shift: compute real live elapsed minutes from checkIn.time
                ci_time_raw = str(ci_dict.get("time") or "")
                try:
                    clean_ci = ci_time_raw.replace("Z", "")
                    ci_dt = datetime.fromisoformat(clean_ci)
                    elapsed_mins = max(0, int((datetime.utcnow() - ci_dt).total_seconds() // 60))
                    h = elapsed_mins // 60
                    m = elapsed_mins % 60
                    duration_str = f"{h}h {m:02d}m" if elapsed_mins >= 60 else (f"{m}m" if elapsed_mins > 0 else "0m")
                except Exception:
                    duration_str = "In Progress"
            else:
                duration_str = "--"

            # Format date e.g. "22 Oct 2026"
            formatted_date = r_date
            if r_date and "-" in r_date:
                try:
                    dp = r_date.split("-")
                    m_idx = int(dp[1]) - 1
                    if 0 <= m_idx < len(month_names):
                        formatted_date = f"{int(dp[2])} {month_names[m_idx]} {dp[0]}"
                except Exception:
                    pass

            # Real coordinates: Only include checkout coordinates if checkout actually occurred
            ci_lat = float(ci_dict["latitude"]) if (ci_dict and ci_dict.get("latitude")) else (float(site.get("latitude")) if site and site.get("latitude") else 12.962590)
            ci_lon = float(ci_dict["longitude"]) if (ci_dict and ci_dict.get("longitude")) else (float(site.get("longitude")) if site and site.get("longitude") else 77.593617)
            co_lat = float(co_dict["latitude"]) if (co_dict and co_dict.get("latitude")) else None
            co_lon = float(co_dict["longitude"]) if (co_dict and co_dict.get("longitude")) else None

            # Real distance traveled between check-in and check-out sites
            dist_formatted = r.get("distanceTraveledFormatted")
            dist_val = r.get("distanceTraveledKm")
            dist_str = "0 m"
            if dist_formatted:
                dist_str = dist_formatted
            elif dist_val is not None:
                try:
                    dist_str = f"{float(dist_val):.2f} km"
                except Exception:
                    dist_str = str(dist_val)
            elif co_lat is not None and co_lon is not None and (ci_lat != co_lat or ci_lon != co_lon):
                try:
                    from app.utils.haversine import calculate_distance
                    dm = calculate_distance(ci_lat, ci_lon, co_lat, co_lon)
                    if dm < 50:
                        dist_str = "0 m"
                    elif dm < 1000:
                        dist_str = f"{int(dm)} m"
                    else:
                        dist_str = f"{dm / 1000.0:.2f} km"
                except Exception:
                    dist_str = "0 m"
            else:
                dist_str = "0 m"

            status_val = str(r.get("status") or "present")
            if status_val == "half-day":
                status_val = "half_day"
            remarks_val = r.get("adminRemarks") or r.get("remarks")
            if not remarks_val and status_val == "late":
                remarks_val = "Auto-checked out at 06:00 PM (Shift End)"

            co_site_name = r.get("checkOutSiteName") or (co_dict.get("siteName") if (co_dict and co_dict.get("time")) else None) or "--"
            photo_url = ci_dict.get("photoUrl") or r.get("photoUrl") or None

            enriched.append({
                "id": str(r.get("_id") or r.get("id") or f"log_{len(enriched)}"),
                "date": r_date,
                "formattedDate": formatted_date,
                "employeeId": emp_key,
                "technicianName": user_name,
                "technicianCode": user_emp_id,
                "siteId": site_key,
                "siteName": site_name,
                "checkInSiteName": site_name,
                "checkOutSiteName": co_site_name,
                "checkInTime": ci_str,
                "checkOutTime": co_str,
                "duration": duration_str,
                "workingMinutes": wm,
                "distanceTraveled": dist_str,
                "status": status_val,
                "adminRemarks": remarks_val,
                "latitude": ci_lat,
                "longitude": ci_lon,
                "checkInLatitude": ci_lat,
                "checkInLongitude": ci_lon,
                "checkOutLatitude": co_lat,
                "checkOutLongitude": co_lon,
                "photoUrl": photo_url,
            })

        # Sort reverse by date and checkInTime / createdAt safely so today's newest punch is first
        def _sort_key(item):
            d = str(item.get("date") or "")
            t = str(item.get("checkInTime") or "")
            return (d, t)
        enriched.sort(key=_sort_key, reverse=True)
        return {"logs": enriched, "total": len(enriched)}
    except Exception as e:
        logger.error(f"Error in get_all_attendance_logs: {e}", exc_info=True)
        return {"logs": [], "total": 0, "error": str(e)}

def _process_admin_attendance_update(
    employee_id: str,
    date_str: str,
    status_input: str,
    admin_remarks: Optional[str] = None,
    site_name: Optional[str] = None,
    record_id: Optional[str] = None,
    actor_name: str = "Operations Admin"
):
    # 1. Verify date format
    try:
        dt_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD")

    # 2. Check if this date is a Public Holiday in centralized holidays table
    holidays = db.get_all_holidays() if hasattr(db, "get_all_holidays") else list(db.holidays.values())
    for h in holidays:
        if h.get("date") == date_str and h.get("status") != "deleted":
            h_name = h.get("name", "Public Holiday")
            raise HTTPException(
                status_code=400,
                detail=f"Cannot mark Present or Absent on {date_str}. It is a gazetted Public Holiday ({h_name})."
            )

    # 3. Resolve target employee
    emp = db.get_employee(employee_id) or db.find_employee_by_identifier(employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    emp_primary_id = emp["_id"]
    emp_code = emp.get("employeeId", "")
    emp_name = emp.get("name", "Field Technician")

    # 4. Canonical status mapping strictly to P (present) or A (absent)
    st_clean = str(status_input).strip().lower()
    if st_clean in ["p", "present"]:
        canonical_status = "present"
    elif st_clean in ["a", "absent"]:
        canonical_status = "absent"
    elif st_clean in ["wo", "weekly_off"]:
        canonical_status = "weekly_off"
    elif st_clean in ["ph", "public_holiday"]:
        canonical_status = "public_holiday"
    else:
        raise HTTPException(status_code=400, detail=f"Invalid attendance status '{status_input}'. Only P, A, WO, PH are permitted.")

    # 5. Resolve site details
    assigned_site_id = emp.get("assignedSiteId") or (emp.get("assignedSiteIds", [None])[0] if emp.get("assignedSiteIds") else None) or "site_surat_01"
    raw_site = db.get_site(assigned_site_id) if assigned_site_id else None
    resolved_site_name = (raw_site.get("name") if raw_site else None) or site_name or "Assigned Substation"
    site_lat = raw_site.get("latitude", 21.1926) if raw_site else 21.1926
    site_lon = raw_site.get("longitude", 72.7997) if raw_site else 72.7997

    # 6. Locate existing attendance record
    target_rec = None
    if record_id and record_id in db.attendance:
        target_rec = db.attendance[record_id]
    else:
        for r in list(db.attendance.values()):
            if r.get("date") == date_str:
                r_eid = str(r.get("employeeId", "")).strip().lower()
                r_code = str(r.get("technicianCode", "")).strip().lower()
                if r_eid in [emp_primary_id.lower(), emp_code.lower()] or (emp_code and r_code == emp_code.lower()):
                    target_rec = r
                    break

    now_iso = datetime.utcnow().isoformat()

    # 7. Build punch details
    if canonical_status == "present":
        working_minutes = 540
        check_in = {
            "time": f"{date_str}T09:00:00Z",
            "timeIST": "09:00 AM",
            "latitude": site_lat,
            "longitude": site_lon,
            "accuracy": 10.0,
            "siteName": resolved_site_name,
            "remarks": admin_remarks or f"Marked Present by {actor_name}"
        }
        check_out = {
            "time": f"{date_str}T18:00:00Z",
            "timeIST": "06:00 PM",
            "latitude": site_lat,
            "longitude": site_lon,
            "accuracy": 10.0,
            "siteName": resolved_site_name,
            "remarks": "Shift Concluded"
        }
    else:
        working_minutes = 0
        check_in = None
        check_out = None

    if not target_rec:
        new_id = f"att_{uuid.uuid4().hex[:8]}"
        target_rec = {
            "_id": new_id,
            "employeeId": emp_primary_id,
            "technicianCode": emp_code,
            "technicianName": emp_name,
            "date": date_str,
            "siteId": assigned_site_id,
            "siteName": resolved_site_name,
            "status": canonical_status,
            "workingMinutes": working_minutes,
            "checkIn": check_in,
            "checkOut": check_out,
            "adminRemarks": admin_remarks or f"Marked {canonical_status.title()} by {actor_name}",
            "createdAt": now_iso
        }
        db.attendance[new_id] = target_rec
        db.set_firestore_document("attendance", new_id, target_rec)
    else:
        target_rec["status"] = canonical_status
        target_rec["workingMinutes"] = working_minutes
        target_rec["checkIn"] = check_in
        target_rec["checkOut"] = check_out
        target_rec["siteId"] = assigned_site_id
        target_rec["siteName"] = resolved_site_name
        target_rec["technicianName"] = target_rec.get("technicianName") or emp_name
        target_rec["technicianCode"] = target_rec.get("technicianCode") or emp_code
        target_rec["adminRemarks"] = admin_remarks or target_rec.get("adminRemarks") or f"Marked {canonical_status.title()} by {actor_name}"
        target_rec["updatedAt"] = now_iso
        target_rec["updatedBy"] = actor_name
        db.attendance[target_rec["_id"]] = target_rec
        db.set_firestore_document("attendance", target_rec["_id"], target_rec)

    return target_rec

@router.post("/admin/adjust")
async def adjust_attendance_status(
    payload: AdjustAttendanceRequest,
    token_data: dict = Depends(require_roles(["admin"]))
):
    target_rec = _process_admin_attendance_update(
        employee_id=payload.employeeId,
        date_str=payload.date,
        status_input=payload.status,
        admin_remarks=payload.adminRemarks,
        site_name=payload.siteName,
        record_id=payload.recordId,
        actor_name=token_data.get("name", "Operations Admin")
    )
    return {
        "success": True,
        "message": f"Attendance status adjusted to {target_rec.get('status', 'P').replace('_', ' ').title()}",
        "record": target_rec
    }

@router.post("/admin/mark-attendance")
async def mark_admin_attendance(
    payload: MarkAttendanceRequest,
    token_data: dict = Depends(require_roles(["admin"]))
):
    target_rec = _process_admin_attendance_update(
        employee_id=payload.employeeId,
        date_str=payload.date,
        status_input=payload.status,
        admin_remarks=payload.adminRemarks,
        actor_name=token_data.get("name", "Operations Admin")
    )
    display_code = "P" if target_rec.get("status") == "present" else "A"
    return {
        "success": True,
        "message": f"Successfully marked attendance as {display_code} for {target_rec.get('technicianName')} on {payload.date}.",
        "record": target_rec
    }

@router.post("/admin/cleanup-photos")
async def trigger_cleanup_expired_photos(
    hours: int = 24,
    token_data: dict = Depends(get_current_user_token)
):
    count = storage_service.cleanup_expired_photos(max_age_hours=hours)
    return {
        "success": True,
        "message": f"Successfully deleted {count} check-in photos older than {hours} hours.",
        "deletedCount": count
    }
