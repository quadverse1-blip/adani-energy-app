from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

class ManagerInfo(BaseModel):
    name: str
    phone: str
    email: str
    designation: Optional[str] = "Site Manager"
    photoUrl: Optional[str] = None
    avatar: Optional[str] = None

class SiteCreate(BaseModel):
    name: str
    code: str
    address: str
    latitude: float
    longitude: float
    radiusMeters: float = 500.0
    voltageClass: Optional[str] = "220 kV GIS"
    manager: ManagerInfo
    photoUrl: Optional[str] = None
    workingHours: Optional[str] = "09:00 AM - 06:00 PM"
    status: Optional[str] = "active"

class SiteUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radiusMeters: Optional[float] = None
    voltageClass: Optional[str] = None
    manager: Optional[ManagerInfo] = None
    photoUrl: Optional[str] = None
    workingHours: Optional[str] = None
    status: Optional[str] = None

class SiteResponse(BaseModel):
    id: str
    name: str
    code: str
    address: str
    latitude: float
    longitude: float
    radiusMeters: float
    voltageClass: Optional[str] = "220 kV GIS"
    manager: ManagerInfo
    photoUrl: Optional[str] = None
    activeEngineersCount: Optional[int] = 0
    workingHours: Optional[str] = "09:00 AM - 06:00 PM"
    status: str = "active"
