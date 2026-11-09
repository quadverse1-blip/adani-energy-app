import urllib.parse
import uuid
import re
from datetime import datetime
from io import BytesIO, StringIO
import csv
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, Response
from app.core.database import db
from app.core.security import get_current_user_token, require_roles, get_password_hash
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    BulkEmployeeItem,
    BulkUploadResponse
)

router = APIRouter(prefix="/employees", tags=["Employees"])

@router.get("", response_model=List[EmployeeResponse])
async def list_employees(
    search: Optional[str] = None,
    role: Optional[str] = None,
    status_filter: Optional[str] = None,
    token_data: dict = Depends(require_roles(["admin", "supervisor"]))
):
    raw_employees = db.get_all_employees()
    results = []
    
    for emp in raw_employees:
        if role and emp.get("role") != role:
            continue
        if status_filter and emp.get("status") != status_filter:
            continue
        if search:
            s = search.lower()
            name_match = s in emp.get("name", "").lower()
            id_match = s in emp.get("employeeId", "").lower()
            phone_match = s in emp.get("phone", "").lower()
            if not (name_match or id_match or phone_match):
                continue
                
        results.append(EmployeeResponse(
            id=emp["_id"],
            employeeId=emp.get("employeeId", ""),
            name=emp.get("name", ""),
            phone=emp.get("phone", ""),
            role=emp.get("role", "technician"),
            designation=emp.get("designation", "Field Technician"),
            assignedSiteIds=emp.get("assignedSiteIds", []),
            assignedSiteId=emp.get("assignedSiteId"),
            status=emp.get("status", "active"),
            email=emp.get("email"),
            department=emp.get("department"),
            avatar=emp.get("avatar"),
            circle=emp.get("circle"),
            division=emp.get("division"),
            latitude=emp.get("latitude"),
            longitude=emp.get("longitude"),
            locationName=emp.get("locationName"),
            shiftStatus=emp.get("shiftStatus", "present"),
            assignedBy=emp.get("assignedBy"),
            assignedByPhone=emp.get("assignedByPhone"),
            assignedByRole=emp.get("assignedByRole"),
            assignedAt=emp.get("assignedAt")
        ))
    return results


def normalize_dict_keys(d: dict) -> dict:
    normalized = {}
    for k, v in d.items():
        if k is None or v is None:
            continue
        lk = str(k).strip().lower().replace("_", " ").replace("-", " ")
        val_str = str(v).strip()
        if lk in ["employee name", "name", "emp name", "fullname", "full name"]:
            normalized["name"] = val_str
        elif lk in ["employee id", "employeeid", "emp id", "empid", "id", "code"]:
            normalized["employeeId"] = val_str
        elif lk in ["mobile number", "mobile no", "mobile", "phone number", "phonenumber", "phone", "contact", "contact no"]:
            normalized["phone"] = val_str
        elif lk in ["password", "pass", "pwd"]:
            normalized["password"] = val_str
        elif lk in ["designation", "job title", "role title", "title"]:
            normalized["designation"] = val_str
        elif lk in ["circle", "zone"]:
            normalized["circle"] = val_str
        elif lk in ["division", "subdivision"]:
            normalized["division"] = val_str
        elif lk in ["role", "user role"]:
            normalized["role"] = val_str
        elif lk in ["assigned sites", "assigned site", "site id", "site", "assignedsiteids", "assignedsiteid"]:
            normalized["assignedSiteIds"] = val_str
        elif lk in ["email", "email address"]:
            normalized["email"] = val_str
        elif lk in ["department"]:
            normalized["department"] = val_str
    return normalized

def process_bulk_employee_records(
    records: List[dict],
    default_site_id: Optional[str] = None
) -> BulkUploadResponse:
    added = 0
    updated = 0
    errors = []
    processed_emps = []

    seen_ids = set()
    seen_phones = set()

    for idx, r in enumerate(records, start=2):
        raw_name = str(r.get("name") or "").strip()
        raw_emp_id = str(r.get("employeeId") or "").strip()
        raw_phone = str(r.get("phone") or "").strip()
        raw_pwd = str(r.get("password") or "").strip()
        raw_desig = str(r.get("designation") or "").strip()
        raw_circle = str(r.get("circle") or "").strip()
        raw_div = str(r.get("division") or "").strip()

        if not raw_name and not raw_emp_id and not raw_phone:
            continue

        if not raw_name:
            errors.append(f"Row {idx}: Employee Name is required.")
            continue
        if not raw_emp_id:
            errors.append(f"Row {idx}: Employee ID is required.")
            continue
        if not raw_phone:
            errors.append(f"Row {idx} ({raw_emp_id}): Mobile Number is required.")
            continue
        if not raw_pwd:
            errors.append(f"Row {idx} ({raw_emp_id}): Password is required.")
            continue

        # In-file duplicate validation
        norm_emp_id = raw_emp_id.upper()
        if norm_emp_id in seen_ids:
            errors.append(f"Row {idx}: Duplicate Employee ID '{raw_emp_id}' in uploaded file.")
            continue
        seen_ids.add(norm_emp_id)

        # Clean phone
        phone_clean = raw_phone.replace(" ", "").replace("-", "")
        if phone_clean.startswith("+91"):
            phone_clean = phone_clean[3:]
        elif phone_clean.startswith("91") and len(phone_clean) > 10:
            phone_clean = phone_clean[2:]

        if phone_clean in seen_phones:
            errors.append(f"Row {idx}: Duplicate Mobile Number '{raw_phone}' in uploaded file.")
            continue
        seen_phones.add(phone_clean)

        # Inferred Role from Designation or explicit Role
        explicit_role = str(r.get("role") or "").strip().lower()
        if explicit_role in ["supervisor", "admin", "technician"]:
            role = explicit_role
        else:
            desig_lower = raw_desig.lower()
            if any(k in desig_lower for k in ["supervisor", "manager", "lead", "in-charge"]):
                role = "supervisor"
            elif "admin" in desig_lower:
                role = "admin"
            else:
                role = "technician"

        designation = raw_desig or (
            "Zonal Workforce Supervisor" if role == "supervisor"
            else ("Operations Admin" if role == "admin" else "Field Smart Meter Technician")
        )

        assigned_site_ids = []
        raw_sites = r.get("assignedSiteIds")
        if isinstance(raw_sites, list):
            assigned_site_ids = [str(s).strip() for s in raw_sites if str(s).strip()]
        elif isinstance(raw_sites, str) and raw_sites.strip():
            assigned_site_ids = [s.strip() for s in re.split(r"[,;]+", raw_sites) if s.strip()]

        if not assigned_site_ids and default_site_id:
            assigned_site_ids = [default_site_id]

        primary_site = assigned_site_ids[0] if assigned_site_ids else None

        # Check existing employee by employeeId or phone
        existing = db.find_employee_by_identifier(raw_emp_id) or db.find_employee_by_identifier(phone_clean)
        
        # Store securely with hash (verify_password checks both bcrypt & plain)
        hashed_pwd = get_password_hash(raw_pwd)

        if existing:
            emp_id = existing["_id"]
            existing["employeeId"] = raw_emp_id
            existing["name"] = raw_name
            existing["phone"] = phone_clean
            existing["password"] = hashed_pwd
            existing["role"] = role
            existing["designation"] = designation
            if raw_circle:
                existing["circle"] = raw_circle
            if raw_div:
                existing["division"] = raw_div
            if assigned_site_ids:
                existing["assignedSiteIds"] = assigned_site_ids
                existing["assignedSiteId"] = primary_site
            existing["status"] = "active"

            db.employees[emp_id] = existing
            if hasattr(db, "_raw_employees"):
                db._raw_employees[emp_id] = existing
            db.set_firestore_document("employees", emp_id, existing)
            updated += 1
            processed_emps.append({
                "id": emp_id,
                "employeeId": raw_emp_id,
                "name": raw_name,
                "phone": phone_clean,
                "role": role,
                "status": "updated"
            })
        else:
            new_id = f"emp_{uuid.uuid4().hex[:8]}"
            new_emp = {
                "_id": new_id,
                "employeeId": raw_emp_id,
                "name": raw_name,
                "phone": phone_clean,
                "password": hashed_pwd,
                "role": role,
                "designation": designation,
                "circle": raw_circle or None,
                "division": raw_div or None,
                "assignedSiteIds": assigned_site_ids,
                "assignedSiteId": primary_site,
                "status": "active",
                "email": r.get("email") or None,
                "department": r.get("department") or None,
                "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
                "shiftStatus": "present"
            }
            db.employees[new_id] = new_emp
            if hasattr(db, "_raw_employees"):
                db._raw_employees[new_id] = new_emp
            db.set_firestore_document("employees", new_id, new_emp)
            added += 1
            processed_emps.append({
                "id": new_id,
                "employeeId": raw_emp_id,
                "name": raw_name,
                "phone": phone_clean,
                "role": role,
                "status": "added"
            })

    total = added + updated
    return BulkUploadResponse(
        success=True,
        totalRows=total + len(errors),
        addedCount=added,
        updatedCount=updated,
        errorCount=len(errors),
        errors=errors,
        message=f"Successfully processed {total} employee(s): {added} added, {updated} updated.",
        employees=processed_emps
    )

@router.get("/bulk-template")
async def download_bulk_template(
    token_data: dict = Depends(require_roles(["admin", "supervisor"]))
):
    """Generates and downloads an Excel template with standard columns for bulk upload."""
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Employees"

    headers = [
        "Employee Name",
        "Employee ID",
        "Mobile Number",
        "Password",
        "Designation",
        "Circle",
        "Division"
    ]
    ws.append(headers)

    # 3 standard sample rows representing Adani workforce
    ws.append(["Amit Verma", "ADN-TECH-01", "9876543211", "Adani@123", "Field Smart Meter Technician", "Ahmedabad", "North Division"])
    ws.append(["Priya Patel", "ADN-TECH-02", "9876543212", "Pass@2026", "Senior Field Technician", "Surat", "City Division"])
    ws.append(["Suresh Patil", "ADN-SUP-01", "9876543213", "Super@2026", "Zonal Workforce Supervisor", "Ahmedabad", "North Division"])

    # Header styling (Adani Deep Navy Blue fill with bold white text)
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    # Format sample cells
    sample_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    for row_idx in range(2, 5):
        for col_idx in range(1, len(headers) + 1):
            c = ws.cell(row=row_idx, column=col_idx)
            c.border = thin_border
            c.alignment = Alignment(horizontal="left", vertical="center")
            if row_idx % 2 == 0:
                c.fill = sample_fill

    # Set column widths
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        letter = get_column_letter(col[0].column)
        ws.column_dimensions[letter].width = max(max_len + 4, 16)

    bio = BytesIO()
    wb.save(bio)
    bio.seek(0)

    return Response(
        content=bio.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="Adani_Bulk_Employees_Template.xlsx"'
        }
    )

@router.post("/bulk-upload", response_model=BulkUploadResponse)
async def bulk_upload_employees(
    file: UploadFile = File(...),
    defaultSiteId: Optional[str] = Form(None),
    token_data: dict = Depends(require_roles(["admin"]))
):
    """Parses uploaded Excel (.xlsx, .xls) or CSV file and creates/updates employee records."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    filename = (file.filename or "").lower()
    records = []

    if filename.endswith(".csv") or file.content_type == "text/csv":
        text_stream = StringIO(content.decode("utf-8-sig", errors="ignore"))
        reader = csv.DictReader(text_stream)
        for row in reader:
            records.append(normalize_dict_keys(row))
    else:
        import openpyxl
        try:
            wb = openpyxl.load_workbook(BytesIO(content), data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            if not rows or len(rows) < 2:
                raise HTTPException(status_code=400, detail="Excel file must contain a header row and at least 1 employee row.")

            header_row = [str(h).strip() if h is not None else "" for h in rows[0]]
            for row_vals in rows[1:]:
                if not any(v is not None and str(v).strip() for v in row_vals):
                    continue
                row_dict = {}
                for h, val in zip(header_row, row_vals):
                    if h:
                        row_dict[h] = str(val).strip() if val is not None else ""
                records.append(normalize_dict_keys(row_dict))
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")

    if not records:
        raise HTTPException(status_code=400, detail="No valid employee rows found in file.")

    return process_bulk_employee_records(records, default_site_id=defaultSiteId)

@router.post("/bulk-import-json", response_model=BulkUploadResponse)
async def bulk_import_employees_json(
    items: List[BulkEmployeeItem],
    defaultSiteId: Optional[str] = None,
    token_data: dict = Depends(require_roles(["admin"]))
):
    """Accepts JSON list of employee items for bulk creation/update."""
    dict_records = [item.dict() for item in items]
    return process_bulk_employee_records(dict_records, default_site_id=defaultSiteId)

@router.get("/{employeeId:path}", response_model=EmployeeResponse)
async def get_employee(
    employeeId: str,
    token_data: dict = Depends(get_current_user_token)
):
    clean_id = urllib.parse.unquote(employeeId)
    emp = db.get_employee(clean_id) or db.find_employee_by_identifier(clean_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    return EmployeeResponse(
        id=emp["_id"],
        employeeId=emp.get("employeeId", ""),
        name=emp.get("name", ""),
        phone=emp.get("phone", ""),
        role=emp.get("role", "technician"),
        designation=emp.get("designation", "Field Technician"),
        assignedSiteIds=emp.get("assignedSiteIds", []),
        assignedSiteId=emp.get("assignedSiteId"),
        status=emp.get("status", "active"),
        email=emp.get("email"),
        department=emp.get("department"),
        avatar=emp.get("avatar"),
        circle=emp.get("circle"),
        division=emp.get("division"),
        latitude=emp.get("latitude"),
        longitude=emp.get("longitude"),
        locationName=emp.get("locationName"),
        shiftStatus=emp.get("shiftStatus", "present"),
        assignedBy=emp.get("assignedBy"),
        assignedByPhone=emp.get("assignedByPhone"),
        assignedByRole=emp.get("assignedByRole"),
        assignedAt=emp.get("assignedAt")
    )

@router.post("", response_model=EmployeeResponse)
async def create_employee(
    emp_in: EmployeeCreate,
    token_data: dict = Depends(require_roles(["admin"]))
):
    # Check if duplicate ID
    if db.find_employee_by_identifier(emp_in.employeeId):
        raise HTTPException(status_code=400, detail="Employee ID already exists")

    new_id = f"emp_{uuid.uuid4().hex[:8]}"
    assigned_ids = emp_in.assignedSiteIds or []
    assigned_primary = assigned_ids[0] if assigned_ids else None
    
    # Resolve dynamic assigner details from logged-in profile
    assigner_id = token_data.get("id") or token_data.get("employeeId") or token_data.get("sub")
    assigner = None
    if assigner_id:
        assigner = db.get_user_by_id(assigner_id) or db.get_employee(assigner_id) or db.find_employee_by_identifier(assigner_id)
    if not assigner and token_data.get("employeeId"):
        assigner = db.get_employee(token_data["employeeId"]) or db.find_employee_by_identifier(token_data["employeeId"])

    assigner_role = (assigner.get("role") if assigner else None) or token_data.get("role") or "admin"
    default_name = assigner.get("name") if assigner else None
    assigner_name = (assigner.get("name") if assigner else None) or token_data.get("name") or default_name
    assigner_phone = (assigner.get("phone") or assigner.get("mobileNumber") if assigner else None) or token_data.get("phone") or None
    now_iso = datetime.utcnow().isoformat()

    new_emp = {
        "_id": new_id,
        "employeeId": emp_in.employeeId,
        "name": emp_in.name,
        "phone": emp_in.phone,
        "password": emp_in.password,
        "role": emp_in.role,
        "designation": emp_in.designation,
        "assignedSiteIds": assigned_ids,
        "assignedSiteId": assigned_primary,
        "status": emp_in.status or "active",
        "email": emp_in.email or None,
        "department": emp_in.department or None,
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
        "circle": emp_in.circle,
        "division": emp_in.division,
        "latitude": emp_in.latitude,
        "longitude": emp_in.longitude,
        "locationName": emp_in.locationName,
        "shiftStatus": emp_in.shiftStatus or "present",
        "assignedBy": assigner_name if assigned_ids else None,
        "assignedByPhone": assigner_phone if assigned_ids else None,
        "assignedByRole": assigner_role if assigned_ids else None,
        "assignedById": assigner_id if assigned_ids else None,
        "assignedAt": now_iso if assigned_ids else None,
        "siteAssignments": {
            str(s_id): {
                "siteId": str(s_id),
                "assignedBy": assigner_name,
                "assignedByPhone": assigner_phone,
                "assignedByRole": assigner_role,
                "assignedById": assigner_id,
                "assignedAt": now_iso
            } for s_id in assigned_ids
        }
    }
    db.employees[new_id] = new_emp
    db.set_firestore_document("employees", new_id, new_emp)
    return EmployeeResponse(id=new_id, **new_emp)

@router.put("/{employeeId:path}", response_model=EmployeeResponse)
async def update_employee(
    employeeId: str,
    emp_in: EmployeeUpdate,
    token_data: dict = Depends(require_roles(["admin", "supervisor"]))
):
    clean_id = urllib.parse.unquote(employeeId)
    emp = db.get_employee(clean_id) or db.find_employee_by_identifier(clean_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_dict = emp_in.dict(exclude_unset=True)
    
    # Update base fields
    emp.update(update_dict)

    # Handle assigned sites synchronization
    if "assignedSiteId" in update_dict or "assignedSiteIds" in update_dict:
        primary_site = update_dict.get("assignedSiteId")
        site_ids = list(update_dict.get("assignedSiteIds") or [])
        if primary_site and primary_site not in site_ids:
            site_ids = [primary_site] + site_ids
        elif not primary_site and site_ids:
            primary_site = site_ids[0]
        emp["assignedSiteId"] = primary_site
        emp["assignedSiteIds"] = site_ids

        # Dynamically fetch assigner details from logged-in admin or supervisor profile
        assigner_id = token_data.get("id") or token_data.get("employeeId") or token_data.get("sub")
        assigner = None
        if assigner_id:
            assigner = db.get_user_by_id(assigner_id) or db.get_employee(assigner_id) or db.find_employee_by_identifier(assigner_id)
        if not assigner and token_data.get("employeeId"):
            assigner = db.get_employee(token_data["employeeId"]) or db.find_employee_by_identifier(token_data["employeeId"])

        assigner_role = (assigner.get("role") if assigner else None) or token_data.get("role") or "supervisor"
        default_name = "Anita Sharma" if assigner_role == "admin" else "Supervisor"
        assigner_name = (assigner.get("name") if assigner else None) or token_data.get("name") or default_name
        assigner_phone = (assigner.get("phone") or assigner.get("mobileNumber") if assigner else None) or token_data.get("phone") or None
        now_iso = datetime.utcnow().isoformat()

        if site_ids or primary_site:
            emp["assignedBy"] = assigner_name
            emp["assignedByPhone"] = assigner_phone
            emp["assignedByRole"] = assigner_role
            emp["assignedById"] = assigner_id
            emp["assignedAt"] = now_iso
            
            if "siteAssignments" not in emp or not isinstance(emp.get("siteAssignments"), dict):
                emp["siteAssignments"] = {}
            # Prune unassigned/removed sites from siteAssignments
            emp["siteAssignments"] = {
                k: v for k, v in emp["siteAssignments"].items()
                if k in [str(x) for x in site_ids]
            }
            for s_id in site_ids:
                if str(s_id) not in emp["siteAssignments"]:
                    emp["siteAssignments"][str(s_id)] = {
                        "siteId": str(s_id),
                        "assignedBy": assigner_name,
                        "assignedByPhone": assigner_phone,
                        "assignedByRole": assigner_role,
                        "assignedById": assigner_id,
                        "assignedAt": now_iso
                    }
        else:
            emp["assignedBy"] = None
            emp["assignedByPhone"] = None
            emp["assignedByRole"] = None
            emp["assignedById"] = None
            emp["assignedAt"] = None
            emp["siteAssignments"] = {}

    # Update site details if primary assigned
    if emp.get("assignedSiteId"):
        s = db.get_site(emp["assignedSiteId"])
        if s:
            emp["assignedSiteName"] = s.get("name")
            if not update_dict.get("latitude") and s.get("latitude"):
                emp["latitude"] = s["latitude"]
            if not update_dict.get("longitude") and s.get("longitude"):
                emp["longitude"] = s["longitude"]
            if not update_dict.get("locationName") and (s.get("address") or s.get("name")):
                emp["locationName"] = s.get("address") or s.get("name")
    else:
        emp["assignedSiteName"] = None
        emp["assignedSiteId"] = None
        emp["assignedSiteIds"] = []

    # Centralized Attendance Synchronization: Link Admin Employee Attendance
    if "shiftStatus" in update_dict and update_dict["shiftStatus"]:
        try:
            from app.routers.attendance import _process_admin_attendance_update
            from app.utils.datetime_utils import get_today_ist_str
            st_val = str(update_dict["shiftStatus"]).strip()
            actor_name = token_data.get("name", "Operations Admin")
            _process_admin_attendance_update(
                employee_id=emp["_id"],
                date_str=get_today_ist_str(),
                status_input=st_val,
                admin_remarks=f"Marked {st_val} via Employee Attendance Management by {actor_name}",
                actor_name=actor_name
            )
        except Exception as err:
            logger.warning(f"Notice: Failed to auto-sync today attendance on employee shiftStatus update: {err}")

    db.employees[emp["_id"]] = emp
    if hasattr(db, "_raw_employees"):
        db._raw_employees[emp["_id"]] = emp
    db.set_firestore_document("employees", emp["_id"], emp)

    return EmployeeResponse(id=emp["_id"], **emp)

@router.delete("/{employeeId:path}")
async def delete_employee(
    employeeId: str,
    token_data: dict = Depends(require_roles(["admin"]))
):
    clean_id = urllib.parse.unquote(employeeId)
    emp = db.get_employee(clean_id) or db.find_employee_by_identifier(clean_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    del db.employees[emp["_id"]]
    return {"message": "Employee record removed"}

@router.post("/{employeeId:path}/reset-password")
async def admin_reset_password(
    employeeId: str,
    token_data: dict = Depends(require_roles(["admin"]))
):
    clean_id = urllib.parse.unquote(employeeId)
    emp = db.get_employee(clean_id) or db.find_employee_by_identifier(clean_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp["password"] = "Adani@2026"
    return {"message": "Temporary password reset to Adani@2026"}
