from pydantic import BaseModel
from typing import Optional, List

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

class SalarySlipResponse(BaseModel):
    employeeId: str
    employeeName: str
    designation: str
    month: int
    year: int
    monthName: str
    netPay: float
    status: str  # PAID, PROCESSING
    payableDays: int
    presentDays: int
    paidLeaves: int
    lossOfPay: int
    earnings: EarningsBreakdown
    deductions: DeductionsBreakdown
    payslipPdfUrl: Optional[str] = None
    hasUploadedDocument: Optional[bool] = False
    documentUrl: Optional[str] = None
    fileName: Optional[str] = None
    notes: Optional[str] = None
    uploadedAt: Optional[str] = None
    uploadedBy: Optional[str] = None

class UploadSalarySlipRequest(BaseModel):
    employeeId: str
    month: int
    year: int
    netAmount: float
    notes: Optional[str] = "Monthly verified technician salary payout"
    fileName: Optional[str] = None
    fileBase64: Optional[str] = None

class SalarySummaryResponse(BaseModel):
    totalDisbursed: float
    paidCount: int
    pendingCount: int
    slips: List[SalarySlipResponse]
