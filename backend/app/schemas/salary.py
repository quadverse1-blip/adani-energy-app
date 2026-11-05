from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class EarningsBreakdown(BaseModel):
    basicSalary: float
    hra: float
    da: float
    travelAllowance: float
    siteFieldAllowance: float
    grossEarnings: float

class DeductionsBreakdown(BaseModel):
    pf: float
    esic: float
    professionalTax: float
    tds: float
    totalDeductions: float

class AttendanceSummaryForSalary(BaseModel):
    presentDays: int
    absentDays: int
    halfDays: int
    weeklyOffDays: int
    publicHolidayDays: int
    totalCalendarDays: int
    payableDays: int

class SalaryDeductionDetails(BaseModel):
    absentDeductionRate: float
    halfDayDeductionRate: float
    absentDeductionTotal: float
    halfDayDeductionTotal: float
    totalDeductions: float
    notes: Optional[str] = None

class SalaryConfigCreateUpdate(BaseModel):
    monthlySalary: float
    absentDeductionRate: Optional[float] = None
    absentDeduction: Optional[float] = None
    halfDayDeductionRate: Optional[float] = None
    halfDayDeduction: Optional[float] = None
    effectiveDate: Optional[str] = None
    notes: Optional[str] = None

class SalaryConfigResponse(BaseModel):
    employeeId: str
    employeeName: str
    monthlySalary: float
    dailyRate: float
    absentDeductionRate: float
    halfDayDeductionRate: float
    effectiveDate: str
    updatedAt: Optional[str] = None
    updatedBy: Optional[str] = None
    notes: Optional[str] = None

class SalarySlipResponse(BaseModel):
    employeeId: str
    employeeName: str
    designation: str
    month: int
    year: int
    monthName: str
    netPay: float
    status: str  # DRAFT, FINALIZED, REVISED, PAID
    payableDays: int
    presentDays: int
    paidLeaves: int
    lossOfPay: int
    
    # Extended attendance-based fields
    monthlySalary: Optional[float] = None
    dailySalaryRate: Optional[float] = None
    absentDays: Optional[int] = 0
    halfDays: Optional[int] = 0
    weeklyOffDays: Optional[int] = 0
    publicHolidayDays: Optional[int] = 0
    absentDeductionTotal: Optional[float] = 0.0
    halfDayDeductionTotal: Optional[float] = 0.0
    totalDeductionAmount: Optional[float] = 0.0
    referenceNumber: Optional[str] = None
    finalizedAt: Optional[str] = None
    finalizedBy: Optional[str] = None
    revisionReason: Optional[str] = None
    
    # Existing breakdown fields for compatibility
    earnings: EarningsBreakdown
    deductions: DeductionsBreakdown
    payslipPdfUrl: Optional[str] = None
    hasUploadedDocument: Optional[bool] = False
    documentUrl: Optional[str] = None
    fileName: Optional[str] = None
    notes: Optional[str] = None
    uploadedAt: Optional[str] = None
    uploadedBy: Optional[str] = None
    
    # Universal compatibility fields for clients/scripts expecting nested or status wrappers
    slip: Optional[dict] = None
    success: Optional[bool] = True
    message: Optional[str] = None

class UploadSalarySlipRequest(BaseModel):
    employeeId: str
    month: int
    year: int
    netAmount: Optional[float] = None
    amount: Optional[float] = None
    notes: Optional[str] = "Monthly verified technician salary payout"
    fileName: Optional[str] = None
    documentName: Optional[str] = None
    fileBase64: Optional[str] = None

class FinalizeSalaryRequest(BaseModel):
    employeeId: str
    month: int
    year: int
    notes: Optional[str] = None

class ReviseSalaryRequest(BaseModel):
    employeeId: str
    month: int
    year: int
    monthlySalary: Optional[float] = None
    absentDeductionRate: Optional[float] = None
    halfDayDeductionRate: Optional[float] = None
    revisionReason: str
    notes: Optional[str] = None

class SalarySummaryResponse(BaseModel):
    totalDisbursed: float
    totalDeductions: float
    totalBaseSalary: float
    paidCount: int
    finalizedCount: int
    draftCount: int
    pendingCount: int
    slips: List[SalarySlipResponse]
