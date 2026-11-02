import io
import calendar
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_salary_slip_pdf(slip: dict, employee: dict = None) -> bytes:
    """
    Generates an official, beautifully styled Adani Energy Solutions Limited
    monthly workforce compensation payslip PDF with attendance-based salary calculations.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    header_title_style = ParagraphStyle(
        'HeaderTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#1E3A8A'),
        alignment=0
    )

    header_sub_style = ParagraphStyle(
        'HeaderSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#475569'),
        alignment=0
    )

    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#1E3A8A'),
        spaceAfter=4
    )

    cell_bold_style = ParagraphStyle(
        'CellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1E293B')
    )

    cell_style = ParagraphStyle(
        'CellRegular',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155')
    )

    cell_right_style = ParagraphStyle(
        'CellRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155'),
        alignment=2
    )

    cell_right_bold = ParagraphStyle(
        'CellRightBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1E293B'),
        alignment=2
    )

    story = []

    period_str = slip.get('monthName') or f"{slip.get('month', 10)}/{slip.get('year', 2026)}"
    ref_no = slip.get('referenceNumber') or f"ADN-PAY-{slip.get('year', 2026)}{slip.get('month', 10):02d}-{slip.get('employeeId', 'EMP').replace('/', '-')}"
    status_text = str(slip.get('status', 'FINALIZED')).upper()

    status_color = '#059669' if status_text in ('FINALIZED', 'PAID') else ('#2563EB' if status_text == 'REVISED' else '#D97706')

    # 1. Header with Adani branding
    header_data = [
        [
            Paragraph("<b>ADANI ENERGY SOLUTIONS LIMITED</b>", header_title_style),
            Paragraph(f"<b>SALARY STATEMENT / PAYSLIP</b><br/><font color='#64748B'>Period: {period_str}</font><br/><font color='#64748B' size='8'>Ref: {ref_no}</font>", ParagraphStyle('RHead', parent=styles['Normal'], fontName='Helvetica', fontSize=9, alignment=2, textColor=colors.HexColor('#0F172A')))
        ],
        [
            Paragraph("Smart Grid Operations • Substation Workforce Division<br/>Adani Corporate House, Shantigram, S.G. Highway, Ahmedabad, Gujarat 382421", header_sub_style),
            Paragraph(f"Status: <b><font color='{status_color}'>{status_text}</font></b>", ParagraphStyle('RStatus', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, alignment=2, textColor=colors.HexColor(status_color)))
        ]
    ]
    t_header = Table(header_data, colWidths=[340, 180])
    t_header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 10))

    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1E3A8A'), spaceAfter=10))

    # 2. Employee Details Grid
    emp_name = slip.get('employeeName') or (employee.get('name') if employee else 'Field Technician')
    emp_id = slip.get('employeeId') or (employee.get('employeeId') if employee else 'b4S/Adani/01')
    designation = slip.get('designation') or (employee.get('designation') if employee else 'Smart Meter Technician')
    department = slip.get('department') or (employee.get('department') if employee else 'Smart Meter Operations')
    circle = slip.get('circle') or (employee.get('circle') if employee else '') or ''
    division = slip.get('division') or (employee.get('division') if employee else '') or ''

    emp_data = [
        [
            Paragraph("<b>Employee Name:</b>", cell_bold_style),
            Paragraph(emp_name, cell_style),
            Paragraph("<b>Employee ID:</b>", cell_bold_style),
            Paragraph(emp_id, cell_style),
        ],
        [
            Paragraph("<b>Designation:</b>", cell_bold_style),
            Paragraph(designation, cell_style),
            Paragraph("<b>Department:</b>", cell_bold_style),
            Paragraph(department, cell_style),
        ],
        [
            Paragraph("<b>Circle / Division:</b>", cell_bold_style),
            Paragraph(f"{circle} / {division}", cell_style),
            Paragraph("<b>Payroll Month:</b>", cell_bold_style),
            Paragraph(f"{period_str}", cell_style),
        ],
    ]
    t_emp = Table(emp_data, colWidths=[110, 150, 110, 150])
    t_emp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_emp)
    story.append(Spacer(1, 14))

    # 3. Attendance Summary Section
    story.append(Paragraph("<b>Attendance Summary (Centralized Real-Time Records)</b>", section_title_style))

    pres_days = slip.get('presentDays', 25)
    abs_days = slip.get('absentDays', 2)
    hd_days = slip.get('halfDays', 2)
    wo_days = slip.get('weeklyOffDays', 4)
    ph_days = slip.get('publicHolidayDays', 1)
    tot_days = slip.get('totalCalendarDays') or (pres_days + abs_days + wo_days + ph_days)

    att_summary_data = [
        [
            Paragraph("<b>Category</b>", cell_bold_style),
            Paragraph("<b>Days Count</b>", cell_right_bold),
            Paragraph("<b>Salary Impact</b>", cell_style)
        ],
        [
            Paragraph("P – Present (Full Days Worked)", cell_style),
            Paragraph(str(max(0, pres_days - hd_days)), cell_right_style),
            Paragraph("Full salary for the day (No deduction)", cell_style)
        ],
        [
            Paragraph("Half Day (Partial Shift < 8 hrs)", cell_style),
            Paragraph(str(hd_days), cell_right_style),
            Paragraph("Configured half-day deduction applied", cell_style)
        ],
        [
            Paragraph("A – Absent (Unauthorized / No Check-in)", cell_style),
            Paragraph(str(abs_days), cell_right_style),
            Paragraph("Configured absent deduction applied", cell_style)
        ],
        [
            Paragraph("WO – Weekly Off (Scheduled Sundays)", cell_style),
            Paragraph(str(wo_days), cell_right_style),
            Paragraph("Paid weekly off (No deduction)", cell_style)
        ],
        [
            Paragraph("PH – Public Holiday (Gazetted)", cell_style),
            Paragraph(str(ph_days), cell_right_style),
            Paragraph("Paid holiday (No deduction)", cell_style)
        ],
        [
            Paragraph("<b>Total Calendar Days in Month</b>", cell_bold_style),
            Paragraph(f"<b>{tot_days} Days</b>", cell_right_bold),
            Paragraph("<b>Total Payable Days: " + str(slip.get('payableDays', pres_days + wo_days + ph_days)) + " Days</b>", cell_bold_style)
        ]
    ]

    t_att = Table(att_summary_data, colWidths=[200, 100, 220])
    t_att.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#EFF6FF')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#F1F5F9')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_att)
    story.append(Spacer(1, 14))

    # 4. Salary & Deduction Calculation Section
    story.append(Paragraph("<b>Salary & Deduction Calculation</b>", section_title_style))

    monthly_sal = float(slip.get('monthlySalary') or slip.get('earnings', {}).get('grossEarnings') or 20000.0)
    daily_rate = float(slip.get('dailySalaryRate') or round(monthly_sal / float(tot_days or 30), 2))
    abs_rate = float(slip.get('absentDeductionRate', 500.0))
    hd_rate = float(slip.get('halfDayDeductionRate', 250.0))

    abs_total = float(slip.get('absentDeductionTotal', abs_days * abs_rate))
    hd_total = float(slip.get('halfDayDeductionTotal', hd_days * hd_rate))
    tot_ded = float(slip.get('totalDeductionAmount', abs_total + hd_total))
    net_pay = float(slip.get('netPay', max(0.0, monthly_sal - tot_ded)))

    calc_data = [
        [
            Paragraph("<b>Description</b>", cell_bold_style),
            Paragraph("<b>Calculation Basis</b>", cell_style),
            Paragraph("<b>Amount (INR)</b>", cell_right_bold)
        ],
        [
            Paragraph("<b>Monthly Assigned Base Salary</b>", cell_bold_style),
            Paragraph(f"Per-day Rate: Rs. {daily_rate:,.2f} ({tot_days} calendar days)", cell_style),
            Paragraph(f"<b>Rs. {monthly_sal:,.2f}</b>", cell_right_bold)
        ],
        [
            Paragraph("Absent Deduction", cell_style),
            Paragraph(f"{abs_days} Absent Day(s) × Rs. {abs_rate:,.2f} / day", cell_style),
            Paragraph(f"- Rs. {abs_total:,.2f}", cell_right_style)
        ],
        [
            Paragraph("Half-Day Deduction", cell_style),
            Paragraph(f"{hd_days} Half Day(s) × Rs. {hd_rate:,.2f} / day", cell_style),
            Paragraph(f"- Rs. {hd_total:,.2f}", cell_right_style)
        ],
        [
            Paragraph("<b>Total Salary Deductions</b>", cell_bold_style),
            Paragraph("Cumulative absent + half-day attendance penalties", cell_style),
            Paragraph(f"<b><font color='#DC2626'>- Rs. {tot_ded:,.2f}</font></b>", cell_right_bold)
        ],
        [
            Paragraph("<b>FINAL PAYABLE SALARY (NET TAKE-HOME)</b>", ParagraphStyle('NetLbl', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, textColor=colors.HexColor('#065F46'))),
            Paragraph("Monthly Salary minus Attendance Deductions", ParagraphStyle('NetSub', parent=styles['Normal'], fontName='Helvetica', fontSize=8, textColor=colors.HexColor('#065F46'))),
            Paragraph(f"<b><font size='11' color='#059669'>Rs. {net_pay:,.2f}</font></b>", ParagraphStyle('NetVal', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=11, alignment=2, textColor=colors.HexColor('#059669')))
        ]
    ]

    t_calc = Table(calc_data, colWidths=[200, 180, 140])
    t_calc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#EFF6FF')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#ECFDF5')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_calc)
    story.append(Spacer(1, 14))

    # 5. Verification & Audit Trail Footer
    finalized_by = slip.get('finalizedBy') or 'Operations Administrator'
    finalized_at = slip.get('finalizedAt') or datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')
    notes = slip.get('notes') or 'Verified against centralized GPS radar attendance records.'

    audit_text = f"<b>Statement Verification & Audit:</b> Verified by {finalized_by} on {finalized_at}.<br/>" \
                 f"<b>Remarks:</b> {notes}<br/>" \
                 "<i>This is a computer-generated official compensation statement authorized by Adani Energy Solutions Limited. No physical signature is required.</i>"

    story.append(Paragraph(audit_text, ParagraphStyle('AuditText', parent=styles['Normal'], fontName='Helvetica', fontSize=8, leading=11, textColor=colors.HexColor('#64748B'))))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def generate_holidays_pdf(year: int = 2026) -> bytes:
    """
    Generates an official Adani Energy Solutions Limited official holiday calendar PDF.
    """
    from app.core.database import db

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    header_title_style = ParagraphStyle(
        'HolidayHeaderTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0F172A'),
        alignment=0
    )

    header_sub_style = ParagraphStyle(
        'HolidayHeaderSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#64748B'),
        alignment=0
    )

    cell_bold_style = ParagraphStyle(
        'HolidayCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1E293B')
    )

    cell_style = ParagraphStyle(
        'HolidayCellRegular',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155')
    )

    story = []

    # 1. Header
    header_data = [
        [
            Paragraph(f"<b>ADANI ENERGY SOLUTIONS LIMITED</b>", header_title_style),
            Paragraph(f"<b>OFFICIAL HOLIDAY CALENDAR {year}</b><br/><font color='#64748B'>Workforce Operations & Payroll</font>", ParagraphStyle('RHeadHol', parent=styles['Normal'], fontName='Helvetica', fontSize=9, alignment=2, textColor=colors.HexColor('#0F172A')))
        ],
        [
            Paragraph("Smart Grid Operations • Transmission & Distribution Infrastructure<br/>Adani Corporate House, Shantigram, Ahmedabad, Gujarat 382421", header_sub_style),
            Paragraph("Circular: <b><font color='#1E63F0'>AESL/HR/CAL-2026</font></b>", ParagraphStyle('RCirHol', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, alignment=2, textColor=colors.HexColor('#1E63F0')))
        ]
    ]
    t_header = Table(header_data, colWidths=[360, 160])
    t_header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1E63F0'), spaceAfter=14))

    # 2. Executive Policy Banner
    policy_data = [
        [
            Paragraph("<b>WORKFORCE REST DAYS & HOLIDAY COMPENSATION POLICY:</b><br/><font size=8 color='#1E293B'>1. All Sundays are scheduled <b>Paid Weekly Offs</b>. Attendance check-in is not required on Sundays.<br/>2. All gazetted holidays listed below are <b>Fully Paid Official Holidays</b> across all Adani substation circles.<br/>3. Field technicians on critical grid standby during a holiday are entitled to compensatory off.</font>", cell_style)
        ]
    ]
    t_policy = Table(policy_data, colWidths=[520])
    t_policy.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#EFF6FF')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#BFDBFE')),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_policy)
    story.append(Spacer(1, 14))

    # 3. Holidays Table
    db_holidays = db.get_all_holidays(year=year)
    holidays_list = []
    if db_holidays:
        for h in db_holidays:
            raw_date = h.get("date", "")
            try:
                dt = datetime.strptime(raw_date, "%Y-%m-%d")
                d_str = dt.strftime("%d %b %Y")
                day_str = h.get("day") or dt.strftime("%A")
            except Exception:
                d_str = raw_date
                day_str = h.get("day", "")
            name_str = h.get("name", "Public Holiday")
            type_str = h.get("type", "Gazetted")
            paid_str = "Paid Holiday / Sunday" if day_str == "Sunday" else "Paid Holiday"
            holidays_list.append((d_str, day_str, name_str, type_str, paid_str))
    if not holidays_list:
        holidays_list = [
            ("26 Jan 2026", "Monday", "Republic Day", "National Gazetted", "Paid Holiday"),
            ("15 Feb 2026", "Sunday", "Maha Shivaratri", "Gazetted", "Paid Holiday / Sunday"),
            ("03 Mar 2026", "Tuesday", "Holi (Dhulivandan)", "Gazetted", "Paid Holiday"),
            ("20 Mar 2026", "Friday", "Eid-ul-Fitr (Ramzan Eid)", "Gazetted", "Paid Holiday"),
            ("14 Apr 2026", "Tuesday", "Dr. Ambedkar Jayanti", "Gazetted", "Paid Holiday"),
            ("01 May 2026", "Friday", "Maharashtra / Gujarat Day", "Regional Gazetted", "Paid Holiday"),
            ("15 Aug 2026", "Saturday", "Independence Day", "National Gazetted", "Paid Holiday"),
            ("04 Sep 2026", "Friday", "Janmashtami (Gokulashtami)", "Gazetted", "Paid Holiday"),
            ("02 Oct 2026", "Friday", "Mahatma Gandhi Jayanti", "National Gazetted", "Paid Holiday"),
            ("20 Oct 2026", "Tuesday", "Dussehra (Vijayadashami)", "Gazetted", "Paid Holiday"),
            ("08 Nov 2026", "Sunday", "Diwali (Deepavali Laxmi Pujan)", "Gazetted", "Paid Holiday / Sunday"),
            ("09 Nov 2026", "Monday", "Diwali Balipratipada", "Gazetted", "Paid Holiday"),
            ("25 Dec 2026", "Friday", "Christmas Day", "Gazetted", "Paid Holiday"),
        ]

    table_data = [
        [
            Paragraph("<b>DATE</b>", cell_bold_style),
            Paragraph("<b>DAY</b>", cell_bold_style),
            Paragraph("<b>HOLIDAY / OCCASION</b>", cell_bold_style),
            Paragraph("<b>CLASSIFICATION</b>", cell_bold_style),
            Paragraph("<b>COMPENSATION STATUS</b>", cell_bold_style),
        ]
    ]

    for d_str, day_str, name_str, type_str, paid_str in holidays_list:
        table_data.append([
            Paragraph(f"<b>{d_str}</b>", cell_bold_style),
            Paragraph(day_str, cell_style),
            Paragraph(f"<b>{name_str}</b>", cell_bold_style),
            Paragraph(type_str, cell_style),
            Paragraph(f"<font color='#059669'><b>{paid_str}</b></font>", cell_style),
        ])

    t_holidays = Table(table_data, colWidths=[85, 75, 175, 95, 90])
    t_holidays.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#FFFFFF'), colors.HexColor('#F8FAFC')]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_holidays)
    story.append(Spacer(1, 16))

    footer_data = [
        [
            Paragraph("<b>Issued by:</b><br/>Head of Human Resources & Corporate Operations<br/>Adani Energy Solutions Limited", cell_style),
            Paragraph("<b>Approved by:</b><br/>Director - Power & Transmission Grid Infrastructure<br/>Adani Group", ParagraphStyle('FRightHol', parent=cell_style, alignment=2))
        ]
    ]
    t_footer = Table(footer_data, colWidths=[260, 260])
    t_footer.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,0), 1, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_footer)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()

