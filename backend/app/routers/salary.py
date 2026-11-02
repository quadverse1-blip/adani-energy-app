import base64
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials
from app.core.security import get_current_user_token, security_bearer, decode_access_token, require_roles
from app.services.salary_service import salary_service, UPLOADED_SLIPS
from app.services.pdf_service import generate_salary_slip_pdf
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

    # Look up canonical target employee
    target_emp = db.get_employee(requested_emp_id) or db.find_employee_by_identifier(requested_emp_id)
    target_id = str(target_emp.get("_id") or "").strip().lower() if target_emp else req_clean
    target_emp_id = str(target_emp.get("employeeId") or "").strip().lower() if target_emp else req_clean

    if req_clean in (t_id, t_emp_id) or target_id in (t_id, t_emp_id) or target_emp_id in (t_id, t_emp_id):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied. Employees can only view and download their own salary records."
    )

@router.get("/slip/{employeeId:path}", response_model=SalarySlipResponse)
async def get_salary_slip(
    employeeId: str,
    month: int = Query(10, ge=1, le=12),
    year: int = Query(2026, ge=2020, le=2030),
    token_data: dict = Depends(get_current_user_token)
):
    """
    Retrieves the monthly salary slip.
    - Technicians can ONLY retrieve their own salary statement.
    - Admins/Supervisors can view any employee statement.
    """
    _verify_employee_access(employeeId, token_data)
    slip = salary_service.get_salary_slip(employeeId, month, year)
    return slip

@router.get("/summary", response_model=SalarySummaryResponse)
async def get_salary_summary(
    month: int = Query(10, ge=1, le=12),
    year: int = Query(2026, ge=2020, le=2030),
    token_data: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """
    Admin & Supervisor endpoint to retrieve compensation summary and all employee calculations.
    """
    summary = salary_service.get_salary_summary(month, year)
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
async def update_salary_config(
    employeeId: str,
    payload: SalaryConfigCreateUpdate,
    token_data: dict = Depends(require_roles(["admin"]))
):
    """
    Admin endpoint to configure an individual employee's monthly salary,
    absent deduction rate, half-day deduction rate, and effective date.
    """
    updated_cfg = salary_service.update_salary_config(
        employee_id=employeeId,
        monthly_salary=payload.monthlySalary,
        absent_deduction_rate=payload.absentDeductionRate,
        half_day_deduction_rate=payload.halfDayDeductionRate,
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
async def download_payslip_pdf(
    employeeId: str,
    month: int = 10,
    year: int = 2026,
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)
):
    """
    Generates and downloads the official Adani salary slip PDF.
    - Technicians can only download their own payslip.
    - Admins can download any employee's payslip.
    """
    token_str = credentials.credentials if credentials else token
    token_data = decode_access_token(token_str) if token_str else None
    if token_data:
        _verify_employee_access(employeeId, token_data)

    employee = db.get_employee(employeeId) or db.find_employee_by_identifier(employeeId)
    canonical_id = employee.get("employeeId") if employee else employeeId
    key1 = f"{employeeId}_{month}_{year}"
    key2 = f"{canonical_id}_{month}_{year}"
    uploaded = UPLOADED_SLIPS.get(key1) or UPLOADED_SLIPS.get(key2)

    # If admin uploaded a static document, serve that document
    if uploaded and uploaded.get("fileBase64"):
        try:
            file_bytes = base64.b64decode(uploaded["fileBase64"])
            filename = uploaded.get("fileName") or f"payslip_{canonical_id}_{month}_{year}.pdf"
            media_type = "application/pdf" if filename.lower().endswith(".pdf") else (
                "image/png" if filename.lower().endswith(".png") else "application/octet-stream"
            )
            return Response(
                content=file_bytes,
                media_type=media_type,
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing uploaded payslip: {str(e)}")

    # Dynamically generate official verified Adani salary slip PDF
    try:
        slip_data = salary_service.get_salary_slip(employeeId, month, year)
        pdf_bytes = generate_salary_slip_pdf(slip_data, employee)
        clean_name = (employee.get("name") if employee else "Staff").replace(" ", "_")
        filename = f"Adani_Salary_Slip_{clean_name}_{month}_{year}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating payslip PDF: {str(e)}")

@router.post("/upload", response_model=SalarySlipResponse)
async def upload_salary_slip(
    data: UploadSalarySlipRequest,
    token_data: dict = Depends(require_roles(["admin"]))
):
    """Admin endpoint to upload or record verified employee salary slip month and year-wise."""
    slip = salary_service.record_salary_slip(
        employee_id=data.employeeId,
        month=data.month,
        year=data.year,
        net_amount=data.netAmount,
        notes=data.notes,
        file_name=data.fileName,
        file_base64=data.fileBase64,
        uploaded_by=token_data.get("name") or "Operations Administrator"
    )
    return slip
