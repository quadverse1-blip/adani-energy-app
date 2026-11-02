from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

class ManagerInfo(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    designation: Optional[str] = "Site Manager"
    photoUrl: Optional[str] = None
    avatar: Optional[str] = None

class SiteCreate(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    latitude: float
    longitude: float
    radiusMeters: float = 500.0
    voltageClass: Optional[str] = None
    manager: Optional[ManagerInfo] = None
    photoUrl: Optional[str] = None
    workingHours: Optional[str] = None
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
    address: Optional[str] = None
    latitude: float
    longitude: float
    radiusMeters: float
    voltageClass: Optional[str] = None
    manager: Optional[ManagerInfo] = None
    photoUrl: Optional[str] = None
    activeEngineersCount: Optional[int] = 0
    workingHours: Optional[str] = None
    status: str = "active"
    assignedBy: Optional[str] = None
    assignedByPhone: Optional[str] = None
    assignedByRole: Optional[str] = None
    assignedAt: Optional[str] = None
