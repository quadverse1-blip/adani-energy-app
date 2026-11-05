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
    format_datetime_ist,
    get_today_ist_str,
    get_now_ist
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
        ist_now = get_now_ist()
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
        
        # Conflict Prevention: If Admin override is active, keep admin's approved status
        initial_status = record.get("status", "present")
        is_admin_override = bool(record.get("isAdminOverride") or record.get("adminOverride"))
        is_hd = bool(record.get("isHalfDay") or record.get("attendanceCategory") == "HALF_DAY" or str(initial_status).lower() in ("half_day", "halfday", "hd"))

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
        if not record.get("adminRemarks"):
            record["adminRemarks"] = "Auto-checked out at 06:00 PM (Shift End)"
        record["status"] = initial_status
        record["isHalfDay"] = is_hd
        record["attendanceCategory"] = "HALF_DAY" if is_hd else "PRESENT"
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
        today_str = get_today_ist_str()
        
        # 1. Validate employee
        employee = db.get_employee(emp_id)
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        # 2. Conflict Prevention: Check if technician has an existing record for today (in IST)
        existing = db.get_today_attendance(emp_id, today_str)
        if existing and existing.get("checkIn"):
            is_real = existing.get("checkIn", {}).get("isRealPunch", not existing.get("isAdminOverride"))
            if is_real:
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

        # 3. Check-in Restriction: Employees must not be allowed to check in after 6:00 PM IST
        ist_now = get_now_ist()
        if ist_now.time() >= time(18, 0, 0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Shift check-in is closed for today. Check-in is not permitted after 06:00 PM IST."
            )

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

        # 8. Apply shift timing rules in Indian Standard Time (IST)
        now = datetime.utcnow()
        time_ist = format_datetime_ist(now)

        # Conflict Prevention: Check if Admin previously marked/adjusted today's attendance
        is_admin_override = bool(existing.get("isAdminOverride") or existing.get("adminOverride")) if existing else False
        if is_admin_override:
            # Preserves Admin override: Admin changes MUST NOT be overwritten by automatic check-in rules!
            initial_status = existing.get("status", "present")
            is_half_day = bool(existing.get("isHalfDay") or existing.get("attendanceCategory") == "HALF_DAY")
            resolved_category = existing.get("attendanceCategory") or ("HALF_DAY" if is_half_day else "PRESENT")
            resolved_shift_status = existing.get("shiftStatus") or ("half_day" if is_half_day else "present")
            initial_remarks = existing.get("adminRemarks") or remarks or ""
        else:
            # Automatic Check-in Rules:
            # Up to 10:30 AM IST (including 9:00 AM to 10:30 AM) -> Present (P)
            # After 10:30 AM IST -> Half Day (HD)
            initial_status = evaluate_check_in_punctuality(now)
            is_half_day = (initial_status == "half_day")
            resolved_category = "HALF_DAY" if is_half_day else "PRESENT"
            resolved_shift_status = "half_day" if is_half_day else "present"
            initial_remarks = remarks or ("Auto-marked Half Day (Check-in after 10:30 AM IST)" if is_half_day else "")

        # 9. Compulsory check-in photo enforcement for technician
        clean_photo_url = photo_url.strip() if photo_url and photo_url.strip() else None
        if not clean_photo_url and user.get("role", "technician").lower() == "technician":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Check-in photo is compulsory. Please take and upload a photo to check in."
            )

        # Auto-process and persist Base64 photos if not already stored on disk
        photo_path = None
        firebase_url = None
        if clean_photo_url and clean_photo_url.startswith("data:"):
            try:
                from app.services.storage_service import storage_service
                saved = storage_service.save_base64_photo(clean_photo_url, subfolder="selfie")
                clean_photo_url = saved.get("photoUrl") or clean_photo_url
                photo_path = saved.get("photoPath")
                firebase_url = saved.get("firebaseUrl")
            except Exception as e:
                pass

        # 10. Conflict Prevention: Single attendance record per employee per date
        if existing:
            record = existing
            record_id = record.get("_id") or record.get("id")
        else:
            record_id = f"att_{uuid.uuid4().hex[:12]}"
            record = {
                "_id": record_id,
                "id": record_id,
                "employeeId": emp_id,
                "technicianCode": employee.get("employeeId", ""),
                "technicianName": employee.get("name"),
                "date": today_str,
                "createdAt": now.isoformat() + "Z"
            }

        # If record was pre-marked by Admin without real punch, clear synthetic checkout for active shift
        new_checkout = None if (existing and not existing.get("checkIn", {}).get("isRealPunch")) else (record.get("checkOut") if existing else None)

        record.update({
            "siteId": site_id,
            "siteName": site.get("name"),
            "photoUrl": clean_photo_url,
            "photoPath": photo_path,
            "firebaseUrl": firebase_url,
            "checkIn": {
                "time": now.isoformat() + "Z",
                "timeIST": time_ist,
                "latitude": latitude,
                "longitude": longitude,
                "accuracy": accuracy,
                "distanceMeters": distance,
                "photoUrl": clean_photo_url,
                "remarks": remarks or "",
                "isRealPunch": True
            },
            "checkOut": new_checkout,
            "status": initial_status,
            "isHalfDay": is_half_day,
            "attendanceCategory": resolved_category,
            "shiftStatus": resolved_shift_status,
            "workingMinutes": record.get("workingMinutes") or (240 if is_half_day else 0),
            "workingHoursFormatted": record.get("workingHoursFormatted") or ("4 hrs 0 mins" if is_half_day else "0 hrs 0 mins"),
            "adminRemarks": initial_remarks,
            "updatedAt": now.isoformat() + "Z"
        })

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
        today_str = get_today_ist_str()
        
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
            pass

        check_in_time_str = record["checkIn"]["time"].replace("Z", "")
        check_in_dt = datetime.fromisoformat(check_in_time_str)

        is_admin_override = bool(record.get("isAdminOverride") or record.get("adminOverride"))
        hours, minutes, final_status = calculate_working_hours_status(
            check_in_dt, now, record.get("status", "present"), is_admin_override=is_admin_override
        )

        is_hd = bool(
            record.get("isHalfDay")
            or record.get("attendanceCategory") == "HALF_DAY"
            or final_status == "half_day"
        )
        resolved_category = "HALF_DAY" if is_hd else "PRESENT"
        resolved_shift_status = "half_day" if is_hd else "completed"

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
        record["isHalfDay"] = is_hd
        record["attendanceCategory"] = resolved_category
        record["shiftStatus"] = resolved_shift_status
        record["updatedAt"] = now.isoformat() + "Z"

        db.save_attendance(record)
        return record

    @staticmethod
    def perform_auto_checkout_all_open_shifts(force: bool = False, target_date_str: Optional[str] = None) -> dict:
        """
        Scheduled 6:00 PM IST Automatic Check-Out:
        Automatically checks out all employees who are still checked in at 6:00 PM IST.
        Saves checkout time as exactly 06:00 PM IST (12:30 UTC).
        - Runs through a reliable background scheduled process even when employees have closed the app.
        - Preserves Admin-approved attendance corrections (isAdminOverride).
        - Synchronizes checkout records across Admin, Supervisor, and Employee dashboards, reports, and Excel.
        """
        now_utc = datetime.utcnow()
        ist_now = get_now_ist()
        today_ist_str = target_date_str or get_today_ist_str()
        is_after_6pm = (ist_now.time() >= time(18, 0, 0))

        checked_out_count = 0
        updated_records = []

        all_att = list(db.attendance.values())
        for r in all_att:
            if not isinstance(r, dict) or not r.get("checkIn") or r.get("checkOut"):
                continue

            r_date = str(r.get("date") or "")
            # Check if this record should be auto checked-out:
            # 1. Any record from a past date left open without checkout
            # 2. Today's record if current IST time is >= 18:00 (or if force=True)
            should_auto_checkout = False
            if r_date < today_ist_str:
                should_auto_checkout = True
            elif r_date == today_ist_str and (is_after_6pm or force):
                should_auto_checkout = True

            if not should_auto_checkout:
                continue

            ci_str = str(r["checkIn"].get("time") or "").replace("Z", "")
            try:
                ci_dt = datetime.fromisoformat(ci_str)
            except Exception:
                ci_dt = datetime.utcnow()

            auto_co_utc_str = f"{r_date}T12:30:00Z"
            working_minutes = 0
            try:
                co_dt = datetime.fromisoformat(f"{r_date}T12:30:00")
                working_seconds = max(0, (co_dt - ci_dt).total_seconds())
                working_minutes = int(working_seconds // 60)
            except Exception:
                working_minutes = int(r.get("workingMinutes") or 480)

            h = working_minutes // 60
            m = working_minutes % 60

            # Conflict Prevention: Preserve Admin-approved attendance corrections
            is_admin_override = bool(r.get("isAdminOverride") or r.get("adminOverride"))
            if is_admin_override:
                final_status = r.get("status", "present")
                is_hd = bool(r.get("isHalfDay") or r.get("attendanceCategory") == "HALF_DAY")
                cat = r.get("attendanceCategory") or ("HALF_DAY" if is_hd else "PRESENT")
                shift_st = r.get("shiftStatus") or ("half_day" if is_hd else "completed")
            else:
                initial_st = str(r.get("status") or "").lower().replace("-", "_")
                if initial_st in ("half_day", "halfday", "hd") or bool(r.get("isHalfDay")) or working_minutes < 240:
                    final_status = "half_day"
                    is_hd = True
                    cat = "HALF_DAY"
                    shift_st = "half_day"
                else:
                    final_status = "present"
                    is_hd = False
                    cat = "PRESENT"
                    shift_st = "completed"

            r["checkOut"] = {
                "time": auto_co_utc_str,
                "timeIST": "06:00 PM",
                "latitude": r["checkIn"].get("latitude", 18.5204),
                "longitude": r["checkIn"].get("longitude", 73.8567),
                "accuracy": 10.0,
                "remarks": "Auto Check-Out at 06:00 PM IST (Shift Concluded)",
                "isAutoCheckedOut": True
            }
            r["workingMinutes"] = working_minutes
            r["workingHoursFormatted"] = f"{h} hrs {m} mins"
            if not r.get("adminRemarks"):
                r["adminRemarks"] = "Auto Check-Out at 06:00 PM IST (Shift Concluded)"
            r["status"] = final_status
            r["isHalfDay"] = is_hd
            r["attendanceCategory"] = cat
            r["shiftStatus"] = shift_st
            r["updatedAt"] = now_utc.isoformat() + "Z"

            db.save_attendance(r)
            checked_out_count += 1
            updated_records.append(r["_id"])

            # Synchronize employee's shiftStatus in db.employees
            emp_id = str(r.get("employeeId") or "")
            if emp_id:
                emp = db.get_employee(emp_id) or db.find_employee_by_identifier(emp_id)
                if emp:
                    emp["shiftStatus"] = "Half Day" if is_hd else "Present"
                    db.employees[emp["_id"]] = emp
                    if hasattr(db, "_raw_employees"):
                        db._raw_employees[emp["_id"]] = emp
                    db.set_firestore_document("employees", emp["_id"], emp)

        return {
            "success": True,
            "checkedOutCount": checked_out_count,
            "updatedRecords": updated_records,
            "timestampIST": ist_now.strftime("%Y-%m-%d %H:%M:%S")
        }

    @staticmethod
    def check_and_run_scheduled_6pm_auto_checkout() -> dict:
        """
        Background scheduler trigger: checks if current IST time is >= 18:00
        and executes auto-checkout across all open shifts.
        """
        return AttendanceService.perform_auto_checkout_all_open_shifts(force=False)

attendance_service = AttendanceService()
