from datetime import datetime, time, timedelta
from typing import Tuple, Optional

def parse_time_str(time_str: str) -> time:
    parts = [int(p) for p in time_str.split(":")]
    return time(hour=parts[0], minute=parts[1])

def evaluate_check_in_punctuality(check_in_dt: datetime) -> str:
    """
    Workforce Timing Rules (Applies to both Employee and Supervisor in IST):
    - Check-in up to 10:30 AM IST (including 09:00 AM to 10:30 AM) -> Present ('present' / P)
    - Check-in after 10:30 AM IST -> Half Day ('half_day' / HD)
    """
    # Convert UTC to Indian Standard Time (UTC+5:30)
    ist_dt = check_in_dt + timedelta(hours=5, minutes=30)
    current_time = ist_dt.time()
    
    if current_time <= time(10, 30, 0):
        return "present"
    else:
        return "half_day"

def format_datetime_ist(dt: datetime) -> str:
    """Format UTC datetime into 12-hour IST string like '10:55 AM'"""
    ist_dt = dt + timedelta(hours=5, minutes=30)
    hour = ist_dt.hour % 12 or 12
    minute = ist_dt.minute
    ampm = "PM" if ist_dt.hour >= 12 else "AM"
    return f"{hour}:{minute:02d} {ampm}"

def is_early_departure(checkout_dt: datetime) -> bool:
    """
    Shift scheduled until 06:00 PM (18:00 IST).
    Before 18:00 IST is an early departure.
    """
    ist_dt = checkout_dt + timedelta(hours=5, minutes=30)
    end_time = time(18, 0, 0)
    return ist_dt.time() < end_time

def is_past_shift_end_auto_checkout(dt: Optional[datetime] = None) -> bool:
    """
    Returns True if current IST time is at or after 06:00 PM (18:00:00).
    """
    now = dt or datetime.utcnow()
    ist_dt = now + timedelta(hours=5, minutes=30)
    return ist_dt.time() >= time(18, 0, 0)

def calculate_working_hours_status(
    check_in_dt: datetime,
    checkout_dt: datetime,
    initial_status: str,
    is_admin_override: bool = False
) -> Tuple[float, int, str]:
    """
    Calculate duration in hours, minutes, and final attendance status.
    - If admin override is active, the admin's approved status is strictly preserved.
    - If initial check-in was 'half_day' (after 10:30 AM), final status remains 'half_day'.
    - If total_hours >= 4.0 and initial was 'present': 'present'.
    - If total_hours < 4.0: marked as 'half_day'.
    """
    duration = checkout_dt - check_in_dt
    total_seconds = max(0, duration.total_seconds())
    if total_seconds >= 15:
        total_minutes = max(1, int(round(total_seconds / 60.0)))
    else:
        total_minutes = int(total_seconds // 60)
    total_hours = round(total_seconds / 3600.0, 2)
    
    clean_initial = (initial_status or "").lower().replace("-", "_").strip()

    if is_admin_override:
        return total_hours, total_minutes, clean_initial
    
    if clean_initial in ("half_day", "halfday", "hd"):
        final_status = "half_day"
    elif total_hours >= 4.0:
        final_status = "present"
    else:
        final_status = "half_day"
        
    return total_hours, total_minutes, final_status

def get_now_ist() -> datetime:
    """Returns the current datetime in Indian Standard Time (UTC+5:30)."""
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

def get_today_ist_str() -> str:
    """Returns today's date formatted as YYYY-MM-DD in IST."""
    return get_now_ist().strftime("%Y-%m-%d")

def is_in_photo_cleanup_window_ist(
    dt: Optional[datetime] = None,
    start_hour: int = 8,
    end_hour: int = 9
) -> bool:
    """
    Returns True if current IST time is between 8:00 AM and 9:00 AM (08:00 to 09:00).
    """
    ist_dt = (dt or datetime.utcnow()) + timedelta(hours=5, minutes=30)
    current_time = ist_dt.time()
    return time(start_hour, 0, 0) <= current_time < time(end_hour, 0, 0)

