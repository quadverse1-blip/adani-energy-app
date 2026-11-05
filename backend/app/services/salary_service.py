import os
import base64
import calendar
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from app.core.database import db
from app.core.config import settings

UPLOADED_SLIPS: Dict[str, dict] = {}

class SalaryService:
    @staticmethod
    def get_salary_config(employee_id: str) -> dict:
        """Retrieves individual employee salary & deduction configuration."""
        return db.get_salary_config(employee_id)

    @staticmethod
    def update_salary_config(
        employee_id: str,
        monthly_salary: float,
        absent_deduction_rate: float,
        half_day_deduction_rate: float,
        effective_date: Optional[str] = None,
        notes: Optional[str] = None,
        updated_by: Optional[str] = "Operations Administrator"
    ) -> dict:
        """
        Updates individual employee salary and deduction amounts with effective date.
        Maintains historical snapshots so prior unfinalized payroll periods retain
        the settings that were in effect for their month, preserving historical salary integrity.
        """
        effective_dt_str = effective_date or datetime.utcnow().strftime("%Y-%m-%d")
        existing_cfg = db.get_salary_config(employee_id)
        
        # Preserve previous configuration in historical audit list
        history = list(existing_cfg.get("history") or [])
        if existing_cfg.get("monthlySalary"):
            history.append({
                "monthlySalary": float(existing_cfg.get("monthlySalary", 20000.0)),
                "absentDeductionRate": float(existing_cfg.get("absentDeductionRate", 500.0)),
                "halfDayDeductionRate": float(existing_cfg.get("halfDayDeductionRate", 250.0)),
                "effectiveDate": str(existing_cfg.get("effectiveDate", "2026-01-01")),
                "endedAt": effective_dt_str,
                "notes": existing_cfg.get("notes", "Historical scale"),
                "updatedBy": existing_cfg.get("updatedBy", "System"),
                "updatedAt": existing_cfg.get("updatedAt")
            })

        config_data = {
            "monthlySalary": float(monthly_salary),
            "absentDeductionRate": float(absent_deduction_rate),
            "halfDayDeductionRate": float(half_day_deduction_rate),
            "effectiveDate": effective_dt_str,
            "notes": notes or "Configured by Admin",
            "updatedBy": updated_by or "Operations Administrator",
            "updatedAt": datetime.utcnow().isoformat() + "Z",
            "history": history
        }
        return db.set_salary_config(employee_id, config_data)

    @staticmethod
    def calculate_attendance_summary(
        employee_id: str,
        month: int,
        year: int,
        holiday_map: Optional[dict] = None,
        emp_att_map: Optional[dict] = None
    ) -> dict:
        """
        Dynamically calculates employee attendance categories from centralized attendance:
        - P (Present): Full days worked
        - Half Day: Days where working minutes < 480 or marked as half-day
        - A (Absent): Regular working days without check-in up to today
        - WO (Weekly Off): Sundays (no deduction)
        - PH (Public Holiday): Official gazetted holidays (no deduction)
        """
        now = datetime.now()
        days_in_month = calendar.monthrange(year, month)[1]

        # 1. Fetch holidays if not supplied
        if holiday_map is None:
            holidays_list = db.get_all_holidays(year=year)
            holiday_map = {}
            for h in holidays_list:
                if h.get("date") and h.get("status") != "deleted":
                    holiday_map[str(h["date"]).strip()] = h

        # 2. Fetch employee attendance records if not supplied
        if emp_att_map is None:
            employee = db.get_employee(employee_id) or db.find_employee_by_identifier(employee_id)
            emp_raw_id = employee.get("_id", employee_id) if employee else employee_id
            emp_code = employee.get("employeeId", employee_id) if employee else employee_id

            emp_att_list = db.get_attendance_history(emp_raw_id, month=month, year=year)
            if not emp_att_list and emp_code != emp_raw_id:
                emp_att_list = db.get_attendance_history(emp_code, month=month, year=year)

            emp_att_map = {}
            for att in emp_att_list:
                d_val = str(att.get("date") or "").strip()
                if d_val:
                    emp_att_map[d_val] = att

        present_days = 0
        half_days = 0
        absent_days = 0
        weekly_off_days = 0
        public_holiday_days = 0

        for d in range(1, days_in_month + 1):
            dt_obj = date(year, month, d)
            d_str = dt_obj.strftime("%Y-%m-%d")

            # Condition 1: Public Holiday (PH) - No deduction
            if d_str in holiday_map:
                public_holiday_days += 1
            # Condition 2: Weekly Off (WO - Sunday) - No deduction
            elif dt_obj.weekday() == 6:
                weekly_off_days += 1
            # Condition 3: Regular Working Day
            else:
                att_rec = emp_att_map.get(d_str)
                if att_rec and isinstance(att_rec, dict):
                    ci = att_rec.get("checkIn")
                    st = str(att_rec.get("status") or "").lower().replace("-", "_")
                    shift_st = str(att_rec.get("shiftStatus") or "").lower().replace("-", "_")
                    cat = str(att_rec.get("attendanceCategory") or "").upper()
                    is_hd_flag = bool(att_rec.get("isHalfDay")) or cat == "HALF_DAY" or st in ("half_day", "halfday", "hd") or shift_st in ("half_day", "halfday", "hd")
                    is_admin_override = bool(att_rec.get("isAdminOverride") or att_rec.get("adminOverride"))
                    working_mins = att_rec.get("workingMinutes") or 0

                    if st in ("absent", "a") or cat == "ABSENT":
                        # Final approved status is Absent (even if previous punch existed)
                        absent_days += 1
                    elif is_hd_flag:
                        # Final approved status is Half Day
                        half_days += 1
                        present_days += 1
                    elif is_admin_override and (st in ("p", "present") or cat == "PRESENT"):
                        # Admin override to full Present: strictly preserved, no automatic demotion
                        present_days += 1
                    elif ci and (0 < working_mins < 480):
                        # Automatic calculation without admin override: partial hours -> half day
                        half_days += 1
                        present_days += 1
                    elif ci or st in ["p", "present", "late", "completed", "active"]:
                        present_days += 1
                    else:
                        if dt_obj <= now.date():
                            absent_days += 1
                else:
                    # No check-in record
                    if dt_obj <= now.date():
                        absent_days += 1

        payable_days = present_days + weekly_off_days + public_holiday_days

        return {
            "presentDays": present_days,
            "absentDays": absent_days,
            "halfDays": half_days,
            "weeklyOffDays": weekly_off_days,
            "publicHolidayDays": public_holiday_days,
            "totalCalendarDays": days_in_month,
            "payableDays": payable_days
        }

    @staticmethod
    def get_salary_slip(
        employee_id: str,
        month: int,
        year: int,
        holiday_map: Optional[dict] = None,
        emp_att_map: Optional[dict] = None
    ) -> dict:
        """
        Returns employee salary slip.
        If a statement was finalized by Admin, returns the frozen finalized record.
        Otherwise calculates dynamically from attendance and current salary config.
        """
        employee = db.get_employee(employee_id) or db.find_employee_by_identifier(employee_id)
        canonical_id = str((employee.get("employeeId") if employee else None) or employee_id)
        name = str((employee.get("name") if employee else None) or "Field Technician")
        desig = str((employee.get("designation") if employee else None) or "Smart Meter Technician")
        dept = str((employee.get("department") if employee else None) or "Smart Meter Operations")
        circle = str((employee.get("circle") if employee else None) or "Vadodara Circle")
        division = str((employee.get("division") if employee else None) or "Central Division")

        # 1. Check if finalized statement is already recorded
        frozen_statement = db.get_salary_statement(employee_id, month, year)
        if frozen_statement:
            frozen_statement["hasUploadedDocument"] = True
            frozen_statement["payslipPdfUrl"] = f"/api/v1/salary/download/{canonical_id}?month={month}&year={year}"
            frozen_statement["documentUrl"] = f"/api/v1/salary/download/{canonical_id}?month={month}&year={year}"
            return frozen_statement

        # 2. Check if an admin uploaded an external slip file
        safe_canonical = canonical_id.replace("/", "_").replace("\\", "_")
        uploaded_slip = (
            UPLOADED_SLIPS.get(f"{employee_id}_{month}_{year}")
            or UPLOADED_SLIPS.get(f"{canonical_id}_{month}_{year}")
            or UPLOADED_SLIPS.get(f"{employee_id}_{year}_{month}")
            or UPLOADED_SLIPS.get(f"{canonical_id}_{year}_{month}")
            or UPLOADED_SLIPS.get(f"{employee_id.lower()}_{month}_{year}")
            or UPLOADED_SLIPS.get(f"{canonical_id.lower()}_{month}_{year}")
            or UPLOADED_SLIPS.get(f"{employee_id.lower()}_{year}_{month}")
            or UPLOADED_SLIPS.get(f"{canonical_id.lower()}_{year}_{month}")
            or UPLOADED_SLIPS.get(f"{safe_canonical}_{month}_{year}")
            or UPLOADED_SLIPS.get(f"{safe_canonical}_{year}_{month}")
            or UPLOADED_SLIPS.get(f"{safe_canonical.lower()}_{month}_{year}")
            or UPLOADED_SLIPS.get(f"{safe_canonical.lower()}_{year}_{month}")
        )
        disk_path = os.path.join(settings.UPLOAD_DIR, "payslips", f"payslip_{safe_canonical}_{year}_{month}.pdf")
        has_disk = os.path.exists(disk_path)
        has_uploaded = (uploaded_slip is not None) or has_disk

        # 3. Retrieve employee salary configuration (with Historical Salary Protection)
        cfg = db.get_salary_config(canonical_id)
        
        # Check if requested payroll month is prior to the config's effective date
        target_period_start = date(year, month, 1)
        active_cfg = cfg
        try:
            eff_date_str = str(cfg.get("effectiveDate") or "2026-01-01")
            eff_dt = datetime.strptime(eff_date_str[:10], "%Y-%m-%d").date()
            if target_period_start < eff_dt and cfg.get("history"):
                for hist in reversed(cfg.get("history", [])):
                    h_start = datetime.strptime(str(hist.get("effectiveDate", "2026-01-01"))[:10], "%Y-%m-%d").date()
                    if h_start <= target_period_start:
                        active_cfg = hist
                        break
        except Exception:
            active_cfg = cfg

        monthly_salary = float(active_cfg.get("monthlySalary", 20000.0))
        absent_rate = float(active_cfg.get("absentDeductionRate", 500.0))
        half_day_rate = float(active_cfg.get("halfDayDeductionRate", 250.0))

        # 4. Calculate actual attendance counts
        att = SalaryService.calculate_attendance_summary(
            employee_id, month, year, holiday_map=holiday_map, emp_att_map=emp_att_map
        )
        days_in_month = att["totalCalendarDays"]
        daily_rate = round(monthly_salary / float(days_in_month), 2)

        # 5. Calculate deductions
        absent_deduction_total = round(att["absentDays"] * absent_rate, 2)
        half_day_deduction_total = round(att["halfDays"] * half_day_rate, 2)
        total_deduction_amount = round(absent_deduction_total + half_day_deduction_total, 2)

        if has_uploaded:
            net_pay = uploaded_slip["netAmount"]
        else:
            net_pay = max(0.0, round(monthly_salary - total_deduction_amount, 2))

        # 6. Standard breakdown for statutory components
        basic = round(monthly_salary * 0.55, 2)
        hra = round(monthly_salary * 0.22, 2)
        da = round(monthly_salary * 0.11, 2)
        travel = round(monthly_salary * 0.08, 2)
        field = round(monthly_salary * 0.04, 2)
        gross = basic + hra + da + travel + field
        pf = round(basic * 0.12, 2)

        month_name = calendar.month_name[month]
        ref_no = f"ADN-PAY-{year}{month:02d}-{canonical_id.replace('/', '-')}"

        statement = {
            "referenceNumber": ref_no,
            "employeeId": canonical_id,
            "employeeName": name,
            "designation": desig,
            "department": dept,
            "circle": circle,
            "division": division,
            "month": month,
            "year": year,
            "monthName": f"{month_name} {year}",
            "monthlySalary": monthly_salary,
            "dailySalaryRate": daily_rate,
            "netPay": round(net_pay, 2),
            "status": "DRAFT",
            "payableDays": att["payableDays"],
            "presentDays": att["presentDays"],
            "absentDays": att["absentDays"],
            "halfDays": att["halfDays"],
            "weeklyOffDays": att["weeklyOffDays"],
            "publicHolidayDays": att["publicHolidayDays"],
            "paidLeaves": att["weeklyOffDays"] + att["publicHolidayDays"],
            "lossOfPay": att["absentDays"],
            "absentDeductionRate": absent_rate,
            "halfDayDeductionRate": half_day_rate,
            "absentDeductionTotal": absent_deduction_total,
            "halfDayDeductionTotal": half_day_deduction_total,
            "totalDeductionAmount": total_deduction_amount,
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
                "esic": 0.0,
                "professionalTax": 200.0,
                "tds": 0.0,
                "totalDeductions": total_deduction_amount
            },
            "payslipPdfUrl": f"/api/v1/salary/download/{canonical_id}?month={month}&year={year}",
            "hasUploadedDocument": True,
            "documentUrl": f"/api/v1/salary/download/{canonical_id}?month={month}&year={year}",
            "fileName": (uploaded_slip.get("fileName") if uploaded_slip else None) or (f"payslip_{safe_canonical}_{year}_{month}.pdf" if has_disk else f"Adani_Salary_Slip_{safe_canonical}_{year}_{month}.pdf"),
            "notes": (uploaded_slip.get("notes") if uploaded_slip else None) or "Verified employee monthly salary slip",
            "uploadedAt": (uploaded_slip.get("uploadedAt") if uploaded_slip else None) or "Current Period",
            "uploadedBy": (uploaded_slip.get("uploadedBy") if uploaded_slip else None) or "Operations Administrator"
        }

        return statement

    @staticmethod
    def finalize_salary_statement(
        employee_id: str,
        month: int,
        year: int,
        admin_name: str,
        notes: Optional[str] = None
    ) -> dict:
        """
        Admin action: Calculates and freezes the monthly salary statement as FINALIZED.
        Once finalized, the statement is preserved and does not alter automatically.
        """
        statement = SalaryService.get_salary_slip(employee_id, month, year)
        statement["status"] = "FINALIZED"
        statement["finalizedAt"] = datetime.utcnow().isoformat() + "Z"
        statement["finalizedBy"] = admin_name or "Operations Administrator"
        if notes:
            statement["notes"] = notes

        db.save_salary_statement(statement)
        return statement

    @staticmethod
    def revise_salary_statement(
        employee_id: str,
        month: int,
        year: int,
        admin_name: str,
        revision_reason: str,
        custom_salary: Optional[float] = None,
        custom_absent_rate: Optional[float] = None,
        custom_half_day_rate: Optional[float] = None,
        notes: Optional[str] = None
    ) -> dict:
        """
        Admin action: Revises a finalized salary statement with an explicit audit trail.
        """
        statement = SalaryService.get_salary_slip(employee_id, month, year).copy()

        # Update rates if provided
        monthly_salary = float(custom_salary) if custom_salary is not None else float(statement["monthlySalary"])
        absent_rate = float(custom_absent_rate) if custom_absent_rate is not None else float(statement.get("absentDeductionRate", 500.0))
        half_day_rate = float(custom_half_day_rate) if custom_half_day_rate is not None else float(statement.get("halfDayDeductionRate", 250.0))

        days_in_month = statement.get("totalCalendarDays") or calendar.monthrange(year, month)[1]
        daily_rate = round(monthly_salary / float(days_in_month), 2)

        absent_deduction_total = round(statement.get("absentDays", 0) * absent_rate, 2)
        half_day_deduction_total = round(statement.get("halfDays", 0) * half_day_rate, 2)
        total_deduction_amount = round(absent_deduction_total + half_day_deduction_total, 2)
        net_pay = max(0.0, round(monthly_salary - total_deduction_amount, 2))

        # Maintain revision audit trail
        revisions = statement.get("revisions", [])
        revisions.append({
            "revisedAt": datetime.utcnow().isoformat() + "Z",
            "revisedBy": admin_name or "Operations Administrator",
            "previousNetPay": statement.get("netPay"),
            "newNetPay": net_pay,
            "revisionReason": revision_reason
        })

        statement["monthlySalary"] = monthly_salary
        statement["dailySalaryRate"] = daily_rate
        statement["absentDeductionRate"] = absent_rate
        statement["halfDayDeductionRate"] = half_day_rate
        statement["absentDeductionTotal"] = absent_deduction_total
        statement["halfDayDeductionTotal"] = half_day_deduction_total
        statement["totalDeductionAmount"] = total_deduction_amount
        statement["netPay"] = net_pay
        statement["status"] = "REVISED"
        statement["revisionReason"] = revision_reason
        statement["revisions"] = revisions
        if notes:
            statement["notes"] = notes

        db.save_salary_statement(statement)
        return statement

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
        employee = db.get_employee(employee_id) or db.find_employee_by_identifier(employee_id)
        canonical_id = str((employee.get("employeeId") if employee else None) or employee_id)
        safe_canonical = canonical_id.replace("/", "_").replace("\\", "_")

        # Sanitize filename and enforce .pdf extension
        raw_name = file_name or f"Adani_Salary_Slip_{safe_canonical}_{month}_{year}.pdf"
        base_name = os.path.splitext(raw_name)[0]
        final_file_name = f"{base_name}.pdf"

        # If base64 file data provided, decode, wrap to PDF if image, and persist
        if file_base64:
            try:
                clean_b64 = file_base64
                if "," in clean_b64:
                    clean_b64 = clean_b64.split(",", 1)[1]
                file_bytes = base64.b64decode(clean_b64)

                from app.services.pdf_service import ensure_pdf_bytes
                pdf_bytes = ensure_pdf_bytes(file_bytes)
                file_base64 = base64.b64encode(pdf_bytes).decode("ascii")

                payslip_dir = os.path.join(settings.UPLOAD_DIR, "payslips")
                os.makedirs(payslip_dir, exist_ok=True)
                disk_path = os.path.join(payslip_dir, f"payslip_{safe_canonical}_{year}_{month}.pdf")
                with open(disk_path, "wb") as f:
                    f.write(pdf_bytes)
            except Exception as e:
                print(f"[SalaryService] Warning: Failed to process and persist payslip to disk: {e}")
        else:
            # Fallback: generate official Adani salary slip PDF bytes so document is never null
            try:
                from app.services.pdf_service import generate_salary_slip_pdf
                statement_draft = SalaryService.get_salary_slip(employee_id, month, year)
                pdf_bytes = generate_salary_slip_pdf(statement_draft, employee)
                file_base64 = base64.b64encode(pdf_bytes).decode("ascii")
            except Exception as e:
                print(f"[SalaryService] Warning: Failed to generate fallback PDF bytes: {e}")

        record = {
            "employeeId": canonical_id,
            "rawId": employee_id,
            "month": month,
            "year": year,
            "netAmount": float(net_amount),
            "notes": notes or "Monthly verified technician salary payout",
            "fileName": final_file_name,
            "fileBase64": file_base64,
            "uploadedAt": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "uploadedBy": uploaded_by
        }

        # Store in memory under all key variants for instant lookup
        for k in [
            f"{employee_id}_{month}_{year}",
            f"{canonical_id}_{month}_{year}",
            f"{employee_id}_{year}_{month}",
            f"{canonical_id}_{year}_{month}",
            f"{employee_id.lower()}_{month}_{year}",
            f"{canonical_id.lower()}_{month}_{year}",
            f"{employee_id.lower()}_{year}_{month}",
            f"{canonical_id.lower()}_{year}_{month}",
            f"{safe_canonical}_{month}_{year}",
            f"{safe_canonical}_{year}_{month}",
            f"{safe_canonical.lower()}_{month}_{year}",
            f"{safe_canonical.lower()}_{year}_{month}",
        ]:
            UPLOADED_SLIPS[k] = record

        # Generate complete statement and save into database so it persists across reloads
        statement = SalaryService.get_salary_slip(employee_id, month, year)
        statement["status"] = "FINALIZED"
        statement["netPay"] = float(net_amount)
        statement["hasUploadedDocument"] = True
        statement["fileName"] = final_file_name
        statement["fileBase64"] = file_base64
        statement["documentUrl"] = f"/api/v1/salary/download/{canonical_id}?month={month}&year={year}"
        statement["payslipPdfUrl"] = f"/api/v1/salary/download/{canonical_id}?month={month}&year={year}"
        statement["uploadedAt"] = record["uploadedAt"]
        statement["uploadedBy"] = uploaded_by
        statement["notes"] = notes or "Monthly verified technician salary payout"

        db.save_salary_statement(statement)
        return statement

    @staticmethod
    def get_salary_summary(month: int, year: int) -> dict:
        """Returns monthly compensation summary across all active workforce employees."""
        # Sync statements from Firestore once in a batch
        db._sync_salary_statements_from_firestore_if_needed()

        all_emps = db.get_all_employees()
        all_emps.sort(key=lambda x: str(x.get("employeeId") or x.get("_id") or ""))

        # Pre-fetch holidays once for the year
        holidays_list = db.get_all_holidays(year=year)
        holiday_map = {}
        for h in holidays_list:
            if h.get("date") and h.get("status") != "deleted":
                holiday_map[str(h["date"]).strip()] = h

        # Pre-index attendance once for the month/year across all employees
        all_att = db.attendance.values()
        att_by_emp: Dict[str, Dict[str, dict]] = {}
        target_prefix = f"{year}-{month:02d}"
        for a in all_att:
            if not isinstance(a, dict):
                continue
            date_str = str(a.get("date") or "")
            if not date_str.startswith(target_prefix):
                continue
            for k in ["employeeId", "technicianCode", "userId"]:
                val = str(a.get(k) or "").lower().strip()
                if val:
                    if val not in att_by_emp:
                        att_by_emp[val] = {}
                    att_by_emp[val][date_str] = a

        slips = []
        for e in all_emps:
            e_id = e.get("_id") or e.get("id") or e.get("employeeId")
            emp_code = str(e.get("employeeId") or "").lower().strip()
            raw_id = str(e.get("_id") or "").lower().strip()

            emp_map = dict(att_by_emp.get(raw_id, {}))
            if emp_code and emp_code in att_by_emp:
                emp_map.update(att_by_emp[emp_code])

            s = SalaryService.get_salary_slip(
                e_id, month, year, holiday_map=holiday_map, emp_att_map=emp_map
            )
            slips.append(s)

        total_disbursed = sum(s["netPay"] for s in slips)
        total_deductions = sum(s.get("totalDeductionAmount", 0.0) for s in slips)
        total_base = sum(s.get("monthlySalary", 0.0) for s in slips)

        finalized_count = sum(1 for s in slips if s.get("status") in ("FINALIZED", "PAID", "REVISED"))
        draft_count = sum(1 for s in slips if s.get("status") == "DRAFT")

        return {
            "totalDisbursed": round(total_disbursed, 2),
            "totalDeductions": round(total_deductions, 2),
            "totalBaseSalary": round(total_base, 2),
            "paidCount": finalized_count,
            "finalizedCount": finalized_count,
            "draftCount": draft_count,
            "pendingCount": draft_count,
            "slips": slips
        }

salary_service = SalaryService()
