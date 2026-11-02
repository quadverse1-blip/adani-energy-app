from datetime import datetime, date, time, timedelta
import uuid
from typing import Dict, Any, Optional
from fastapi import HTTPException, status
from app.core.database import db
from app.services.geofence_service import geofence_service
from app.utils.datetime_utils import (
    evaluate_check_in_punctuality,
    is_early_departure,
    calculate_working_hours_status,
    format_datetime_ist
)

class AttendanceService:
    @staticmethod
    def apply_auto_checkout_if_needed(record: Optional[dict]) -> Optional[dict]:
        """
        After 06:00 PM IST (18:00 IST): Auto Checked-Out.
        Applies to standard day shifts for technicians and supervisors.
        If a technician/supervisor checked in before 06:00 PM IST and current IST time is >= 18:00 (or past date),
        auto-checks out at 06:00 PM (18:00 IST / 12:30 UTC).
        """
        if not record or not record.get("checkIn") or record.get("checkOut"):
            return record

        now_utc = datetime.utcnow()
        ist_now = now_utc + timedelta(hours=5, minutes=30)
        today_ist_str = ist_now.strftime("%Y-%m-%d")
        record_date = str(record.get("date") or "")

        ci_str = str(record["checkIn"].get("time") or "").replace("Z", "")
        if not ci_str:
            return record

        try:
            ci_dt = datetime.fromisoformat(ci_str)
            ci_ist = ci_dt + timedelta(hours=5, minutes=30)
        except Exception:
            ci_dt = datetime.utcnow()
            ci_ist = ci_dt + timedelta(hours=5, minutes=30)

        should_checkout = False
        if record_date < today_ist_str:
            # Shift from previous day left open: auto-checkout at 06:00 PM of that date
            should_checkout = True
        elif record_date == today_ist_str and ist_now.time() >= time(18, 0, 0):
            # Standard day shift after 06:00 PM IST: auto-checkout at 06:00 PM
            if ci_ist.time() < time(18, 0, 0):
                should_checkout = True

        if not should_checkout:
            return record

        auto_co_utc_str = f"{record_date}T12:30:00Z"
        working_minutes = 0
        try:
            co_dt = datetime.fromisoformat(f"{record_date}T12:30:00")
            working_seconds = max(0, (co_dt - ci_dt).total_seconds())
            working_minutes = int(working_seconds // 60)
        except Exception:
            working_minutes = int(record.get("workingMinutes") or 480)

        h = working_minutes // 60
        m = working_minutes % 60
        initial_status = record.get("status", "present")

        record["checkOut"] = {
            "time": auto_co_utc_str,
            "timeIST": "06:00 PM",
            "latitude": record["checkIn"].get("latitude", 18.5204),
            "longitude": record["checkIn"].get("longitude", 73.8567),
            "accuracy": 10.0,
            "remarks": "Auto-checked out at 06:00 PM (Shift End)",
            "isAutoCheckedOut": True
        }
        record["workingMinutes"] = working_minutes
        record["workingHoursFormatted"] = f"{h} hrs {m} mins"
        record["adminRemarks"] = "Auto-checked out at 06:00 PM (Shift End)"
        record["status"] = initial_status
        record["updatedAt"] = now_utc.isoformat() + "Z"

        db.save_attendance(record)
        return record
        try:
            co_dt = datetime.fromisoformat(f"{record_date}T12:30:00")
            working_seconds = max(0, (co_dt - ci_dt).total_seconds())
            working_minutes = int(working_seconds // 60)
        except Exception:
            working_minutes = int(record.get("workingMinutes") or 480)

        h = working_minutes // 60
        m = working_minutes % 60
        initial_status = record.get("status", "present")

        record["checkOut"] = {
            "time": auto_co_utc_str,
            "timeIST": "06:00 PM",
            "latitude": record["checkIn"].get("latitude", 18.5204),
            "longitude": record["checkIn"].get("longitude", 73.8567),
            "accuracy": 10.0,
            "remarks": "Auto-checked out at 06:00 PM (Shift End)",
            "isAutoCheckedOut": True
        }
        record["workingMinutes"] = working_minutes
        record["workingHoursFormatted"] = f"{h} hrs {m} mins"
        record["adminRemarks"] = "Auto-checked out at 06:00 PM (Shift End)"
        record["status"] = initial_status
        record["updatedAt"] = now_utc.isoformat() + "Z"

        db.save_attendance(record)
        return record
    @staticmethod
    def process_check_in(
        user: dict,
        site_id: str,
        latitude: float,
        longitude: float,
        accuracy: float,
        remarks: Optional[str] = None,
        photo_url: Optional[str] = None
    ) -> dict:
        emp_id = user["id"]
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        
        # 1. Validate employee
        employee = db.get_employee(emp_id)
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        # 2. Check if technician has already checked in today (re-check in not allowed)
        existing = db.get_today_attendance(emp_id, today_str)
        if existing and existing.get("checkIn"):
            if not existing.get("checkOut"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You are already checked in for today. Active shift is currently in progress."
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You have already completed your shift check-in for today. Re-check in is not allowed."
                )

        # 4. Photo is optional for field technicians (face photo is not compulsory)
        # photo_url is optional and may be None

        # 5. Validate Site
        site = db.get_site(site_id)
        if not site:
            raise HTTPException(status_code=404, detail="Assigned Substation not found")

        # 6. Validate GPS accuracy
        geofence_service.validate_gps_accuracy(accuracy)

        # 7. Server-side Geofence calculation
        is_inside, distance = geofence_service.verify_site_geofence(
            latitude, longitude,
            site["latitude"], site["longitude"],
            site.get("radiusMeters", 500.0)
        )

        is_privileged = user.get("role") in ["supervisor", "admin"]
        if not is_inside and not is_privileged:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Outside Substation Geofence. You are {distance:.1f} meters away from {site['name']} (allowed radius: {site.get('radiusMeters', 500)}m)."
            )

        # 8. Apply shift timing rules
        now = datetime.utcnow()
        initial_status = evaluate_check_in_punctuality(now)
        time_ist = format_datetime_ist(now)

        # 9. Compulsory check-in photo enforcement for technician
        clean_photo_url = photo_url.strip() if photo_url and photo_url.strip() else None
        if not clean_photo_url and user.get("role", "technician").lower() == "technician":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Check-in photo is compulsory. Please take and upload a photo to check in."
            )

        # Auto-process and persist Base64 photos if not already stored on disk
        photo_path = None
        if clean_photo_url and clean_photo_url.startswith("data:"):
            try:
                from app.services.storage_service import storage_service
                saved = storage_service.save_base64_photo(clean_photo_url, subfolder="selfie")
                clean_photo_url = saved.get("photoUrl") or clean_photo_url
                photo_path = saved.get("photoPath")
            except Exception as e:
                logger.warning(f"Auto-process base64 photo notice: {e}")

        # 10. Create attendance record
        record_id = f"att_{uuid.uuid4().hex[:12]}"
        record = {
            "_id": record_id,
            "id": record_id,
            "employeeId": emp_id,
            "employeeName": employee.get("name"),
            "siteId": site_id,
            "siteName": site.get("name"),
            "date": today_str,
            "photoUrl": clean_photo_url,
            "photoPath": photo_path,
            "checkIn": {
                "time": now.isoformat() + "Z",
                "timeIST": time_ist,
                "latitude": latitude,
                "longitude": longitude,
                "accuracy": accuracy,
                "distanceMeters": distance,
                "photoUrl": clean_photo_url,
                "remarks": remarks or ""
            },
            "checkOut": None,
            "status": initial_status,
            "workingMinutes": 0,
            "workingHoursFormatted": "0 hrs 0 mins",
            "createdAt": now.isoformat() + "Z",
            "updatedAt": now.isoformat() + "Z"
        }

        db.save_attendance(record)
        return record

    @staticmethod
    def process_check_out(
        user: dict,
        latitude: float,
        longitude: float,
        accuracy: float,
        remarks: Optional[str] = None,
        force_override: bool = False
    ) -> dict:
        emp_id = user["id"]
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        
        record = db.get_today_attendance(emp_id, today_str)
        if not record or not record.get("checkIn"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active check-in found for today. Cannot check out."
            )

        if record.get("checkOut"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Shift already concluded for today."
            )

        now = datetime.utcnow()
        user_role = user.get("role", "").lower()
        
        # Check early departure rule (Technician cannot checkout before 18:00 unless supervisor or override)
        if is_early_departure(now) and user_role == "technician" and not force_override:
            # We allow checkout with warning/authorization
            pass

        check_in_time_str = record["checkIn"]["time"].replace("Z", "")
        check_in_dt = datetime.fromisoformat(check_in_time_str)

        hours, minutes, final_status = calculate_working_hours_status(
            check_in_dt, now, record.get("status", "present")
        )

        record["checkOut"] = {
            "time": now.isoformat() + "Z",
            "timeIST": format_datetime_ist(now),
            "latitude": latitude,
            "longitude": longitude,
            "accuracy": accuracy,
            "remarks": remarks or ""
        }
        record["workingMinutes"] = minutes
        h = minutes // 60
        m = minutes % 60
        record["workingHoursFormatted"] = f"{h} hrs {m} mins"
        record["status"] = final_status
        record["updatedAt"] = now.isoformat() + "Z"

        db.save_attendance(record)
        return record

attendance_service = AttendanceService()
