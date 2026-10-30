import base64
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials
from app.core.security import get_current_user_token, security_bearer, decode_access_token
from app.services.salary_service import salary_service, UPLOADED_SLIPS
from app.schemas.salary import SalarySlipResponse, SalarySummaryResponse, UploadSalarySlipRequest
from app.core.database import db

router = APIRouter(prefix="/salary", tags=["Salary & Payslips"])

@router.get("/slip/{employeeId}", response_model=SalarySlipResponse)
async def get_salary_slip(
    employeeId: str,
    month: int = Query(10, ge=1, le=12),
    year: int = Query(2026, ge=2020, le=2030),
    token_data: dict = Depends(get_current_user_token)
):
    slip = salary_service.get_salary_slip(employeeId, month, year)
    return slip

@router.post("/upload", response_model=SalarySlipResponse)
async def upload_salary_slip(
    data: UploadSalarySlipRequest,
    token_data: dict = Depends(get_current_user_token)
):
    """
    Admin endpoint to upload or record verified employee salary slip month and year-wise.
    """
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

@router.get("/summary", response_model=SalarySummaryResponse)
async def get_salary_summary(
    month: int = Query(10, ge=1, le=12),
    year: int = Query(2026, ge=2020, le=2030),
    token_data: dict = Depends(get_current_user_token)
):
    all_emps = db.get_all_employees()
    slips = [salary_service.get_salary_slip(e["_id"], month, year) for e in all_emps]
    total_disbursed = sum(s["netPay"] for s in slips)
    
    return SalarySummaryResponse(
        totalDisbursed=round(total_disbursed, 2),
        paidCount=len(slips),
        pendingCount=0,
        slips=slips
    )

@router.get("/download/{employeeId}")
async def download_payslip_pdf(
    employeeId: str,
    month: int = 10,
    year: int = 2026,
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)
):
    token_str = credentials.credentials if credentials else token
    token_data = decode_access_token(token_str) if token_str else None
    if not token_data and not credentials:
        # In dev or if token expired/missing, check if employee exists
        pass
    employee = db.get_employee(employeeId) or db.find_employee_by_identifier(employeeId)
    canonical_id = employee.get("employeeId") if employee else employeeId
    key1 = f"{employeeId}_{month}_{year}"
    key2 = f"{canonical_id}_{month}_{year}"
    uploaded = UPLOADED_SLIPS.get(key1) or UPLOADED_SLIPS.get(key2)

    # Only allow download if admin uploaded a verified PDF/document
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

    # If admin has not uploaded for this month/year, reject download
    raise HTTPException(
        status_code=404,
        detail=f"Official signed salary slip PDF has not been uploaded by Admin for {month}/{year} yet. Download is only permitted for admin-uploaded verified payslips."
    )
