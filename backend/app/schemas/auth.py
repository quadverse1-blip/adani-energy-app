from pydantic import BaseModel, Field, root_validator
from typing import Optional, List

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
    assignedSiteIds: Optional[List[str]] = []
    phone: Optional[str] = None
    email: Optional[str] = None
    avatar: Optional[str] = None
    department: Optional[str] = None
    circle: Optional[str] = None
    division: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locationName: Optional[str] = None
    assignedBy: Optional[str] = None
    assignedByPhone: Optional[str] = None
    assignedByRole: Optional[str] = None
    assignedAt: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile

class ForgotPasswordRequest(BaseModel):
    identifier: Optional[str] = Field(None, description="Employee ID, Phone, or Email")
    employeeId: Optional[str] = Field(None, description="Legacy parameter for Employee ID")
    email: Optional[str] = Field(None, description="Optional destination email")

    @root_validator(pre=True)
    def check_identifier(cls, values):
        if not values.get("identifier") and values.get("employeeId"):
            values["identifier"] = values.get("employeeId")
        return values

class VerifyOTPRequest(BaseModel):
    identifier: Optional[str] = Field(None, description="Employee ID, Phone, or Email")
    employeeId: Optional[str] = Field(None, description="Legacy parameter for Employee ID")
    otp: str = Field(..., description="6-digit OTP code")

    @root_validator(pre=True)
    def check_identifier(cls, values):
        if not values.get("identifier") and values.get("employeeId"):
            values["identifier"] = values.get("employeeId")
        return values

class ResetPasswordRequest(BaseModel):
    identifier: Optional[str] = Field(None, description="Employee ID, Phone, or Email")
    employeeId: Optional[str] = Field(None, description="Legacy parameter for Employee ID")
    otp: str = Field(..., description="6-digit OTP code")
    newPassword: str = Field(..., description="New account password")

    @root_validator(pre=True)
    def check_identifier(cls, values):
        if not values.get("identifier") and values.get("employeeId"):
            values["identifier"] = values.get("employeeId")
        return values
