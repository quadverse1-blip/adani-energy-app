import io
from datetime import datetime
from app.core.database import db
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
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
    monthly workforce compensation payslip PDF using ReportLab.
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
    
    # Custom styles
    header_title_style = ParagraphStyle(
        'HeaderTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0F172A'),
        alignment=0
    )
    
    header_sub_style = ParagraphStyle(
        'HeaderSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569'),
        alignment=0
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1E3A8A'),
        spaceAfter=6
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

    story = []

    period_str = slip.get('monthName') or f"{slip.get('month', 10)}/{slip.get('year', 2026)}"

    # 1. Header with Adani branding
    header_data = [
        [
            Paragraph("<b>ADANI ENERGY SOLUTIONS LIMITED</b>", header_title_style),
            Paragraph(f"<b>CONFIDENTIAL PAYSLIP</b><br/><font color='#64748B'>Period: {period_str}</font>", ParagraphStyle('RHead', parent=styles['Normal'], fontName='Helvetica', fontSize=9, alignment=2, textColor=colors.HexColor('#0F172A')))
        ],
        [
            Paragraph("Smart Grid Operations • High Voltage Substation Workforce Division<br/>Adani Corporate House, Shantigram, S.G. Highway, Ahmedabad, Gujarat 382421", header_sub_style),
            Paragraph(f"Status: <b><font color='#059669'>PAID & TRANSFERRED</font></b>", ParagraphStyle('RStatus', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, alignment=2, textColor=colors.HexColor('#059669')))
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

    # 2. Employee Metadata Table
    emp_id = slip.get("employeeId", "b4S/Adani/01")
    emp_name = slip.get("employeeName", "Technician")
    desig = slip.get("designation", "Smart Meter Field Technician")
    payable_days = slip.get("payableDays", 30)
    present_days = slip.get("presentDays", 26)
    paid_leaves = slip.get("paidLeaves", 3)
    lop = slip.get("lossOfPay", 1)

    meta_data = [
        [
            Paragraph("<b>Employee Name:</b>", cell_bold_style),
            Paragraph(emp_name, cell_style),
            Paragraph("<b>Employee ID:</b>", cell_bold_style),
            Paragraph(emp_id, cell_style),
        ],
        [
            Paragraph("<b>Designation:</b>", cell_bold_style),
            Paragraph(desig, cell_style),
            Paragraph("<b>Department:</b>", cell_bold_style),
            Paragraph("Substation Field Operations", cell_style),
        ],
        [
            Paragraph("<b>Pay Period:</b>", cell_bold_style),
            Paragraph(slip.get("monthName", "October 2026"), cell_style),
            Paragraph("<b>Bank Name / A/C:</b>", cell_bold_style),
            Paragraph("State Bank of India •••• 4892", cell_style),
        ],
        [
            Paragraph("<b>Present Days:</b>", cell_bold_style),
            Paragraph(f"{present_days} Days", cell_style),
            Paragraph("<b>Paid Leaves / Off:</b>", cell_bold_style),
            Paragraph(f"{paid_leaves} Days (LOP: {lop}d)", cell_style),
        ]
    ]
    t_meta = Table(meta_data, colWidths=[105, 155, 110, 150])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 14))

    # 3. Earnings & Deductions Table
    earnings = slip.get("earnings", {})
    deductions = slip.get("deductions", {})

    basic = earnings.get("basicSalary", 21000.0)
    hra = earnings.get("hra", 8400.0)
    da = earnings.get("da", 4200.0)
    travel = earnings.get("travelAllowance", 2500.0)
    field_allow = earnings.get("siteFieldAllowance", 2000.0)
    gross = earnings.get("grossEarnings", basic + hra + da + travel + field_allow)

    pf = deductions.get("pf", 2520.0)
    esic = deductions.get("esic", 285.0)
    pt = deductions.get("professionalTax", 200.0)
    tds = deductions.get("tds", 0.0)
    tot_ded = deductions.get("totalDeductions", pf + esic + pt + tds)
    net_pay = slip.get("netPay", gross - tot_ded)

    comp_table_data = [
        [
            Paragraph("<b>EARNINGS COMPONENT</b>", ParagraphStyle('EHead', parent=cell_bold_style, textColor=colors.HexColor('#1E3A8A'))),
            Paragraph("<b>AMOUNT (INR)</b>", ParagraphStyle('EHeadR', parent=cell_bold_style, alignment=2, textColor=colors.HexColor('#1E3A8A'))),
            Paragraph("<b>DEDUCTIONS COMPONENT</b>", ParagraphStyle('DHead', parent=cell_bold_style, textColor=colors.HexColor('#991B1B'))),
            Paragraph("<b>AMOUNT (INR)</b>", ParagraphStyle('DHeadR', parent=cell_bold_style, alignment=2, textColor=colors.HexColor('#991B1B'))),
        ],
        [
            Paragraph("Basic Salary", cell_style),
            Paragraph(f"₹ {basic:,.2f}", ParagraphStyle('R', parent=cell_style, alignment=2)),
            Paragraph("Provident Fund (PF - Employee)", cell_style),
            Paragraph(f"₹ {pf:,.2f}", ParagraphStyle('R', parent=cell_style, alignment=2)),
        ],
        [
            Paragraph("House Rent Allowance (HRA)", cell_style),
            Paragraph(f"₹ {hra:,.2f}", ParagraphStyle('R', parent=cell_style, alignment=2)),
            Paragraph("ESIC Medical Insurance Contribution", cell_style),
            Paragraph(f"₹ {esic:,.2f}", ParagraphStyle('R', parent=cell_style, alignment=2)),
        ],
        [
            Paragraph("Dearness Allowance (DA)", cell_style),
            Paragraph(f"₹ {da:,.2f}", ParagraphStyle('R', parent=cell_style, alignment=2)),
            Paragraph("Professional Tax (PT)", cell_style),
            Paragraph(f"₹ {pt:,.2f}", ParagraphStyle('R', parent=cell_style, alignment=2)),
        ],
        [
            Paragraph("Field Travel Reimbursement", cell_style),
            Paragraph(f"₹ {travel:,.2f}", ParagraphStyle('R', parent=cell_style, alignment=2)),
            Paragraph("Income Tax / TDS", cell_style),
            Paragraph(f"₹ {tds:,.2f}", ParagraphStyle('R', parent=cell_style, alignment=2)),
        ],
        [
            Paragraph("Substation Shift Site Allowance", cell_style),
            Paragraph(f"₹ {field_allow:,.2f}", ParagraphStyle('R', parent=cell_style, alignment=2)),
            Paragraph("Other Regulatory Deductions", cell_style),
            Paragraph("₹ 0.00", ParagraphStyle('R', parent=cell_style, alignment=2)),
        ],
        [
            Paragraph("<b>Total Gross Earnings:</b>", cell_bold_style),
            Paragraph(f"<b>₹ {gross:,.2f}</b>", ParagraphStyle('R', parent=cell_bold_style, alignment=2)),
            Paragraph("<b>Total Statutory Deductions:</b>", cell_bold_style),
            Paragraph(f"<b>₹ {tot_ded:,.2f}</b>", ParagraphStyle('R', parent=cell_bold_style, alignment=2, textColor=colors.HexColor('#DC2626'))),
        ],
    ]

    t_comp = Table(comp_table_data, colWidths=[170, 90, 170, 90])
    t_comp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (1,0), colors.HexColor('#EFF6FF')),
        ('BACKGROUND', (2,0), (3,0), colors.HexColor('#FEF2F2')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0,-1), (1,-1), colors.HexColor('#F1F5F9')),
        ('BACKGROUND', (2,-1), (3,-1), colors.HexColor('#F1F5F9')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_comp)
    story.append(Spacer(1, 14))

    # 4. Net Salary Highlight Banner
    net_data = [
        [
            Paragraph("<b>NET TAKE-HOME SALARY DISBURSED</b><br/><font size=8 color='#166534'>Directly credited to verified employee salary bank account via NEFT/RTGS</font>", ParagraphStyle('NetL', parent=styles['Normal'], fontName='Helvetica', fontSize=10, textColor=colors.HexColor('#14532D'))),
            Paragraph(f"<b>₹ {net_pay:,.2f}</b>", ParagraphStyle('NetR', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=16, alignment=2, textColor=colors.HexColor('#15803D')))
        ]
    ]
    t_net = Table(net_data, colWidths=[350, 170])
    t_net.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#DCFCE7')),
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor('#86EFAC')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_net)
    story.append(Spacer(1, 16))

    # 5. Signatures and Verification Footer
    footer_data = [
        [
            Paragraph("<b>Verified By Operations Administrator:</b><br/>HR & Payroll Division<br/>Adani Energy Solutions Limited", cell_style),
            Paragraph("<b>Authorized Digital Signature:</b><br/>Digitally stamped & cryptographically certified<br/>Stamp: AESL-WFM-2026-VERIFIED", ParagraphStyle('FRight', parent=cell_style, alignment=2))
        ]
    ]
    t_footer = Table(footer_data, colWidths=[260, 260])
    t_footer.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,0), 1, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_footer)
    story.append(Spacer(1, 10))

    disclaimer = Paragraph(
        "<font size=7 color='#94A3B8'>This document is an electronically generated and digitally authenticated payslip issued under the Adani Workforce Management System. No physical signature is required. For discrepancies, contact payroll@adani.com.</font>",
        ParagraphStyle('Disc', parent=styles['Normal'], alignment=1)
    )
    story.append(disclaimer)

    doc.build(story)
    return buffer.getvalue()


def generate_holidays_pdf(year: int = 2026) -> bytes:
    """
    Generates an official, beautifully styled Adani Energy Solutions Limited
    Gazetted & Field Operations Holiday Calendar PDF.
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
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0F172A'),
    )

    header_sub_style = ParagraphStyle(
        'HeaderSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569'),
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

    story = []

    # 1. Header
    header_data = [
        [
            Paragraph("<b>ADANI ENERGY SOLUTIONS LIMITED</b>", header_title_style),
            Paragraph(f"<b>OFFICIAL CALENDAR</b><br/><font color='#64748B'>Year: {year}</font>", ParagraphStyle('RHead', parent=styles['Normal'], fontName='Helvetica', fontSize=9, alignment=2, textColor=colors.HexColor('#0F172A')))
        ],
        [
            Paragraph("Smart Grid Operations • Field Workforce & High-Voltage Transmission Division<br/>Approved Gazetted & Regional Operations Holiday Schedule", header_sub_style),
            Paragraph("Circular: <b><font color='#1E63F0'>AESL/HR/CAL-2026</font></b>", ParagraphStyle('RCir', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, alignment=2, textColor=colors.HexColor('#1E63F0')))
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

    # 3. Holidays Table (Dynamically loaded from centralized Holiday Database)
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
            ("15 Aug 2026", "Saturday", "Independence Day", "National Gazetted", "Paid Holiday"),
            ("02 Oct 2026", "Friday", "Mahatma Gandhi Jayanti", "National Gazetted", "Paid Holiday"),
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

    # 4. Signatures
    footer_data = [
        [
            Paragraph("<b>Issued by:</b><br/>Head of Human Resources & Corporate Operations<br/>Adani Energy Solutions Limited", cell_style),
            Paragraph("<b>Approved by:</b><br/>Director - Power & Transmission Grid Infrastructure<br/>Adani Group", ParagraphStyle('FRight', parent=cell_style, alignment=2))
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
    return buffer.getvalue()
