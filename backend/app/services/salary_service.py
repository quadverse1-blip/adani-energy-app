import calendar
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.core.database import db

UPLOADED_SLIPS: Dict[str, dict] = {}

class SalaryService:
    @staticmethod
    def record_salary_slip(
        employee_id: str,
        month: int,
        year: int,
        net_amount: float,
        notes: Optional[str] = "Monthly verified technician salary payout",
        file_name: Optional[str] = None,
        file_base64: Optional[str] = None,
        uploaded_by: Optional[str] = "Operations Administrator"
    ) -> dict:
        employee = db.get_employee(employee_id)
        if not employee:
            employee = db.find_employee_by_identifier(employee_id)

        canonical_id = employee.get("employeeId") if employee else employee_id

        record = {
            "employeeId": canonical_id,
            "rawId": employee_id,
            "month": month,
            "year": year,
            "netAmount": float(net_amount),
            "notes": notes or "Monthly verified technician salary payout",
            "fileName": file_name or f"payslip_{canonical_id}_{month}_{year}.pdf",
            "fileBase64": file_base64,
            "uploadedAt": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "uploadedBy": uploaded_by
        }

        UPLOADED_SLIPS[f"{employee_id}_{month}_{year}"] = record
        if canonical_id != employee_id:
            UPLOADED_SLIPS[f"{canonical_id}_{month}_{year}"] = record

        return SalaryService.get_salary_slip(employee_id, month, year)

    @staticmethod
    def get_salary_slip(employee_id: str, month: int, year: int) -> dict:
        employee = db.get_employee(employee_id)
        if not employee:
            employee = db.find_employee_by_identifier(employee_id)
        
        canonical_id = employee.get("employeeId") if employee else employee_id
        name = employee.get("name", "Field Technician") if employee else "Field Technician"
        desig = employee.get("designation", "Smart Meter Technician") if employee else "Smart Meter Technician"
        role = employee.get("role", "technician") if employee else "technician"

        # Check if an admin uploaded a custom verified salary slip
        key1 = f"{employee_id}_{month}_{year}"
        key2 = f"{canonical_id}_{month}_{year}"
        uploaded_slip = UPLOADED_SLIPS.get(key1) or UPLOADED_SLIPS.get(key2)
        has_uploaded = uploaded_slip is not None

        # Base compensation scales according to role
        if role == "admin":
            basic = 48000.0
            hra = 19200.0
            da = 9600.0
            travel = 5000.0
            field = 4000.0
            pf = 5760.0
            esic = 0.0
            pt = 200.0
            tds = 5000.0
        elif role == "supervisor":
            basic = 28000.0
            hra = 11200.0
            da = 5600.0
            travel = 3500.0
            field = 3500.0
            pf = 3360.0
            esic = 0.0
            pt = 200.0
            tds = 1500.0
        else: # technician (matching specification net ~ ₹28,450)
            basic = 16000.0
            hra = 6400.0
            da = 3200.0
            travel = 2500.0
            field = 3000.0
            pf = 1920.0
            esic = 230.0
            pt = 200.0
            tds = 300.0

        if has_uploaded:
            net_pay = uploaded_slip["netAmount"]
            basic = round(net_pay * 0.55, 2)
            hra = round(net_pay * 0.22, 2)
            da = round(net_pay * 0.11, 2)
            travel = round(net_pay * 0.08, 2)
            field = round(net_pay * 0.04, 2)
            gross = basic + hra + da + travel + field
            pf = round(basic * 0.12, 2)
            deductions = round(gross - net_pay, 2)
        else:
            gross = basic + hra + da + travel + field
            deductions = pf + esic + pt + tds
            net_pay = gross - deductions

        month_name = calendar.month_name[month]

        return {
            "employeeId": canonical_id,
            "employeeName": name,
            "designation": desig,
            "month": month,
            "year": year,
            "monthName": f"{month_name} {year}",
            "netPay": round(net_pay, 2),
            "status": "PAID" if (has_uploaded or month <= 10) else "PROCESSING",
            "payableDays": 30,
            "presentDays": 26,
            "paidLeaves": 3,
            "lossOfPay": 1,
            "earnings": {
                "basicSalary": basic,
                "hra": hra,
                "da": da,
                "travelAllowance": travel,
                "siteFieldAllowance": field,
                "grossEarnings": gross
            },
            "deductions": {
                "pf": pf,
                "esic": esic,
                "professionalTax": pt,
                "tds": tds,
                "totalDeductions": deductions
            },
            "payslipPdfUrl": f"/api/v1/salary/download/{employee_id}?month={month}&year={year}",
            "hasUploadedDocument": has_uploaded,
            "documentUrl": f"/api/v1/salary/download/{employee_id}?month={month}&year={year}" if has_uploaded else None,
            "fileName": uploaded_slip.get("fileName") if uploaded_slip else None,
            "notes": uploaded_slip.get("notes") if uploaded_slip else "Monthly verified compensation",
            "uploadedAt": uploaded_slip.get("uploadedAt") if uploaded_slip else None,
            "uploadedBy": uploaded_slip.get("uploadedBy") if uploaded_slip else None
        }

salary_service = SalaryService()

# Seed verified Admin-Uploaded Payslip PDF for Supervisor (Neha Patil - October 2026)
def _seed_supervisor_payslip():
    try:
        import io, base64
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=letter)
        c.setFont("Helvetica-Bold", 18)
        c.drawString(50, 750, "ADANI ELECTRICITY & TRANSMISSION")
        c.setFont("Helvetica", 11)
        c.drawString(50, 732, "Workforce Operations Management • Official Salary Payslip")
        c.setStrokeColorRGB(0.12, 0.39, 0.94)
        c.setLineWidth(2)
        c.line(50, 720, 560, 720)

        c.setFont("Helvetica-Bold", 12)
        c.setFillColorRGB(0.06, 0.09, 0.16)
        c.drawString(50, 690, "Employee Name: Neha Patil")
        c.drawString(50, 670, "Employee ID: b4S/Adani/05 (SUPERVISOR)")
        c.drawString(50, 650, "Payroll Period: October 2026")
        c.drawString(50, 630, "Net Disbursed Take-Home Pay: Rs. 46,740.00")
        c.drawString(50, 610, "Status: VERIFIED & TRANSFERRED TO SALARY ACCOUNT")

        c.setStrokeColorRGB(0.8, 0.85, 0.9)
        c.setLineWidth(1)
        c.line(50, 595, 560, 595)

        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, 575, "Earnings Breakdown:")
        c.setFont("Helvetica", 10)
        c.drawString(70, 555, "• Basic Pay: Rs. 28,000.00")
        c.drawString(70, 540, "• House Rent Allowance (HRA): Rs. 11,200.00")
        c.drawString(70, 525, "• Dearness Allowance (DA): Rs. 5,600.00")
        c.drawString(70, 510, "• Travel & Conveyance Allowance: Rs. 3,500.00")
        c.drawString(70, 495, "• Site & Field Allowance: Rs. 3,500.00")
        c.setFont("Helvetica-Bold", 10)
        c.drawString(70, 475, "Gross Earnings: Rs. 51,800.00")

        c.setFont("Helvetica-Bold", 11)
        c.drawString(300, 575, "Statutory Deductions:")
        c.setFont("Helvetica", 10)
        c.drawString(320, 555, "• Provident Fund (PF): Rs. 3,360.00")
        c.drawString(320, 540, "• Professional Tax (PT): Rs. 200.00")
        c.drawString(320, 525, "• Tax Deducted at Source (TDS): Rs. 1,500.00")
        c.setFont("Helvetica-Bold", 10)
        c.drawString(320, 475, "Total Deductions: Rs. 5,060.00")

        c.line(50, 455, 560, 455)
        c.setFont("Helvetica-Oblique", 9)
        c.setFillColorRGB(0.4, 0.45, 0.55)
        c.drawString(50, 435, "This is an official computer-generated salary slip digitally approved by Adani HR & Accounts Division.")
        c.drawString(50, 420, "Approved by: Operations Administrator • Archive ID: ADN-PAY-2026-10-05")

        c.showPage()
        c.save()
        pdf_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        salary_service.record_salary_slip(
            employee_id="emp_05",
            month=10,
            year=2026,
            net_amount=46740.0,
            notes="October 2026 verified monthly supervisor compensation approved by Adani Accounts.",
            file_name="Adani_Payslip_b4S_Adani_05_October_2026.pdf",
            file_base64=pdf_b64,
            uploaded_by="Adani Operations Admin"
        )
    except Exception as e:
        print("Error seeding supervisor payslip:", e)

_seed_supervisor_payslip()

def _seed_technician_payslip():
    try:
        import io, base64
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=letter)
        c.setFont("Helvetica-Bold", 18)
        c.drawString(50, 750, "ADANI ELECTRICITY & TRANSMISSION")
        c.setFont("Helvetica", 11)
        c.drawString(50, 732, "Smart Meter Field Operations • Official Salary Payslip")
        c.setStrokeColorRGB(0.12, 0.39, 0.94)
        c.setLineWidth(2)
        c.line(50, 720, 560, 720)

        c.setFont("Helvetica-Bold", 12)
        c.setFillColorRGB(0.06, 0.09, 0.16)
        c.drawString(50, 690, "Employee Name: Rohit Sharma")
        c.drawString(50, 670, "Employee ID: b4S/Adani/01 (TECHNICIAN - JUNIOR ENGINEER)")
        c.drawString(50, 650, "Payroll Period: October 2026")
        c.drawString(50, 630, "Net Disbursed Take-Home Pay: Rs. 28,450.00")
        c.drawString(50, 610, "Status: VERIFIED & TRANSFERRED TO SALARY ACCOUNT")

        c.setStrokeColorRGB(0.8, 0.85, 0.9)
        c.setLineWidth(1)
        c.line(50, 595, 560, 595)

        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, 575, "Earnings Breakdown:")
        c.setFont("Helvetica", 10)
        c.drawString(70, 555, "• Basic Pay: Rs. 16,000.00")
        c.drawString(70, 540, "• House Rent Allowance (HRA): Rs. 6,400.00")
        c.drawString(70, 525, "• Dearness Allowance (DA): Rs. 3,200.00")
        c.drawString(70, 510, "• Travel & Conveyance Allowance: Rs. 2,500.00")
        c.drawString(70, 495, "• Site & Field Allowance: Rs. 3,000.00")
        c.setFont("Helvetica-Bold", 10)
        c.drawString(70, 475, "Gross Earnings: Rs. 31,100.00")

        c.setFont("Helvetica-Bold", 11)
        c.drawString(300, 575, "Statutory Deductions:")
        c.setFont("Helvetica", 10)
        c.drawString(320, 555, "• Provident Fund (PF): Rs. 1,920.00")
        c.drawString(320, 540, "• Employee State Insurance (ESIC): Rs. 230.00")
        c.drawString(320, 525, "• Professional Tax (PT): Rs. 200.00")
        c.drawString(320, 510, "• Tax Deducted at Source (TDS): Rs. 300.00")
        c.setFont("Helvetica-Bold", 10)
        c.drawString(320, 475, "Total Deductions: Rs. 2,650.00")

        c.line(50, 455, 560, 455)
        c.setFont("Helvetica-Oblique", 9)
        c.setFillColorRGB(0.4, 0.45, 0.55)
        c.drawString(50, 435, "This is an official computer-generated salary slip digitally approved by Adani HR & Accounts Division.")
        c.drawString(50, 420, "Approved by: Operations Administrator • Archive ID: ADN-TECH-2026-10-01")

        c.showPage()
        c.save()
        pdf_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        salary_service.record_salary_slip(
            employee_id="emp_01",
            month=10,
            year=2026,
            net_amount=28450.0,
            notes="October 2026 verified monthly technician compensation approved by Adani Accounts.",
            file_name="Adani_Payslip_b4S_Adani_01_October_2026.pdf",
            file_base64=pdf_b64,
            uploaded_by="Adani Operations Admin"
        )
    except Exception as e:
        print("Error seeding technician payslip:", e)

_seed_technician_payslip()
