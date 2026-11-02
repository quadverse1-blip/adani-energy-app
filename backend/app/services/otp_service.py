import random
import secrets
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
from fastapi import HTTPException, status
from app.core.database import db
from app.core.config import settings
from app.core.security import get_password_hash
from app.services.email_service import send_otp_email

# In-memory OTP storage: identifier -> OTP metadata
_otp_store: Dict[str, Dict[str, Any]] = {}

def mask_email(email: str) -> str:
    """Masks an email for safe display (e.g. rohit.sharma@b4s.in -> r***a@b4s.in)"""
    if not email or "@" not in email:
        return email or ""
    parts = email.split("@")
    name = parts[0]
    domain = parts[1]
    if len(name) <= 2:
        masked_name = name[0] + "*"
    else:
        masked_name = name[0] + "***" + name[-1]
    return f"{masked_name}@{domain}"

class OTPService:
    def find_target_employee(self, identifier: str) -> Optional[dict]:
        """Finds employee by employeeId, phone, email, or _id"""
        clean_id = (identifier or "").strip()
        if not clean_id:
            return None
        
        # 1. Standard identifier search
        user = db.find_employee_by_identifier(clean_id)
        if user:
            return user
            
        # 2. Case-insensitive email or employee ID scan across database
        lower_id = clean_id.lower()
        for emp in db.employees.values():
            if not isinstance(emp, dict):
                continue
            if (emp.get("email") or "").lower() == lower_id:
                return emp
            if (emp.get("employeeId") or "").lower() == lower_id:
                return emp
            if (emp.get("_id") or "").lower() == lower_id:
                return emp
            if (emp.get("phone") or "").lower() == lower_id:
                return emp
        return None

    def request_otp(self, identifier: str, override_email: Optional[str] = None) -> dict:
        employee = self.find_target_employee(identifier)
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No employee record found for identifier '{identifier}'. Please check your Employee ID or Email."
            )

        # Determine target email
        target_email = ""
        if override_email and "@" in override_email and "." in override_email:
            target_email = override_email.strip().lower()
        elif employee.get("email") and "@" in employee["email"]:
            target_email = employee["email"].strip().lower()
        elif "@" in identifier and "." in identifier:
            target_email = identifier.strip().lower()
        else:
            target_email = "aeslbs8@gmail.com" # fallback to system notification inbox

        # Rate limiting: Max 1 request per 30 seconds
        emp_key = (employee.get("employeeId") or employee.get("_id") or identifier).lower()
        now = datetime.utcnow()
        if emp_key in _otp_store:
            last_sent = _otp_store[emp_key].get("created_at")
            if last_sent and (now - last_sent).total_seconds() < 25:
                wait_sec = int(25 - (now - last_sent).total_seconds())
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {wait_sec} seconds before requesting another verification code."
                )

        # Generate secure 6-digit OTP
        otp_code = str(secrets.randbelow(900000) + 100000)
        expiry_minutes = settings.OTP_EXPIRATION_MINUTES or 10
        expires_at = now + timedelta(minutes=expiry_minutes)

        # Send Email
        recipient_name = employee.get("name") or "Adani Field Engineer"
        email_sent = send_otp_email(
            to_email=target_email,
            recipient_name=recipient_name,
            otp_code=otp_code,
            expiration_minutes=expiry_minutes
        )

        if not email_sent:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to dispatch OTP email. Please verify network connectivity or contact system admin."
            )

        # Save to store
        _otp_store[emp_key] = {
            "otp": otp_code,
            "employeeId": employee.get("employeeId"),
            "userId": employee.get("_id"),
            "email": target_email,
            "expires_at": expires_at,
            "created_at": now,
            "attempts": 0,
            "verified": False
        }

        masked = mask_email(target_email)
        return {
            "success": True,
            "message": f"A 6-digit OTP has been dispatched to {masked}.",
            "email": masked,
            "targetEmail": target_email,
            "employeeId": employee.get("employeeId")
        }

    def verify_otp(self, identifier: str, otp: str) -> dict:
        employee = self.find_target_employee(identifier)
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee record not found."
            )

        emp_key = (employee.get("employeeId") or employee.get("_id") or identifier).lower()
        record = _otp_store.get(emp_key)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No pending OTP request found. Please request a new OTP first."
            )

        now = datetime.utcnow()
        if now > record["expires_at"]:
            _otp_store.pop(emp_key, None)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP has expired. Please request a new verification code."
            )

        if record["attempts"] >= 5:
            _otp_store.pop(emp_key, None)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum verification attempts exceeded. Please request a new OTP."
            )

        clean_otp = (otp or "").strip()
        if clean_otp != record["otp"]:
            record["attempts"] += 1
            remaining = 5 - record["attempts"]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid OTP code. {remaining} attempt(s) remaining."
            )

        record["verified"] = True
        return {
            "success": True,
            "message": "OTP verified successfully. You may now reset your password.",
            "employeeId": record["employeeId"]
        }

    def reset_password(self, identifier: str, otp: str, new_password: str) -> dict:
        if not new_password or len(new_password) < 4:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 4 characters long."
            )

        employee = self.find_target_employee(identifier)
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee record not found."
            )

        emp_key = (employee.get("employeeId") or employee.get("_id") or identifier).lower()
        record = _otp_store.get(emp_key)
        
        # Verify OTP if not already marked verified
        if not record or (record.get("otp") != otp.strip() and not record.get("verified")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP. Please verify OTP before resetting password."
            )

        now = datetime.utcnow()
        if now > record["expires_at"]:
            _otp_store.pop(emp_key, None)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP has expired. Please request a new OTP."
            )

        # Update password in in-memory cache and Firestore
        user_id = employee["_id"]
        employee["password"] = new_password
        
        # Save to database layer
        db.employees[user_id] = employee
        if hasattr(db, "_raw_employees") and user_id in db._raw_employees:
            db._raw_employees[user_id]["password"] = new_password

        # Clear OTP so it cannot be reused
        _otp_store.pop(emp_key, None)

        return {
            "success": True,
            "message": "Password updated successfully. You can now sign in with your new password.",
            "employeeId": employee.get("employeeId")
        }

otp_service = OTPService()

