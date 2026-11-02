from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class EmployeeCreate(BaseModel):
    name: str
    employeeId: str
    phone: str
    password: str
    role: str = "technician"  # technician, supervisor, admin
    designation: str = "Field Technician"
    assignedSiteIds: List[str] = []
    email: Optional[str] = None
    department: Optional[str] = "Smart Meter Operations"
    circle: Optional[str] = None
    division: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locationName: Optional[str] = None
    status: Optional[str] = "active"
    shiftStatus: Optional[str] = "present"

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    designation: Optional[str] = None
    assignedSiteIds: Optional[List[str]] = None
    assignedSiteId: Optional[str] = None
    status: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    circle: Optional[str] = None
    division: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locationName: Optional[str] = None
    shiftStatus: Optional[str] = None

class EmployeeResponse(BaseModel):
    id: str
    employeeId: str
    name: str
    phone: str
    role: str
    designation: str
    assignedSiteIds: List[str] = []
    assignedSiteId: Optional[str] = None
    status: str
    email: Optional[str] = None
    department: Optional[str] = None
    avatar: Optional[str] = None
    circle: Optional[str] = None
    division: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locationName: Optional[str] = None
    shiftStatus: Optional[str] = "present"

class BulkEmployeeItem(BaseModel):
    employeeId: str
    phone: str
    password: str
    name: Optional[str] = None
    role: Optional[str] = "technician"
    designation: Optional[str] = "Field Smart Meter Technician"
    assignedSiteIds: Optional[List[str]] = []
    assignedSiteId: Optional[str] = None
    email: Optional[str] = None
    circle: Optional[str] = None
    division: Optional[str] = None
    department: Optional[str] = "Smart Meter Operations"

class BulkUploadResponse(BaseModel):
    success: bool
    totalRows: int
    addedCount: int
    updatedCount: int
    errorCount: int
    errors: List[str] = []
    message: str
    employees: List[Dict[str, Any]] = []
