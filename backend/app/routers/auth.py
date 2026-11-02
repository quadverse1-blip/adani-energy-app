from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user_token
)
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    UserProfile,
    ForgotPasswordRequest,
    VerifyOTPRequest,
    ResetPasswordRequest
)
from app.services.otp_service import otp_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    user = db.find_employee_by_identifier(credentials.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Employee ID, Phone Number or Password"
        )

    # Check password
    if not verify_password(credentials.password, user.get("password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Employee ID, Phone Number or Password"
        )

    if user.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is currently inactive. Please contact Operations Administrator."
        )

    primary_site = user.get("assignedSiteId") or (user.get("assignedSiteIds", [None])[0] if user.get("assignedSiteIds") else None)
    site_ids = user.get("assignedSiteIds") or []
    if primary_site and primary_site not in site_ids:
        site_ids = [primary_site] + site_ids

    token_data = {
        "id": user["_id"],
        "employeeId": user.get("employeeId"),
        "name": user.get("name"),
        "role": user.get("role", "technician"),
        "designation": user.get("designation"),
        "assignedSiteId": primary_site
    }

    access_token = create_access_token(token_data)

    user_profile = UserProfile(
        id=user["_id"],
        employeeId=user.get("employeeId", ""),
        name=user.get("name", ""),
        role=user.get("role", "technician"),
        designation=user.get("designation", ""),
        assignedSiteId=primary_site,
        assignedSiteIds=site_ids,
        phone=user.get("phone"),
        email=user.get("email"),
        avatar=user.get("avatar"),
        department=user.get("department")
    )

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_profile
    )

@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(token_data: dict = Depends(get_current_user_token)):
    user = db.get_employee(token_data["id"]) or db.find_employee_by_identifier(token_data["id"])
    if not user and token_data.get("employeeId"):
        user = db.get_employee(token_data["employeeId"]) or db.find_employee_by_identifier(token_data["employeeId"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    primary_site = user.get("assignedSiteId") or (user.get("assignedSiteIds", [None])[0] if user.get("assignedSiteIds") else None)
    site_ids = user.get("assignedSiteIds") or []
    if primary_site and primary_site not in site_ids:
        site_ids = [primary_site] + site_ids

    return UserProfile(
        id=user["_id"],
        employeeId=user.get("employeeId", ""),
        name=user.get("name", ""),
        role=user.get("role", "technician"),
        designation=user.get("designation", ""),
        assignedSiteId=primary_site,
        assignedSiteIds=site_ids,
        phone=user.get("phone"),
        email=user.get("email"),
        avatar=user.get("avatar"),
        department=user.get("department")
    )

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    identifier = req.identifier or req.employeeId
    if not identifier:
        raise HTTPException(status_code=400, detail="Employee ID, Phone, or Email is required.")
    return otp_service.request_otp(identifier, override_email=req.email)

@router.post("/verify-otp")
async def verify_otp(req: VerifyOTPRequest):
    identifier = req.identifier or req.employeeId
    if not identifier:
        raise HTTPException(status_code=400, detail="Employee ID, Phone, or Email is required.")
    return otp_service.verify_otp(identifier, req.otp)

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    identifier = req.identifier or req.employeeId
    if not identifier:
        raise HTTPException(status_code=400, detail="Employee ID, Phone, or Email is required.")
    return otp_service.reset_password(identifier, req.otp, req.newPassword)
