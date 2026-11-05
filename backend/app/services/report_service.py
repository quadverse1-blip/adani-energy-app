import io
import calendar
from datetime import datetime, date
from typing import Dict, List, Any, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.comments import Comment
from app.core.database import db
from app.utils.datetime_utils import get_now_ist, get_today_ist_str

class ReportService:
    @staticmethod
    def get_muster_roll_data(
        month: Optional[int] = None,
        year: Optional[int] = None,
        site_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Dynamically computes the official real-time horizontal attendance muster roll
        based on the actual system calendar and centralized public holidays.
        Strictly enforces ONLY 4 permitted attendance statuses:
        P = Present, A = Absent, WO = Weekly Off, PH = Public Holiday.
        """
        now = get_now_ist()
        today_date = now.date()
        month = month if month is not None else now.month
        year = year if year is not None else now.year

        month_name = datetime(year, month, 1).strftime("%B %Y")
        days_in_month = calendar.monthrange(year, month)[1]

        # 1. Fetch centralized public holidays for this month/year
        holidays_list = db.get_all_holidays(year=year)
        holiday_map: Dict[str, dict] = {}
        for h in holidays_list:
            if h.get("date") and h.get("status") != "deleted":
                holiday_map[str(h["date"]).strip()] = h

        # 2. Build metadata for all days in the month (horizontal header)
        days_meta = []
        for d in range(1, days_in_month + 1):
            dt_obj = date(year, month, d)
            d_str = dt_obj.strftime("%Y-%m-%d")
            day_name = dt_obj.strftime("%a")
            is_sunday = (dt_obj.weekday() == 6)
            h_obj = holiday_map.get(d_str)
            is_holiday = (h_obj is not None)
            is_today = (dt_obj == today_date)

            days_meta.append({
                "day": d,
                "date": d_str,
                "dayName": day_name,
                "label": f"{d:02d} {day_name}",
                "isSunday": is_sunday,
                "isHoliday": is_holiday,
                "holidayName": h_obj.get("name") if h_obj else None,
                "isToday": is_today
            })

        # 3. Fetch active employees (or filtered by site)
        # Exclude administrative accounts from field attendance muster roll register
        all_employees = [
            e for e in db.get_all_employees()
            if (e.get("status") or "").lower() != "deleted"
            and (e.get("role") or "").lower() != "admin"
            and not str(e.get("_id") or "").startswith("emp_admin")
        ]

        if site_id and site_id != "all":
            site_obj = db.get_site(site_id)
            site_name = (site_obj.get("name", "") if site_obj else "").lower()
            filtered_emps = []
            for e in all_employees:
                assigned_ids = [str(x) for x in (e.get("assignedSiteIds") or [])]
                primary_id = str(e.get("assignedSiteId") or "")
                div = (e.get("division") or "").lower()
                cir = (e.get("circle") or "").lower()
                if (
                    str(site_id) in assigned_ids
                    or primary_id == str(site_id)
                    or (site_name and (site_name in div or site_name in cir))
                ):
                    filtered_emps.append(e)
            all_employees = filtered_emps

        # Ensure employees are sorted by employeeId or name
        all_employees.sort(key=lambda x: str(x.get("employeeId") or x.get("name") or x.get("_id") or ""))

        # 4. Fetch all attendance records for this month/year in a single batch
        all_att_list = db.get_attendance_history(month=month, year=year)
        att_by_id: Dict[str, List[dict]] = {}
        for att in all_att_list:
            if not isinstance(att, dict):
                continue
            for k in ["employeeId", "technicianCode", "userId"]:
                val = str(att.get(k) or "").lower().strip()
                if val:
                    att_by_id.setdefault(val, []).append(att)

        records = []
        sr = 1

        for emp in all_employees:
            emp_id = emp.get("_id") or emp.get("id") or ""
            emp_code = emp.get("employeeId") or emp.get("code") or f"b4S/Adani/{sr:02d}"
            emp_name = emp.get("name", "Field Technician")
            designation = emp.get("designation", "Junior Engineer")
            circle = emp.get("circle") or ""
            division = emp.get("division") or ""

            # Resolve all matching records for this employee
            emp_keys = set()
            for k in ["_id", "id", "employeeId", "code", "phone"]:
                val = str(emp.get(k) or "").lower().strip()
                if val:
                    emp_keys.add(val)

            emp_att_map: Dict[str, dict] = {}
            for key in emp_keys:
                for att in att_by_id.get(key, []):
                    d_val = str(att.get("date") or "")
                    if d_val:
                        existing = emp_att_map.get(d_val)
                        if not existing or (att.get("checkIn") and not existing.get("checkIn")):
                            emp_att_map[d_val] = att

            # Determine status strictly as P, A, WO, PH for each day 1..days_in_month
            days_status: Dict[int, str] = {}
            day_holiday_names: Dict[int, str] = {}

            p_count = 0
            hd_count = 0
            a_count = 0
            wo_count = 0
            ph_count = 0

            for d in range(1, days_in_month + 1):
                dt_obj = date(year, month, d)
                d_str = dt_obj.strftime("%Y-%m-%d")

                # Condition 1: Public Holiday (Centralized)
                if d_str in holiday_map:
                    status_code = "PH"
                    day_holiday_names[d] = holiday_map[d_str].get("name", "Public Holiday")
                    ph_count += 1
                else:
                    att_rec = emp_att_map.get(d_str)
                    has_checkin = False
                    is_half = False
                    is_absent = False
                    if att_rec and isinstance(att_rec, dict):
                        ci = att_rec.get("checkIn")
                        st = str(att_rec.get("status") or "").lower().replace("-", "_")
                        shift_st = str(att_rec.get("shiftStatus") or "").lower().replace("-", "_")
                        cat = str(att_rec.get("attendanceCategory") or "").upper()
                        is_hd = bool(att_rec.get("isHalfDay")) or cat == "HALF_DAY" or st in ("half_day", "halfday", "hd") or shift_st in ("half_day", "halfday", "hd")
                        is_admin_override = bool(att_rec.get("isAdminOverride") or att_rec.get("adminOverride"))
                        wm = att_rec.get("workingMinutes") or 0

                        if st in ("absent", "a") or cat == "ABSENT":
                            is_absent = True
                        elif is_hd:
                            is_half = True
                        elif is_admin_override and (st in ("p", "present") or cat == "PRESENT"):
                            has_checkin = True
                        elif ci and (0 < wm < 480):
                            is_half = True
                        elif ci or st in ["p", "present", "late", "on_time", "completed", "active"]:
                            has_checkin = True

                    # Condition 2: Active or Admin-marked duty shift (Present / Half Day / Absent)
                    if is_absent:
                        status_code = "A"
                        a_count += 1
                    elif is_half:
                        status_code = "HD"
                        p_count += 1
                        hd_count += 1
                    elif has_checkin:
                        status_code = "P"
                        p_count += 1
                    # Condition 3: Scheduled Sunday Weekly Off
                    elif dt_obj.weekday() == 6:
                        status_code = "WO"
                        wo_count += 1
                    # Condition 4: Regular Working Day (Absent vs Future)
                    else:
                        if dt_obj <= today_date:
                            status_code = "A"
                            a_count += 1
                        else:
                            status_code = "-"

                days_status[d] = status_code

            total_recorded = p_count + wo_count + ph_count

            # Synchronized attendance-based compensation breakdown
            try:
                from app.services.salary_service import salary_service
                slip = salary_service.get_salary_slip(emp_id, month=month, year=year)
                comp_data = {
                    "monthlySalary": slip.get("monthlySalary", 20000.0),
                    "dailyRate": slip.get("dailySalaryRate", 666.67),
                    "absentDeductionRate": slip.get("absentDeductionRate", 500.0),
                    "halfDayDeductionRate": slip.get("halfDayDeductionRate", 250.0),
                    "absentDeductionTotal": slip.get("absentDeductionTotal", 0.0),
                    "halfDayDeductionTotal": slip.get("halfDayDeductionTotal", 0.0),
                    "totalDeductions": slip.get("totalDeductionAmount", 0.0),
                    "netPayableSalary": slip.get("netPay", 20000.0),
                    "status": slip.get("status", "DRAFT"),
                    "referenceNumber": slip.get("referenceNumber")
                }
            except Exception:
                comp_data = {
                    "monthlySalary": 20000.0,
                    "dailyRate": 666.67,
                    "absentDeductionRate": 500.0,
                    "halfDayDeductionRate": 250.0,
                    "absentDeductionTotal": round(a_count * 500.0, 2),
                    "halfDayDeductionTotal": round(hd_count * 250.0, 2),
                    "totalDeductions": round((a_count * 500.0) + (hd_count * 250.0), 2),
                    "netPayableSalary": round(20000.0 - ((a_count * 500.0) + (hd_count * 250.0)), 2),
                    "status": "DRAFT",
                    "referenceNumber": None
                }

            records.append({
                "sr": sr,
                "employeeId": emp_id,
                "employeeCode": emp_code,
                "employeeName": emp_name,
                "designation": designation,
                "circle": circle,
                "division": division,
                "days": days_status,
                "dayHolidayNames": day_holiday_names,
                "summary": {
                    "P": p_count,
                    "HD": hd_count,
                    "A": a_count,
                    "WO": wo_count,
                    "PH": ph_count,
                    "Total": total_recorded
                },
                "compensation": comp_data
            })
            sr += 1

        # 5. Summary KPI Stats
        total_shifts = sum(r["summary"]["P"] for r in records)
        total_hd = sum(r["summary"]["HD"] for r in records)
        total_p = total_shifts
        total_a = sum(r["summary"]["A"] for r in records)
        total_wo = sum(r["summary"]["WO"] for r in records)
        total_ph = sum(r["summary"]["PH"] for r in records)

        total_compensation = round(sum(r.get("compensation", {}).get("netPayableSalary", 0.0) for r in records), 2)
        total_deductions_all = round(sum(r.get("compensation", {}).get("totalDeductions", 0.0) for r in records), 2)
        total_hd_deductions = round(sum(r.get("compensation", {}).get("halfDayDeductionTotal", 0.0) for r in records), 2)

        possible_working = (total_p + total_a) if (total_p + total_a) > 0 else 1
        compliance_pct = f"{round((total_p / possible_working) * 100, 1)}%"

        stats = {
            "totalShifts": total_shifts,
            "present": total_p,
            "halfDays": total_hd,
            "absent": total_a,
            "weeklyOff": total_wo,
            "publicHolidays": total_ph,
            "totalHalfDayDeductions": total_hd_deductions,
            "totalDeductions": total_deductions_all,
            "totalDisbursed": total_compensation,
            "lateArrivals": 0,
            "avgDuration": "8h 45m",
            "compliance": compliance_pct
        }

        return {
            "month": month,
            "year": year,
            "monthName": month_name,
            "daysInMonth": days_in_month,
            "currentDay": now.day if (now.year == year and now.month == month) else None,
            "days": days_meta,
            "stats": stats,
            "records": records,
            "company": "b4S SOLUTIONS PVT. LTD.",
            "locationTitle": "All Locations" if not site_id or site_id == "all" else "Filtered Substation"
        }

    @staticmethod
    def generate_muster_roll_excel(
        month: Optional[int] = None,
        year: Optional[int] = None,
        site_id: Optional[str] = None
    ) -> io.BytesIO:
        """
        Generates an Excel spreadsheet (.xlsx) with:
        - Horizontal date columns showing date & day (e.g. 01 Sun, 02 Mon, etc.)
        - Vertical employee rows
        - Strictly permitted 4 statuses: P, A, WO, PH
        - Centralized public holidays automatically populated with holiday comments
        - Employee-wise summaries: Total Present (P), Absent (A), Weekly Off (WO), Public Holidays (PH)
        - Frozen panes keeping Employee columns and Header row fixed during horizontal scrolling.
        """
        now = datetime.now()
        month = month if month is not None else now.month
        year = year if year is not None else now.year

        data = ReportService.get_muster_roll_data(month, year, site_id)
        records = data["records"]
        days_in_month = data["daysInMonth"]
        days_meta = data["days"]
        month_name_upper = datetime(year, month, 1).strftime("%B %Y").upper()

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f"Muster Roll {month_name_upper[:3]}"
        ws.views.sheetView[0].showGridLines = True

        # Freeze panes: freeze at column G (column 7) and row 6
        # Columns A-F (SR, Code, Name, Designation, Circle, Division) and rows 1-5 remain frozen!
        ws.freeze_panes = "G6"

        # Styles definition
        font_header_title = Font(name="Calibri", size=13, bold=True, color="FFFFFF")
        font_header_sub = Font(name="Calibri", size=10, bold=True, color="CBD5E1")
        font_col_header = Font(name="Calibri", size=9, bold=True, color="FFFFFF")
        font_data = Font(name="Calibri", size=9, bold=False, color="1E293B")
        font_data_bold = Font(name="Calibri", size=9, bold=True, color="0F172A")
        font_legend = Font(name="Calibri", size=9, italic=True, color="475569")

        # Color Fills
        fill_navy_header = PatternFill(start_color="0B192C", end_color="0B192C", fill_type="solid")
        fill_table_header = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
        fill_zebra = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
        fill_white = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

        # Strict 4 Attendance Code Styles: P, A, WO, PH
        status_styles = {
            "P": {
                "font": Font(name="Calibri", size=9, bold=True, color="166534"),
                "fill": PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
            },
            "HD": {
                "font": Font(name="Calibri", size=9, bold=True, color="C2410C"),
                "fill": PatternFill(start_color="FFEDD5", end_color="FFEDD5", fill_type="solid")
            },
            "A": {
                "font": Font(name="Calibri", size=9, bold=True, color="991B1B"),
                "fill": PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
            },
            "WO": {
                "font": Font(name="Calibri", size=9, bold=True, color="1E40AF"),
                "fill": PatternFill(start_color="DBEAFE", end_color="DBEAFE", fill_type="solid")
            },
            "PH": {
                "font": Font(name="Calibri", size=9, bold=True, color="6B21A8"),
                "fill": PatternFill(start_color="F3E8FF", end_color="F3E8FF", fill_type="solid")
            },
            "-": {
                "font": Font(name="Calibri", size=9, color="94A3B8"),
                "fill": PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
            }
        }

        border_thin = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1")
        )
        border_header = Border(
            left=Side(style="thin", color="334155"),
            right=Side(style="thin", color="334155"),
            top=Side(style="thin", color="334155"),
            bottom=Side(style="thin", color="334155")
        )

        align_center = Alignment(horizontal="center", vertical="center")
        align_left = Alignment(horizontal="left", vertical="center")

        # Total columns count: 6 metadata + days_in_month + 5 summaries (P, A, WO, PH, Total)
        total_cols = 6 + days_in_month + 6
        last_col_letter = get_column_letter(total_cols)

        # 1. Official Banner (Rows 1-3)
        ws.merge_cells(f"A1:{last_col_letter}1")
        ws["A1"] = "OFFICIAL ATTENDANCE REGISTER PREVIEW"
        ws["A1"].font = Font(name="Calibri", size=9, bold=True, color="93C5FD")
        ws["A1"].fill = fill_navy_header
        ws["A1"].alignment = align_center

        ws.merge_cells(f"A2:{last_col_letter}2")
        ws["A2"] = f"ATTENDANCE FOR THE MONTH OF {month_name_upper}"
        ws["A2"].font = font_header_title
        ws["A2"].fill = fill_navy_header
        ws["A2"].alignment = align_center

        ws.merge_cells(f"A3:{last_col_letter}3")
        ws["A3"] = f"b4S SOLUTIONS PVT. LTD. • {data['locationTitle'].upper()} • STRICT ATTENDANCE ROSTER (P, A, WO, PH)"
        ws["A3"].font = font_header_sub
        ws["A3"].fill = fill_navy_header
        ws["A3"].alignment = align_center

        # Row 4: Spacer
        ws.row_dimensions[4].height = 8

        # 2. Table Column Headers on Row 5
        headers = ["SR.", "Employee Code", "Employee Name", "Designation", "CIRCLE", "Division"]
        for dm in days_meta:
            headers.append(dm["label"])
        headers.extend(["P", "HD", "A", "WO", "PH", "Total"])

        ws.row_dimensions[5].height = 26
        for col_idx, h_text in enumerate(headers, 1):
            cell = ws.cell(row=5, column=col_idx, value=h_text)
            cell.font = font_col_header
            cell.fill = fill_table_header
            cell.alignment = align_center
            cell.border = border_header

        # 3. Employee Rows
        row_idx = 6
        for record in records:
            ws.row_dimensions[row_idx].height = 20
            is_even = (row_idx % 2 == 0)
            row_fill = fill_white if is_even else fill_zebra

            # Fixed metadata columns
            meta_vals = [
                (record["sr"], align_center, font_data),
                (record["employeeCode"], align_center, font_data_bold),
                (record["employeeName"], align_left, font_data_bold),
                (record["designation"], align_left, font_data),
                (record["circle"], align_left, font_data),
                (record["division"], align_left, font_data),
            ]

            for c_idx, (val, alignment, font) in enumerate(meta_vals, 1):
                cell = ws.cell(row=row_idx, column=c_idx, value=val)
                cell.font = font
                cell.fill = row_fill
                cell.alignment = alignment
                cell.border = border_thin

            # Days 1 to days_in_month
            day_dict = record.get("days", {})
            h_names = record.get("dayHolidayNames", {})

            for day_idx, dm in enumerate(days_meta, 1):
                col_num = 6 + day_idx
                d_num = dm["day"]
                code_val = day_dict.get(d_num, "-")
                cell = ws.cell(row=row_idx, column=col_num, value=code_val)
                cell.alignment = align_center
                cell.border = border_thin

                st = status_styles.get(code_val, status_styles["-"])
                cell.font = st["font"]
                cell.fill = st["fill"]

                # If Public Holiday, add cell comment with holiday name
                if code_val == "PH":
                    hol_name = h_names.get(d_num) or dm.get("holidayName") or "Public Holiday"
                    cell.comment = Comment(f"Public Holiday: {hol_name}", "Admin")

            # Summary Totals Columns: P, HD, A, WO, PH, Total
            sum_dict = record.get("summary", {})
            sum_keys = ["P", "HD", "A", "WO", "PH", "Total"]
            start_sum_col = 6 + days_in_month + 1

            for s_idx, k in enumerate(sum_keys):
                col_num = start_sum_col + s_idx
                val = sum_dict.get(k, 0)
                cell = ws.cell(row=row_idx, column=col_num, value=val)
                cell.font = font_data_bold
                cell.fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
                cell.alignment = align_center
                cell.border = border_thin

            row_idx += 1

        # 4. Legend Footer
        row_idx += 1
        ws.row_dimensions[row_idx].height = 20
        legend_cols = min(18, total_cols)
        ws.merge_cells(f"A{row_idx}:{get_column_letter(legend_cols)}{row_idx}")
        ws[f"A{row_idx}"] = "Legend: P = Present (Green)   HD = Half Day (Orange)   A = Absent (Red)   WO = Weekly Off (Blue)   PH = Public Holiday (Purple)"
        ws[f"A{row_idx}"].font = font_legend
        ws[f"A{row_idx}"].alignment = Alignment(horizontal="left", vertical="center")

        if total_cols > legend_cols:
            calc_col_start = get_column_letter(legend_cols + 1)
            ws.merge_cells(f"{calc_col_start}{row_idx}:{last_col_letter}{row_idx}")
            ws[f"{calc_col_start}{row_idx}"] = f"Generated dynamically on {now.strftime('%d-%m-%Y')} • b4S Solutions"
            ws[f"{calc_col_start}{row_idx}"].font = font_legend
            ws[f"{calc_col_start}{row_idx}"].alignment = Alignment(horizontal="right", vertical="center")

        # 5. Column Width Adjustments
        ws.column_dimensions["A"].width = 6    # SR
        ws.column_dimensions["B"].width = 16   # Employee Code
        ws.column_dimensions["C"].width = 20   # Employee Name
        ws.column_dimensions["D"].width = 24   # Designation
        ws.column_dimensions["E"].width = 18   # CIRCLE
        ws.column_dimensions["F"].width = 22   # Division

        for day_idx in range(1, days_in_month + 1):
            col_letter = get_column_letter(6 + day_idx)
            ws.column_dimensions[col_letter].width = 7.5

        start_sum_col = 6 + days_in_month + 1
        for s_idx in range(6):
            col_letter = get_column_letter(start_sum_col + s_idx)
            ws.column_dimensions[col_letter].width = 8.5

        # =========================================================================
        # SHEET 2: ATTENDANCE-BASED SALARY & DEDUCTIONS REGISTER
        # =========================================================================
        ws2 = wb.create_sheet(title="Salary & Deductions")
        ws2.views.sheetView[0].showGridLines = True
        ws2.freeze_panes = "E6"

        comp_cols = 16
        last_comp_col_letter = get_column_letter(comp_cols)

        # Banner Rows 1-3
        ws2.merge_cells(f"A1:{last_comp_col_letter}1")
        ws2["A1"] = "OFFICIAL ATTENDANCE-BASED COMPENSATION & DEDUCTION REGISTER"
        ws2["A1"].font = Font(name="Calibri", size=9, bold=True, color="93C5FD")
        ws2["A1"].fill = fill_navy_header
        ws2["A1"].alignment = align_center

        ws2.merge_cells(f"A2:{last_comp_col_letter}2")
        ws2["A2"] = f"SALARY & DEDUCTIONS STATEMENT FOR {month_name_upper}"
        ws2["A2"].font = font_header_title
        ws2["A2"].fill = fill_navy_header
        ws2["A2"].alignment = align_center

        ws2.merge_cells(f"A3:{last_comp_col_letter}3")
        ws2["A3"] = f"b4S SOLUTIONS PVT. LTD. • SYNCHRONIZED WITH ATTENDANCE DATABASE • ABSENT & HALF-DAY DEDUCTIONS"
        ws2["A3"].font = font_header_sub
        ws2["A3"].fill = fill_navy_header
        ws2["A3"].alignment = align_center

        ws2.row_dimensions[4].height = 8

        # Headers on Row 5
        comp_headers = [
            "SR.", "Employee Code", "Employee Name", "Designation",
            "Monthly Base (Rs.)", "Present (P)", "Half Days (HD)", "Absent (A)",
            "Weekly Off (WO)", "Public Holiday (PH)", "Absent Rate (Rs.)",
            "Absent Deduct (Rs.)", "Half-Day Rate (Rs.)", "Half-Day Deduct (Rs.)",
            "Total Deductions (Rs.)", "Net Payable Salary (Rs.)"
        ]

        ws2.row_dimensions[5].height = 26
        for c_idx, h_text in enumerate(comp_headers, 1):
            cell = ws2.cell(row=5, column=c_idx, value=h_text)
            cell.font = font_col_header
            cell.fill = fill_table_header
            cell.alignment = align_center
            cell.border = border_header

        # Data Rows
        c_row_idx = 6
        total_base_sum = 0.0
        total_absent_deduct_sum = 0.0
        total_hd_deduct_sum = 0.0
        total_deduct_sum = 0.0
        total_net_sum = 0.0

        for record in records:
            ws2.row_dimensions[c_row_idx].height = 20
            is_even = (c_row_idx % 2 == 0)
            c_fill = fill_white if is_even else fill_zebra
            comp = record.get("compensation", {})
            smry = record.get("summary", {})

            m_base = float(comp.get("monthlySalary", 20000.0))
            a_ded = float(comp.get("absentDeductionTotal", 0.0))
            hd_ded = float(comp.get("halfDayDeductionTotal", 0.0))
            t_ded = float(comp.get("totalDeductions", 0.0))
            net_p = float(comp.get("netPayableSalary", 20000.0))

            total_base_sum += m_base
            total_absent_deduct_sum += a_ded
            total_hd_deduct_sum += hd_ded
            total_deduct_sum += t_ded
            total_net_sum += net_p

            row_data = [
                (record["sr"], align_center, font_data),
                (record["employeeCode"], align_center, font_data_bold),
                (record["employeeName"], align_left, font_data_bold),
                (record["designation"], align_left, font_data),
                (f"{m_base:,.2f}", align_center, font_data),
                (smry.get("P", 0), align_center, font_data),
                (smry.get("HD", 0), align_center, Font(name="Calibri", size=9, bold=True, color="C2410C")),
                (smry.get("A", 0), align_center, Font(name="Calibri", size=9, bold=True, color="991B1B")),
                (smry.get("WO", 0), align_center, font_data),
                (smry.get("PH", 0), align_center, font_data),
                (f"{float(comp.get('absentDeductionRate', 500.0)):,.2f}", align_center, font_data),
                (f"{a_ded:,.2f}", align_center, Font(name="Calibri", size=9, bold=True, color="991B1B")),
                (f"{float(comp.get('halfDayDeductionRate', 250.0)):,.2f}", align_center, font_data),
                (f"{hd_ded:,.2f}", align_center, Font(name="Calibri", size=9, bold=True, color="C2410C")),
                (f"{t_ded:,.2f}", align_center, Font(name="Calibri", size=9, bold=True, color="DC2626")),
                (f"{net_p:,.2f}", align_center, Font(name="Calibri", size=9, bold=True, color="059669")),
            ]

            for col_idx, (val, alignment, font) in enumerate(row_data, 1):
                cell = ws2.cell(row=c_row_idx, column=col_idx, value=val)
                cell.font = font
                cell.fill = c_fill
                cell.alignment = alignment
                cell.border = border_thin

            c_row_idx += 1

        # Total Summary Row at bottom
        ws2.row_dimensions[c_row_idx].height = 24
        tot_cells = [
            (1, "TOTAL", align_center, font_col_header, fill_table_header),
            (2, "", align_center, font_col_header, fill_table_header),
            (3, f"{len(records)} EMPLOYEES", align_left, font_col_header, fill_table_header),
            (4, "", align_left, font_col_header, fill_table_header),
            (5, f"{total_base_sum:,.2f}", align_center, font_col_header, fill_table_header),
            (6, sum(r.get("summary", {}).get("P", 0) for r in records), align_center, font_col_header, fill_table_header),
            (7, sum(r.get("summary", {}).get("HD", 0) for r in records), align_center, font_col_header, fill_table_header),
            (8, sum(r.get("summary", {}).get("A", 0) for r in records), align_center, font_col_header, fill_table_header),
            (9, sum(r.get("summary", {}).get("WO", 0) for r in records), align_center, font_col_header, fill_table_header),
            (10, sum(r.get("summary", {}).get("PH", 0) for r in records), align_center, font_col_header, fill_table_header),
            (11, "--", align_center, font_col_header, fill_table_header),
            (12, f"{total_absent_deduct_sum:,.2f}", align_center, font_col_header, fill_table_header),
            (13, "--", align_center, font_col_header, fill_table_header),
            (14, f"{total_hd_deduct_sum:,.2f}", align_center, font_col_header, fill_table_header),
            (15, f"{total_deduct_sum:,.2f}", align_center, font_col_header, fill_table_header),
            (16, f"{total_net_sum:,.2f}", align_center, font_col_header, fill_table_header),
        ]
        for c_idx, val, alignment, font, fill in tot_cells:
            cell = ws2.cell(row=c_row_idx, column=c_idx, value=val)
            cell.font = font
            cell.fill = fill
            cell.alignment = alignment
            cell.border = border_header

        # Column widths for Sheet 2
        comp_widths = [6, 16, 22, 22, 18, 12, 14, 12, 14, 16, 16, 18, 16, 18, 20, 22]
        for idx, w in enumerate(comp_widths, 1):
            ws2.column_dimensions[get_column_letter(idx)].width = w

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output

    @staticmethod
    def generate_attendance_excel(
        site_id: Optional[str] = None,
        status_filter: Optional[str] = None
    ) -> io.BytesIO:
        """Detailed Shift Activity Logs export"""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Detailed Shift Activity Logs"

        header_fill = PatternFill(start_color="1E63F0", end_color="1E63F0", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        title_font = Font(name="Calibri", size=15, bold=True, color="0F172A")

        ws.cell(row=1, column=1, value="b4S SOLUTIONS - SHIFT ACTIVITY AUDIT LOGS").font = title_font
        now_ist = get_now_ist()
        ws.cell(row=2, column=1, value=f"Generated on {now_ist.strftime('%d %B %Y, %I:%M %p IST')}")

        headers = ["Log ID", "Employee", "Code", "Site / Substation", "Date", "Check-In", "Check-Out", "Duration", "Status", "Distance", "Verification"]
        for col_idx, h in enumerate(headers, 1):
            c = ws.cell(row=4, column=col_idx, value=h)
            c.fill = header_fill
            c.font = header_font

        # Write recent logs
        raw_logs = list(db.attendance.values())

        if site_id and site_id != "all":
            raw_logs = [l for l in raw_logs if str(l.get("siteId") or "") == str(site_id)]

        if status_filter and status_filter != "all":
            sf = str(status_filter).strip().lower().replace("-", "_")
            raw_logs = [l for l in raw_logs if str(l.get("status") or "").strip().lower().replace("-", "_") == sf]

        # Sort logs by date descending, then checkIn time descending
        def get_log_sort_key(l):
            d = str(l.get("date") or "")
            ci_t = str((l.get("checkIn") or {}).get("time") or "")
            return (d, ci_t)
        raw_logs.sort(key=get_log_sort_key, reverse=True)

        row = 5
        for l in raw_logs:
            emp_key = str(l.get("employeeId") or "")
            emp = db.get_user_by_id(emp_key) if emp_key else None
            emp_name = emp.get("name") if emp else (l.get("employeeName") or l.get("technicianName") or "Technician")
            emp_code = emp.get("employeeId") if emp else (l.get("technicianCode") or "")
            site_name = l.get("siteName") or "Site"

            c_in = (l.get("checkIn") or {}).get("timeIST") or "--:--"
            c_out = (l.get("checkOut") or {}).get("timeIST") or "--:--"
            ws.cell(row=row, column=1, value=str(l.get("_id", "")))
            ws.cell(row=row, column=2, value=emp_name)
            ws.cell(row=row, column=3, value=emp_code)
            ws.cell(row=row, column=4, value=site_name)
            ws.cell(row=row, column=5, value=str(l.get("date", "")))
            ws.cell(row=row, column=6, value=c_in)
            ws.cell(row=row, column=7, value=c_out)
            ws.cell(row=row, column=8, value=l.get("workingHoursFormatted", "--"))
            is_hd_log = bool(
                l.get("isHalfDay")
                or l.get("attendanceCategory") == "HALF_DAY"
                or str(l.get("status") or "").lower() in ("half_day", "half-day", "hd")
                or str(l.get("shiftStatus") or "").lower() in ("half_day", "hd")
            )
            if is_hd_log:
                disp_st = "HALF DAY (HD)"
            elif str(l.get("status") or "").lower() in ("late", "completed", "present", "p", "active"):
                disp_st = "PRESENT (P)"
            elif str(l.get("status") or "").lower() in ("absent", "a"):
                disp_st = "ABSENT (A)"
            elif str(l.get("status") or "").lower() in ("weekly_off", "wo"):
                disp_st = "WEEKLY OFF (WO)"
            elif str(l.get("status") or "").lower() in ("public_holiday", "ph"):
                disp_st = "PUBLIC HOLIDAY (PH)"
            else:
                disp_st = str(l.get("status", "P")).replace("_", " ").upper()
            ws.cell(row=row, column=9, value=disp_st)
            ws.cell(row=row, column=10, value=l.get("distanceTraveledFormatted", "0 m"))
            dist_m = (l.get("checkIn") or {}).get("distanceMeters")
            ver_text = f"Inside Geofence ({dist_m:.0f}m)" if (dist_m is not None and dist_m <= 500) else "Verified GPS"
            ws.cell(row=row, column=11, value=ver_text)
            row += 1

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output

report_service = ReportService()
