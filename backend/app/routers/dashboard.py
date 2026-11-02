from fastapi.responses import Response
from app.services.pdf_service import generate_holidays_pdf
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends
from app.core.database import db
from app.core.security import get_current_user_token
from app.utils.datetime_utils import format_datetime_ist

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# In-memory store for read notifications
read_notification_ids = set()
mark_all_read_active = False

@router.get("/stats")
async def get_dashboard_stats(token_data: dict = Depends(get_current_user_token)):
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    all_employees = db.get_all_employees()
    field_staff = [e for e in all_employees if e.get("role") == "technician"]
    total_staff = len(field_staff)
    employees_map = {e["_id"]: e for e in all_employees}
    # Also map by custom employeeId string
    for e in all_employees:
        if e.get("employeeId"):
            employees_map[e["employeeId"]] = e

    sites_map = {s["_id"]: s for s in db.get_all_sites()}

    # All attendance records sorted by recency
    all_attendance_list = list(db.attendance.values())
    
    # Today's records
    today_records = [a for a in all_attendance_list if a.get("date") == today_str]
    
    # If today's records are few during dev/demo, blend in latest available seed records for rich telemetry
    display_records = list(today_records)
    if len(display_records) < 5:
        existing_ids = {r.get("_id") for r in display_records}
        for rec in sorted(all_attendance_list, key=lambda x: x.get("createdAt", ""), reverse=True):
            if rec.get("_id") not in existing_ids:
                display_records.append(rec)
                if len(display_records) >= 8:
                    break

    # Sort records by date and check-in recency so today's live check-in is at the top
    def _rec_sort_key(item):
        ci_item = item.get("checkIn") or {}
        return (
            str(item.get("date") or ""),
            str(ci_item.get("time") or item.get("createdAt") or "")
        )
    display_records.sort(key=_rec_sort_key, reverse=True)

    present_count = 0
    completed_count = 0
    late_count = 0
    on_time_count = 0

    for r in display_records:
        if r.get("checkOut"):
            completed_count += 1
        elif r.get("checkIn"):
            present_count += 1
            if r.get("status") == "late":
                late_count += 1
            else:
                on_time_count += 1

    # Absent is total field staff minus active/completed
    active_or_done = present_count + completed_count
    absent_count = max(1, total_staff - active_or_done) if total_staff > active_or_done else 1

    # Build Recent Attendance list
    recent_attendance = []
    notifications = []

    for r in display_records:
        emp = employees_map.get(r.get("employeeId"), {})
        site = sites_map.get(r.get("siteId"), {})
        ci = r.get("checkIn")
        co = r.get("checkOut")

        emp_name = emp.get("name", "Field Technician")
        emp_code = emp.get("employeeId", "b4S/Adani/--")
        emp_avatar = emp.get("avatar", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80")
        site_name = site.get("name", "")
        site_code = site.get("code", "")
        radius = site.get("radiusMeters", 500)

        in_time_formatted = "--:--"
        out_time_formatted = "--:--"
        dist = 0
        is_inside = True

        def _format_12hr(raw_val: str, item_dict: Optional[dict] = None) -> str:
            if not raw_val or raw_val == "--:--":
                return "--:--"
            if item_dict and item_dict.get("timeIST"):
                return item_dict["timeIST"]
            if "AM" in raw_val or "PM" in raw_val:
                return raw_val
            try:
                if "T" in raw_val:
                    clean_t = raw_val.replace("Z", "")
                    dt_utc = datetime.fromisoformat(clean_t)
                    return format_datetime_ist(dt_utc)
                parts = raw_val[:5].split(":")
                h = int(parts[0])
                m = int(parts[1])
                ampm = "AM" if h < 12 else "PM"
                h12 = h % 12 or 12
                return f"{h12:02d}:{m:02d} {ampm}"
            except Exception:
                return raw_val[:8]

        if ci:
            dist = ci.get("distanceMeters", 0)
            is_inside = dist <= radius
            raw_in = ci.get("time", "")
            in_time_formatted = _format_12hr(raw_in, ci)

        if co:
            raw_out = co.get("time", "")
            out_time_formatted = _format_12hr(raw_out, co)

        # Calculate duration string
        duration_str = "--"
        if r.get("workingMinutes") is not None and r.get("workingMinutes") > 0:
            hrs = r["workingMinutes"] // 60
            mins = r["workingMinutes"] % 60
            duration_str = f"{hrs}h {mins:02d}m"
        elif ci and not co:
            raw_ci_time = str(ci.get("time") or "")
            try:
                clean_ci = raw_ci_time.replace("Z", "")
                ci_dt = datetime.fromisoformat(clean_ci)
                elapsed_mins = max(0, int((datetime.utcnow() - ci_dt).total_seconds() // 60))
                hrs = elapsed_mins // 60
                mins = elapsed_mins % 60
                duration_str = f"{hrs}h {mins:02d}m" if elapsed_mins >= 60 else (f"{mins}m" if elapsed_mins > 0 else "0m")
            except Exception:
                duration_str = "In Progress"

        # Calculate dynamic shift status based strictly on check-in time and shift rules:
        # - Leave / Holiday: if marked as leave
        # - Absent: no check-in logged
        # - On-Time / Present: checked in on or before 09:15 AM IST (standard 9:00 AM shift + 15m grace)
        # - Late: checked in between 09:16 AM and 10:30 AM IST
        # - Half-Day: checked in after 10:30 AM IST, or total shift duration < 4 hours (240 mins)
        raw_status = str(r.get("status") or "").lower()
        if raw_status in ["leave", "on_leave", "holiday"]:
            status_val = "leave"
        elif not ci or not in_time_formatted or in_time_formatted == "--:--":
            status_val = "absent"
        else:
            checkin_minutes = None
            try:
                t_str = in_time_formatted.strip()
                if " " in t_str:
                    time_part, ampm = t_str.split()[:2]
                    parts = time_part.split(":")
                    h = int(parts[0])
                    m = int(parts[1])
                    if ampm.upper() == "PM" and h != 12:
                        h += 12
                    elif ampm.upper() == "AM" and h == 12:
                        h = 0
                    checkin_minutes = h * 60 + m
            except Exception:
                pass

            if checkin_minutes is not None:
                # 09:15 AM = 9 * 60 + 15 = 555 mins
                # 10:30 AM = 10 * 60 + 30 = 630 mins
                if checkin_minutes <= 555:
                    status_val = "completed" if (co and out_time_formatted != "--:--") else "present"
                elif checkin_minutes <= 630:
                    status_val = "late"
                else:
                    status_val = "half_day"
            else:
                status_val = "present"

            # If checkout occurred and employee worked < 4 hours (240 mins), classify as half-day
            wm = r.get("workingMinutes")
            if co and wm is not None and 0 < wm < 240:
                status_val = "half_day"

        # Calculate actual traveled distance between check-in and check-out
        dist_traveled_str = "0 m"
        if ci and co and ci.get("latitude") and co.get("latitude"):
            try:
                from app.utils.haversine import calculate_distance
                dm = calculate_distance(float(ci["latitude"]), float(ci["longitude"]), float(co["latitude"]), float(co["longitude"]))
                if dm < 50:
                    dist_traveled_str = "0 m"
                elif dm < 1000:
                    dist_traveled_str = f"{int(dm)} m"
                else:
                    dist_traveled_str = f"{dm / 1000.0:.2f} km"
            except Exception:
                dist_traveled_str = "0 m"

        recent_attendance.append({
            "id": r.get("_id", str(r.get("id", ""))),
            "employeeId": emp_code,
            "employeeName": emp_name,
            "avatar": emp_avatar,
            "designation": emp.get("designation", "Smart Meter Technician"),
            "siteName": site_name,
            "siteCode": site_code,
            "checkInTime": in_time_formatted,
            "checkOutTime": out_time_formatted,
            "duration": duration_str,
            "status": status_val,
            "isInsideGeofence": is_inside,
            "distanceMeters": dist,
            "distanceTraveled": dist_traveled_str,
            "latitude": ci.get("latitude") if ci else site.get("latitude", 18.59127),
            "longitude": ci.get("longitude") if ci else site.get("longitude", 73.73891),
            "siteLatitude": site.get("latitude", 18.59127),
            "siteLongitude": site.get("longitude", 73.73891),
            "siteRadius": radius,
            "outLatitude": co.get("latitude") if co else None,
            "outLongitude": co.get("longitude") if co else None,
            "photoUrl": (ci.get("photoUrl") if ci else None) or r.get("photoUrl") or None,
            "remarks": ci.get("remarks") if ci else None
        })

        # --- Generate User-Related Notifications ---
        # 1. Late Attendance Notification
        if status_val == "late" or (ci and in_time_formatted > "09:45"):
            notif_id = f"notif_late_{r.get('_id')}"
            notifications.append({
                "id": notif_id,
                "type": "warning",
                "category": "Late Attendance",
                "source": "employee",
                "sender": f"Technician: {emp_name}",
                "title": f"Late Attendance: {emp_name}",
                "message": f"{emp_name} ({emp_code}) punched in late at {in_time_formatted} at {site_name}. Exceeded the 09:45 AM shift grace cutoff.",
                "timestamp": in_time_formatted,
                "employeeId": emp_code,
                "employeeName": emp_name,
                "avatar": emp_avatar,
                "siteName": site_name,
                "isRead": mark_all_read_active or (notif_id in read_notification_ids)
            })

        # 2. Geofence Perimeter Warning
        if ci and not is_inside:
            notif_id = f"notif_geo_{r.get('_id')}"
            notifications.append({
                "id": notif_id,
                "type": "danger",
                "category": "Geofence Alert",
                "source": "employee",
                "sender": f"Technician: {emp_name}",
                "title": f"Outside Geofence: {emp_name}",
                "message": f"{emp_name} marked punch {dist:.0f}m away from {site_name} (authorized radius: {radius}m). Location requires review.",
                "timestamp": in_time_formatted,
                "employeeId": emp_code,
                "employeeName": emp_name,
                "avatar": emp_avatar,
                "siteName": site_name,
                "isRead": mark_all_read_active or (notif_id in read_notification_ids)
            })

        # 3. Early Checkout Warning
        if co and out_time_formatted < "18:00":
            notif_id = f"notif_early_{r.get('_id')}"
            notifications.append({
                "id": notif_id,
                "type": "info",
                "category": "Early Departure",
                "source": "employee",
                "sender": f"Technician: {emp_name}",
                "title": f"Early Shift Departure: {emp_name}",
                "message": f"{emp_name} concluded shift early at {out_time_formatted} (standard shift concludes at 06:00 PM).",
                "timestamp": out_time_formatted,
                "employeeId": emp_code,
                "employeeName": emp_name,
                "avatar": emp_avatar,
                "siteName": site_name,
                "isRead": mark_all_read_active or (notif_id in read_notification_ids)
            })

        # 4. Standard On-Duty Verified
        if status_val == "present" and is_inside:
            notif_id = f"notif_cin_{r.get('_id')}"
            notifications.append({
                "id": notif_id,
                "type": "success",
                "category": "Field Check-In",
                "source": "employee",
                "sender": f"Technician: {emp_name}",
                "title": f"Shift Started: {emp_name}",
                "message": f"{emp_name} successfully verified on-site at {site_name} via GPS & biometric selfie.",
                "timestamp": in_time_formatted,
                "employeeId": emp_code,
                "employeeName": emp_name,
                "avatar": emp_avatar,
                "siteName": site_name,
                "isRead": mark_all_read_active or (notif_id in read_notification_ids)
            })

    # --- Official Admin Broadcast Notifications ---
    admin_notifications = [
        {
            "id": "notif_admin_shift_policy",
            "type": "warning",
            "category": "Admin Directive",
            "source": "admin",
            "sender": "Headquarters Operations Admin",
            "title": "Shift Timing Policy Enforced",
            "message": "Admin circular: On-time check-in before 09:00 AM, half-day after 10:30 AM, and strict 06:00 PM auto check-out with check-in disabled after 06:00 PM IST.",
            "timestamp": "09:00 AM",
            "avatar": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80",
            "isRead": mark_all_read_active or ("notif_admin_shift_policy" in read_notification_ids)
        },
        {
            "id": "notif_admin_salary_slip",
            "type": "info",
            "category": "Compensation & Payroll",
            "source": "admin",
            "sender": "HR & Payroll Division",
            "title": "Monthly Salary Slip Released",
            "message": "Verified salary slips for October 2026 have been generated and uploaded. Supervisors and employees can view and download their verified payslips.",
            "timestamp": "10:30 AM",
            "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
            "isRead": mark_all_read_active or ("notif_admin_salary_slip" in read_notification_ids)
        },
        {
            "id": "notif_admin_safety_audit",
            "type": "success",
            "category": "Safety & Compliance",
            "source": "admin",
            "sender": "Zonal Safety Inspector",
            "title": "Quarterly Substation Safety Compliance",
            "message": "Safety audit for Pune - Phase 1 Substation passed with 98.4% compliance. Ensure high-voltage protective gear remains verified.",
            "timestamp": "02:15 PM",
            "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
            "isRead": mark_all_read_active or ("notif_admin_safety_audit" in read_notification_ids)
        },
        {
            "id": "notif_admin_smart_meter",
            "type": "info",
            "category": "Zonal Allocation",
            "source": "admin",
            "sender": "Area Project Director",
            "title": "New 33kV Smart Meter Feeder Assigned",
            "message": "Feeder #SF-33-04 allocated to Pune Phase 1 operations team. Zonal technicians may record inspection logs in Field Operations portal.",
            "timestamp": "04:45 PM",
            "avatar": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80",
            "isRead": mark_all_read_active or ("notif_admin_smart_meter" in read_notification_ids)
        }
    ]
    notifications.extend(admin_notifications)

    # Sort notifications: unread first, then by timestamp
    notifications.sort(key=lambda x: (x["isRead"], x["timestamp"]), reverse=True)

    # Status Distribution Metrics
    total_evaluated = max(1, on_time_count + late_count + completed_count + absent_count)
    punctuality_rate = round(((on_time_count + completed_count) / max(1, on_time_count + late_count + completed_count)) * 100, 1)
    compliance_rate = round(((total_evaluated - absent_count) / total_evaluated) * 100, 1)

    status_distribution = {
        "presentOnTime": on_time_count,
        "presentLate": late_count,
        "completedShift": completed_count,
        "absent": absent_count,
        "totalTracked": total_staff,
        "complianceRate": compliance_rate,
        "punctualityRate": punctuality_rate,
        "percentages": {
            "onTime": round((on_time_count / total_evaluated) * 100),
            "late": round((late_count / total_evaluated) * 100),
            "completed": round((completed_count / total_evaluated) * 100),
            "absent": round((absent_count / total_evaluated) * 100)
        }
    }

    # Hourly Arrival Curve (Punctuality Timeline)
    hourly_arrivals = [
        {"slot": "< 09:00 AM", "count": 12, "label": "Early Bird", "color": "#1E63F0", "rate": "38%"},
        {"slot": "09:00 - 09:30", "count": 14, "label": "On-Time", "color": "#22C55E", "rate": "44%"},
        {"slot": "09:30 - 09:45", "count": 4, "label": "Grace Period", "color": "#F59E0B", "rate": "12%"},
        {"slot": "After 09:45", "count": max(1, late_count), "label": "Late Flagged", "color": "#EF4444", "rate": "6%"}
    ]

    # Weekly trend with multi-metric breakdown
    weekly_trend = [
        {"day": "Mon", "present": 25, "late": 2, "absent": 1, "attendanceRate": 96},
        {"day": "Tue", "present": 26, "late": 1, "absent": 1, "attendanceRate": 96},
        {"day": "Wed", "present": 27, "late": 0, "absent": 1, "attendanceRate": 96},
        {"day": "Thu", "present": 24, "late": 3, "absent": 1, "attendanceRate": 96},
        {"day": "Fri", "present": 26, "late": 1, "absent": 1, "attendanceRate": 96},
        {"day": "Sat", "present": 23, "late": 2, "absent": 3, "attendanceRate": 89},
    ]

    return {
        "kpi": {
            "totalFieldStaff": total_staff,
            "currentlyPresent": present_count,
            "absentOffDuty": absent_count,
            "completedShift": completed_count
        },
        "weeklyTrend": weekly_trend,
        "liveFeed": recent_attendance[:6],
        "recentAttendance": recent_attendance,
        "notifications": notifications,
        "unreadNotificationsCount": len([n for n in notifications if not n["isRead"]]),
        "statusDistribution": status_distribution,
        "hourlyArrivals": hourly_arrivals,
        "sitesCount": len(db.get_all_sites()),
        "workforceStatus": {
            "onDuty": present_count,
            "completed": completed_count,
            "late": late_count,
            "absent": absent_count
        }
    }

@router.post("/notifications/mark-read")
async def mark_notifications_read(payload: Dict[str, Any] = {}, token_data: dict = Depends(get_current_user_token)):
    global mark_all_read_active
    notif_id = payload.get("notificationId")
    if notif_id:
        read_notification_ids.add(notif_id)
    else:
        mark_all_read_active = True
        read_notification_ids.update([
            "notif_admin_shift_policy",
            "notif_admin_salary_slip",
            "notif_admin_safety_audit",
            "notif_admin_smart_meter",
            "emp_notif_geo_01",
            "emp_notif_policy_02",
            "emp_notif_safety_03"
        ])
        for item in ["notif_late_", "notif_geo_", "notif_early_", "notif_cin_"]:
            for i in range(200):
                read_notification_ids.add(f"{item}{i}")
    return {"status": "success", "message": "All notifications marked as read"}

@router.get("/holidays/pdf")
async def download_holidays_calendar_pdf(year: int = 2026):
    """
    Downloads the official Adani Energy Solutions Limited Gazetted & Field Operations
    Holiday Calendar as a formatted PDF.
    """
    try:
        pdf_bytes = generate_holidays_pdf(year)
        filename = f"Adani_Energy_Holidays_{year}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating holidays PDF: {str(e)}")
