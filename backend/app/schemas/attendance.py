from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class CheckInRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: float
    remarks: Optional[str] = None
    photoUrl: Optional[str] = None
    siteId: Optional[str] = None

class CheckOutRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: float
    remarks: Optional[str] = None
    photoUrl: Optional[str] = None

class AttendancePunchRecord(BaseModel):
    time: str
    timeIST: str
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
    photoUrl: Optional[str] = None
    checkIn: Optional[AttendancePunchRecord] = None
    checkOut: Optional[AttendancePunchRecord] = None
    status: str  # present, late, half_day, absent, weekly_off
    isHalfDay: Optional[bool] = False
    attendanceCategory: Optional[str] = None
    workingMinutes: int
    workingHoursFormatted: Optional[str] = None
    adminRemarks: Optional[str] = None

class AdjustAttendanceRequest(BaseModel):
    recordId: Optional[str] = None
    employeeId: str
    date: str
    status: str
    isHalfDay: Optional[bool] = None
    attendanceCategory: Optional[str] = None
    siteName: Optional[str] = None
    checkInTime: Optional[str] = None
    checkOutTime: Optional[str] = None
    duration: Optional[str] = None
    adminRemarks: Optional[str] = None

class MarkAttendanceRequest(BaseModel):
    employeeId: str
    date: str
    status: str = "P"
    isHalfDay: Optional[bool] = None
    attendanceCategory: Optional[str] = None
    adminRemarks: Optional[str] = None
