from pydantic import BaseModel, Field
from typing import Optional

class LoginRequest(BaseModel):
    username: str = Field(..., description="Employee ID, Phone, or Email")
    password: str = Field(...)

class UserProfile(BaseModel):
    id: str
    employeeId: str
    name: str
    role: str
    designation: str
    assignedSiteId: Optional[str] = None
    assignedSiteIds: Optional[list[str]] = []
    phone: Optional[str] = None
    email: Optional[str] = None
    avatar: Optional[str] = None
    department: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile

class ForgotPasswordRequest(BaseModel):
    employeeId: str

class ResetPasswordRequest(BaseModel):
    employeeId: str
    newPassword: str
