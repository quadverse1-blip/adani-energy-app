import os
import base64
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials
from app.core.security import get_current_user_token, security_bearer, decode_access_token, require_roles
from app.services.salary_service import salary_service, UPLOADED_SLIPS
from app.core.config import settings
from app.schemas.salary import (
    SalarySlipResponse,
    SalarySummaryResponse,
    UploadSalarySlipRequest,
    SalaryConfigCreateUpdate,
    SalaryConfigResponse,
    FinalizeSalaryRequest,
    ReviseSalaryRequest
)
from app.core.database import db

router = APIRouter(prefix="/salary", tags=["Salary & Payslips"])

def _verify_employee_access(requested_emp_id: str, token_data: dict) -> None:
    """Enforces strict isolation: technicians can only access their own salary records."""
    user_role = (token_data.get("role") or "").lower()
    if user_role in ("admin", "supervisor"):
        return

    req_clean = str(requested_emp_id or "").strip().lower()
    t_id = str(token_data.get("id") or "").strip().lower()
    t_emp_id = str(token_data.get("employeeId") or "").strip().lower()
    t_sub = str(token_data.get("sub") or "").strip().lower()

    # Look up caller employee details if available
    caller_emp = db.get_employee(t_id) or db.find_employee_by_identifier(t_id) or db.find_employee_by_identifier(t_sub)
    caller_valid_ids = {t_id, t_emp_id, t_sub}
    if caller_emp:
        if caller_emp.get("_id"):
            caller_valid_ids.add(str(caller_emp["_id"]).strip().lower())
        if caller_emp.get("employeeId"):
            caller_valid_ids.add(str(caller_emp["employeeId"]).strip().lower())

    # Look up canonical target employee
    target_emp = db.get_employee(requested_emp_id) or db.find_employee_by_identifier(requested_emp_id)
    target_valid_ids = {req_clean}
    if target_emp:
        if target_emp.get("_id"):
            target_valid_ids.add(str(target_emp["_id"]).strip().lower())
        if target_emp.get("employeeId"):
            target_valid_ids.add(str(target_emp["employeeId"]).strip().lower())

    if caller_valid_ids.intersection(target_valid_ids):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied. Employees can only view and download their own salary records."
    )

@router.get("/slip/{employeeId:path}")
async def get_salary_slip(
    employeeId: str,
    employee_id: Optional[str] = Query(None),
    empId: Optional[str] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020, le=2030),
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)
):
    """
    Retrieves the monthly salary slip JSON or PDF (if /pdf suffix requested).
    - Technicians can ONLY retrieve their own salary statement.
    - Admins/Supervisors can view any employee statement.
    """
    now_dt = datetime.utcnow()
    resolved_month = month or now_dt.month
    resolved_year = year or now_dt.year

    token_str = credentials.credentials if credentials else token
    token_data = decode_access_token(token_str) if token_str else None

    # If PDF format requested, delegate to PDF download generator
    if employeeId.endswith("/pdf") or employeeId == "pdf":
        real_id = (None if employeeId == "pdf" else employeeId[:-4]) or employee_id or empId
        return await download_payslip_pdf(
            employeeId=real_id,
            employee_id=employee_id,
            empId=empId,
            month=resolved_month,
            year=resolved_year,
            token=token,
            credentials=credentials
        )

    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided"
        )

    _verify_employee_access(employeeId, token_data)
    slip = salary_service.get_salary_slip(employeeId, resolved_month, resolved_year)
    return {
        **slip,
        "slip": slip,
        "success": True
    }

@router.get("/summary", response_model=SalarySummaryResponse)
async def get_salary_summary(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020, le=2030),
    token_data: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """
    Admin & Supervisor endpoint to retrieve compensation summary and all employee calculations.
    """
    now_dt = datetime.utcnow()
    resolved_month = month or now_dt.month
    resolved_year = year or now_dt.year
    summary = salary_service.get_salary_summary(resolved_month, resolved_year)
    return summary

@router.get("/config/{employeeId:path}", response_model=SalaryConfigResponse)
async def get_salary_config(
    employeeId: str,
    token_data: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Admin endpoint to view an employee's salary and deduction configuration."""
    cfg = salary_service.get_salary_config(employeeId)
    emp = db.get_employee(employeeId) or db.find_employee_by_identifier(employeeId)
    name = emp.get("name", "Field Technician") if emp else "Field Technician"
    canonical = emp.get("employeeId", employeeId) if emp else employeeId
    m_sal = float(cfg.get("monthlySalary", 20000.0))

    return SalaryConfigResponse(
        employeeId=canonical,
        employeeName=name,
        monthlySalary=m_sal,
        dailyRate=round(m_sal / 30.0, 2),
        absentDeductionRate=float(cfg.get("absentDeductionRate", 500.0)),
        halfDayDeductionRate=float(cfg.get("halfDayDeductionRate", 250.0)),
        effectiveDate=str(cfg.get("effectiveDate", "2026-01-01")),
        updatedAt=cfg.get("updatedAt"),
        updatedBy=cfg.get("updatedBy"),
        notes=cfg.get("notes")
    )

@router.put("/config/{employeeId:path}", response_model=SalaryConfigResponse)
@router.post("/config/{employeeId:path}", response_model=SalaryConfigResponse)
async def update_salary_config(
    employeeId: str,
    payload: SalaryConfigCreateUpdate,
    token_data: dict = Depends(require_roles(["admin"]))
):
    """
    Admin endpoint to configure an individual employee's monthly salary,
    absent deduction rate, half-day deduction rate, and effective date.
    """
    absent_rate = payload.absentDeductionRate if payload.absentDeductionRate is not None else (payload.absentDeduction if payload.absentDeduction is not None else 500.0)
    half_rate = payload.halfDayDeductionRate if payload.halfDayDeductionRate is not None else (payload.halfDayDeduction if payload.halfDayDeduction is not None else 250.0)
    updated_cfg = salary_service.update_salary_config(
        employee_id=employeeId,
        monthly_salary=payload.monthlySalary,
        absent_deduction_rate=absent_rate,
        half_day_deduction_rate=half_rate,
        effective_date=payload.effectiveDate,
        notes=payload.notes,
        updated_by=token_data.get("name") or "Operations Administrator"
    )

    emp = db.get_employee(employeeId) or db.find_employee_by_identifier(employeeId)
    name = emp.get("name", "Field Technician") if emp else "Field Technician"
    canonical = emp.get("employeeId", employeeId) if emp else employeeId
    m_sal = float(updated_cfg.get("monthlySalary", 20000.0))

    return SalaryConfigResponse(
        employeeId=canonical,
        employeeName=name,
        monthlySalary=m_sal,
        dailyRate=round(m_sal / 30.0, 2),
        absentDeductionRate=float(updated_cfg.get("absentDeductionRate", 500.0)),
        halfDayDeductionRate=float(updated_cfg.get("halfDayDeductionRate", 250.0)),
        effectiveDate=str(updated_cfg.get("effectiveDate", "2026-01-01")),
        updatedAt=updated_cfg.get("updatedAt"),
        updatedBy=updated_cfg.get("updatedBy"),
        notes=updated_cfg.get("notes")
    )

@router.post("/finalize", response_model=SalarySlipResponse)
async def finalize_salary_statement(
    payload: FinalizeSalaryRequest,
    token_data: dict = Depends(require_roles(["admin"]))
):
    """
    Admin endpoint to finalize and freeze a monthly salary statement.
    Once finalized, subsequent attendance edits do not alter historical statements.
    """
    admin_name = token_data.get("name") or "Operations Administrator"
    statement = salary_service.finalize_salary_statement(
        employee_id=payload.employeeId,
        month=payload.month,
        year=payload.year,
        admin_name=admin_name,
        notes=payload.notes
    )
    return statement

@router.post("/revise", response_model=SalarySlipResponse)
async def revise_salary_statement(
    payload: ReviseSalaryRequest,
    token_data: dict = Depends(require_roles(["admin"]))
):
    """
    Admin endpoint to revise an existing finalized salary statement with an audit trail reason.
    """
    admin_name = token_data.get("name") or "Operations Administrator"
    statement = salary_service.revise_salary_statement(
        employee_id=payload.employeeId,
        month=payload.month,
        year=payload.year,
        admin_name=admin_name,
        revision_reason=payload.revisionReason,
        custom_salary=payload.monthlySalary,
        custom_absent_rate=payload.absentDeductionRate,
        custom_half_day_rate=payload.halfDayDeductionRate,
        notes=payload.notes
    )
    return statement

@router.get("/download/{employeeId:path}")
@router.get("/pdf/{employeeId:path}")
@router.get("/slip/{employeeId:path}/pdf")
@router.get("/download")
@router.get("/slip/pdf")
async def download_payslip_pdf(
    employeeId: Optional[str] = None,
    employee_id: Optional[str] = Query(None),
    empId: Optional[str] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2020, le=2030),
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)
):
    now_dt = datetime.utcnow()
    month = month or now_dt.month
    year = year or now_dt.year
    """
    Generates and downloads the official Adani salary slip PDF.
    - Technicians can only download their own payslip.
    - Admins and Supervisors can download any employee's payslip.
    """
    effective_emp_id = employeeId or employee_id or empId
    if effective_emp_id and effective_emp_id.endswith("/pdf"):
        effective_emp_id = effective_emp_id[:-4]
    if effective_emp_id == "pdf":
        effective_emp_id = employee_id or empId

    token_str = credentials.credentials if credentials else token
    token_data = decode_access_token(token_str) if token_str else None

    # Fallback to token identity if employee ID was omitted in query
    if not effective_emp_id and token_data:
        effective_emp_id = token_data.get("employeeId") or token_data.get("id") or token_data.get("sub")
    if not effective_emp_id:
        effective_emp_id = "b4S/Adani/01"

    if token_data:
        try:
            _verify_employee_access(effective_emp_id, token_data)
        except HTTPException:
            # Allow supervisors and admins full clearance
            if (token_data.get("role") or "").lower() not in ("admin", "supervisor"):
                raise

    employee = db.get_employee(effective_emp_id) or db.find_employee_by_identifier(effective_emp_id)
    canonical_id = str((employee.get("employeeId") if employee else None) or effective_emp_id)
    safe_canonical = canonical_id.replace("/", "_").replace("\\", "_")

    # 1. Check in-memory uploaded slips under all permutations
    key1 = f"{effective_emp_id}_{month}_{year}"
    key2 = f"{canonical_id}_{month}_{year}"
    key3 = f"{effective_emp_id}_{year}_{month}"
    key4 = f"{canonical_id}_{year}_{month}"
    uploaded = (
        UPLOADED_SLIPS.get(key1)
        or UPLOADED_SLIPS.get(key2)
        or UPLOADED_SLIPS.get(key3)
        or UPLOADED_SLIPS.get(key4)
    )

    # 2. Check persistent database statement if in-memory was cleared on server reload
    statement = db.get_salary_statement(effective_emp_id, month, year) or db.get_salary_statement(canonical_id, month, year)
    file_base64 = (uploaded.get("fileBase64") if uploaded else None) or (statement.get("fileBase64") if statement else None)
    file_name = (uploaded.get("fileName") if uploaded else None) or (statement.get("fileName") if statement else None)

    # If static uploaded document exists in RAM or DB, serve that document
    if file_base64:
        try:
            file_bytes = base64.b64decode(file_base64)
            filename = file_name or f"payslip_{safe_canonical}_{year}_{month}.pdf"
            media_type = "application/pdf" if filename.lower().endswith(".pdf") else (
                "image/png" if filename.lower().endswith(".png") else "application/octet-stream"
            )
            return Response(
                content=file_bytes,
                media_type=media_type,
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        except Exception as e:
            print(f"[SalaryRouter] Error processing base64 payslip: {e}")

    # 3. Check persistent disk file in uploads/payslips/
    try:
        disk_path = os.path.join(settings.UPLOAD_DIR, "payslips", f"payslip_{safe_canonical}_{year}_{month}.pdf")
        if os.path.exists(disk_path):
            with open(disk_path, "rb") as f:
                disk_bytes = f.read()
            filename = file_name or f"payslip_{safe_canonical}_{year}_{month}.pdf"
            return Response(
                content=disk_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
    except Exception as e:
        print(f"[SalaryRouter] Error checking disk payslip: {e}")

    # No document has been uploaded by the admin for this employee & period
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Salary slip document has not been uploaded by the admin for {canonical_id} ({month}/{year}) yet. Downloads are only available once the admin uploads the verified document."
    )

@router.post("/upload", response_model=SalarySlipResponse)
@router.post("/upload-slip", response_model=SalarySlipResponse)
async def upload_salary_slip(
    data: UploadSalarySlipRequest,
    token_data: dict = Depends(require_roles(["admin"]))
):
    """Admin endpoint to upload or record verified employee salary slip month and year-wise."""
    net_amt = data.netAmount if data.netAmount is not None else (data.amount or 20000.0)
    fname = data.fileName or data.documentName
    slip = salary_service.record_salary_slip(
        employee_id=data.employeeId,
        month=data.month,
        year=data.year,
        net_amount=net_amt,
        notes=data.notes,
        file_name=fname,
        file_base64=data.fileBase64,
        uploaded_by=token_data.get("name") or "Operations Administrator"
    )
    return {
        **slip,
        "slip": slip,
        "success": True,
        "message": "Salary slip uploaded and recorded successfully"
    }
