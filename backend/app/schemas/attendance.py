from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class CheckInRequest(BaseModel):
    siteId: str
    latitude: float
    longitude: float
    accuracy: float
    remarks: Optional[str] = None
    photoUrl: Optional[str] = None

class CheckOutRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: float
    remarks: Optional[str] = None

class AttendancePunchRecord(BaseModel):
    time: str
    latitude: float
    longitude: float
    accuracy: float
    distanceMeters: Optional[float] = None
    photoUrl: Optional[str] = None
    remarks: Optional[str] = None

class AttendanceResponse(BaseModel):
    id: str
    employeeId: str
    siteId: str
    siteName: Optional[str] = None
    date: str
    checkIn: Optional[AttendancePunchRecord] = None
    checkOut: Optional[AttendancePunchRecord] = None
    status: str  # present, late, half_day, absent, weekly_off
    workingMinutes: int
    workingHoursFormatted: Optional[str] = None
    adminRemarks: Optional[str] = None

class AdjustAttendanceRequest(BaseModel):
    recordId: Optional[str] = None
    employeeId: str
    date: str
    status: str
    siteName: Optional[str] = None
    checkInTime: Optional[str] = None
    checkOutTime: Optional[str] = None
    duration: Optional[str] = None
    adminRemarks: Optional[str] = None

class MarkAttendanceRequest(BaseModel):
    employeeId: str
    date: str
    status: str = "P"
    adminRemarks: Optional[str] = None
