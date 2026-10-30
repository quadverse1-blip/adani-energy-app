import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.database import db
from app.core.security import get_current_user_token, require_roles
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse

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
            shiftStatus=emp.get("shiftStatus", "present")
        ))
    return results

@router.get("/{employeeId}", response_model=EmployeeResponse)
async def get_employee(
    employeeId: str,
    token_data: dict = Depends(get_current_user_token)
):
    emp = db.get_employee(employeeId) or db.find_employee_by_identifier(employeeId)
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
        shiftStatus=emp.get("shiftStatus", "present")
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
    assigned_primary = emp_in.assignedSiteIds[0] if emp_in.assignedSiteIds else None
    
    new_emp = {
        "_id": new_id,
        "employeeId": emp_in.employeeId,
        "name": emp_in.name,
        "phone": emp_in.phone,
        "password": emp_in.password,
        "role": emp_in.role,
        "designation": emp_in.designation,
        "assignedSiteIds": emp_in.assignedSiteIds,
        "assignedSiteId": assigned_primary,
        "status": emp_in.status or "active",
        "email": emp_in.email or f"{emp_in.employeeId.lower().replace('/', '.')}@adani.com",
        "department": emp_in.department or "Smart Meter Operations",
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
        "circle": emp_in.circle,
        "division": emp_in.division,
        "latitude": emp_in.latitude,
        "longitude": emp_in.longitude,
        "locationName": emp_in.locationName,
        "shiftStatus": emp_in.shiftStatus or "present"
    }
    db.employees[new_id] = new_emp
    return EmployeeResponse(id=new_id, **new_emp)

@router.put("/{employeeId}", response_model=EmployeeResponse)
async def update_employee(
    employeeId: str,
    emp_in: EmployeeUpdate,
    token_data: dict = Depends(require_roles(["admin", "supervisor"]))
):
    emp = db.get_employee(employeeId) or db.find_employee_by_identifier(employeeId)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_dict = emp_in.dict(exclude_unset=True)
    if "assignedSiteId" in update_dict and update_dict["assignedSiteId"]:
        emp["assignedSiteId"] = update_dict["assignedSiteId"]
    elif "assignedSiteIds" in update_dict and update_dict["assignedSiteIds"]:
        emp["assignedSiteId"] = update_dict["assignedSiteIds"][0]
        
    emp.update(update_dict)
    db.employees[emp["_id"]] = emp

    return EmployeeResponse(id=emp["_id"], **emp)

@router.delete("/{employeeId}")
async def delete_employee(
    employeeId: str,
    token_data: dict = Depends(require_roles(["admin"]))
):
    emp = db.get_employee(employeeId) or db.find_employee_by_identifier(employeeId)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    del db.employees[emp["_id"]]
    return {"message": "Employee record removed"}

@router.post("/{employeeId}/reset-password")
async def admin_reset_password(
    employeeId: str,
    token_data: dict = Depends(require_roles(["admin"]))
):
    emp = db.get_employee(employeeId) or db.find_employee_by_identifier(employeeId)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp["password"] = "Adani@2026"
    return {"message": "Temporary password reset to Adani@2026"}
