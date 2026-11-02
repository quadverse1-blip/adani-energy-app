from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, Header
from fastapi.responses import StreamingResponse, JSONResponse
from app.core.security import decode_access_token
from app.services.report_service import report_service

router = APIRouter(prefix="/reports", tags=["Reports"])

def optional_auth_checker(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
) -> Optional[dict]:
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]
    elif token:
        auth_token = token
    if auth_token:
        return decode_access_token(auth_token)
    return None

@router.get("/muster-roll")
async def get_muster_roll(
    month: Optional[int] = Query(None, description="Month (1-12), defaults to current month"),
    year: Optional[int] = Query(None, description="Year, defaults to current year"),
    siteId: Optional[str] = Query(None, description="Optional substation site ID")
):
    """
    Returns official register preview muster roll matrix data and summary KPIs
    with dynamic system date, horizontal days, centralized holidays, and strict P, A, WO, PH statuses.
    """
    now = datetime.now()
    m = month if month is not None else now.month
    y = year if year is not None else now.year
    data = report_service.get_muster_roll_data(month=m, year=y, site_id=siteId)
    return JSONResponse(content=data)

@router.get("/export")
async def export_attendance_report(
    type: str = Query("muster", description="'muster' or 'logs'"),
    month: Optional[int] = Query(None, description="Month (1-12)"),
    year: Optional[int] = Query(None, description="Year (e.g. 2026)"),
    siteId: Optional[str] = None,
    status: Optional[str] = None,
    rangeType: Optional[str] = Query("month", description="today, week, month, all"),
    token_user: Optional[dict] = Depends(optional_auth_checker)
):
    """
    Downloads the formatted Excel spreadsheet matching the official muster roll register
    or detailed shift activity logs.
    """
    now = datetime.now()
    m = month if month is not None else now.month
    y = year if year is not None else now.year

    if type == "logs":
        excel_stream = report_service.generate_attendance_excel(
            site_id=siteId,
            status_filter=status
        )
        filename = f"b4S_Detailed_Shift_Logs_{now.strftime('%Y%m%d_%H%M%S')}.xlsx"
    else:
        excel_stream = report_service.generate_muster_roll_excel(
            month=m,
            year=y,
            site_id=siteId
        )
        month_name = datetime(y, m, 1).strftime("%B")
        filename = f"b4S_Attendance_Muster_Roll_{month_name}_{y}.xlsx"

    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@router.get("/export-logs")
async def export_detailed_logs(
    siteId: Optional[str] = None,
    status: Optional[str] = None,
    token_user: Optional[dict] = Depends(optional_auth_checker)
):
    excel_stream = report_service.generate_attendance_excel(
        site_id=siteId,
        status_filter=status
    )
    filename = f"b4S_Detailed_Shift_Logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
