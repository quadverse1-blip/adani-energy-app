import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.database import db
from app.core.security import get_current_user_token, require_roles
from app.schemas.site import SiteCreate, SiteUpdate, SiteResponse

router = APIRouter(prefix="/sites", tags=["Substations"])

@router.get("", response_model=List[SiteResponse])
async def list_sites(token_data: dict = Depends(get_current_user_token)):
    user_role = str(token_data.get("role", "technician")).lower()
    raw_sites = db.get_all_sites()
    
    # Requirement: Employees should only see the sites assigned to them.
    # If explicit sites are assigned, strictly filter to them. If none assigned yet, allow operational sites.
    if user_role == "technician":
        emp_id = token_data.get("id")
        emp = db.get_employee(emp_id) or db.find_employee_by_identifier(emp_id)
        if emp:
            assigned_ids = set()
            if emp.get("assignedSiteId"):
                assigned_ids.add(str(emp["assignedSiteId"]))
            for s_id in emp.get("assignedSiteIds", []):
                assigned_ids.add(str(s_id))
            if assigned_ids:
                raw_sites = [s for s in raw_sites if str(s.get("_id")) in assigned_ids or str(s.get("id")) in assigned_ids]

    response = []
    emp = None
    if user_role == "technician":
        emp_id = token_data.get("id")
        emp = db.get_employee(emp_id) or db.find_employee_by_identifier(emp_id)
        
    for s in raw_sites:
        site_assignments = emp.get("siteAssignments") or {} if emp else {}
        specific_assign = site_assignments.get(str(s["_id"])) or {}
        assigned_by = specific_assign.get("assignedBy") or (emp.get("assignedBy") if emp else None)
        assigned_by_phone = specific_assign.get("assignedByPhone") or (emp.get("assignedByPhone") if emp else None)
        assigned_by_role = specific_assign.get("assignedByRole") or (emp.get("assignedByRole") if emp else None)
        assigned_at = specific_assign.get("assignedAt") or (emp.get("assignedAt") if emp else None)
        if not assigned_by and s.get("manager"):
            assigned_by = s["manager"].get("name")
            assigned_by_phone = s["manager"].get("phone")
            assigned_by_role = "supervisor"

        response.append(SiteResponse(
            id=s["_id"],
            name=s["name"],
            code=s["code"],
            address=s.get("address"),
            latitude=s["latitude"],
            longitude=s["longitude"],
            radiusMeters=s.get("radiusMeters", 500.0),
            voltageClass=s.get("voltageClass"),
            manager=s.get("manager"),
            photoUrl=s.get("photoUrl"),
            activeEngineersCount=s.get("activeEngineersCount", 0),
            workingHours=s.get("workingHours"),
            status=s.get("status", "active"),
            assignedBy=assigned_by,
            assignedByPhone=assigned_by_phone,
            assignedByRole=assigned_by_role,
            assignedAt=assigned_at
        ))
    return response

@router.get("/{siteId}", response_model=SiteResponse)
async def get_site_details(siteId: str, token_data: dict = Depends(get_current_user_token)):
    user_role = str(token_data.get("role", "technician")).lower()
    emp = None
    if user_role == "technician":
        emp_id = token_data.get("id")
        emp = db.get_employee(emp_id) or db.find_employee_by_identifier(emp_id)
        if emp:
            assigned_ids = set()
            if emp.get("assignedSiteId"):
                assigned_ids.add(str(emp["assignedSiteId"]))
            for s_id in emp.get("assignedSiteIds", []):
                assigned_ids.add(str(s_id))
            if siteId not in assigned_ids:
                raise HTTPException(status_code=403, detail="You do not have permission to view unassigned substations.")
        else:
            raise HTTPException(status_code=403, detail="No substation assignment found for your profile.")

    s = db.get_site(siteId)
    if not s:
        raise HTTPException(status_code=404, detail="Substation not found")

    site_assignments = emp.get("siteAssignments") or {} if emp else {}
    specific_assign = site_assignments.get(str(s["_id"])) or {}
    assigned_by = specific_assign.get("assignedBy") or (emp.get("assignedBy") if emp else None)
    assigned_by_phone = specific_assign.get("assignedByPhone") or (emp.get("assignedByPhone") if emp else None)
    assigned_by_role = specific_assign.get("assignedByRole") or (emp.get("assignedByRole") if emp else None)
    assigned_at = specific_assign.get("assignedAt") or (emp.get("assignedAt") if emp else None)
    if not assigned_by and s.get("manager"):
        assigned_by = s["manager"].get("name")
        assigned_by_phone = s["manager"].get("phone")
        assigned_by_role = "supervisor"

    return SiteResponse(
        id=s["_id"],
        name=s["name"],
        code=s["code"],
        address=s.get("address"),
        latitude=s["latitude"],
        longitude=s["longitude"],
        radiusMeters=s.get("radiusMeters", 500.0),
        voltageClass=s.get("voltageClass"),
        manager=s.get("manager"),
        photoUrl=s.get("photoUrl"),
        activeEngineersCount=s.get("activeEngineersCount", 0),
        workingHours=s.get("workingHours"),
        status=s.get("status", "active"),
        assignedBy=assigned_by,
        assignedByPhone=assigned_by_phone,
        assignedByRole=assigned_by_role,
        assignedAt=assigned_at
    )

@router.post("", response_model=SiteResponse)
async def create_site(
    site_in: SiteCreate,
    token_data: dict = Depends(require_roles(["admin", "supervisor"]))
):
    site_id = f"site_{uuid.uuid4().hex[:8]}"
    new_site = {
        "_id": site_id,
        "name": site_in.name,
        "code": site_in.code,
        "address": site_in.address,
        "latitude": site_in.latitude,
        "longitude": site_in.longitude,
        "radiusMeters": site_in.radiusMeters,
        "voltageClass": site_in.voltageClass or None,
        "manager": site_in.manager.dict() if site_in.manager else None,
        "photoUrl": site_in.photoUrl or None,
        "activeEngineersCount": 0,
        "workingHours": site_in.workingHours or None,
        "status": site_in.status or "active"
    }
    db.sites[site_id] = new_site
    db.set_firestore_document("sites", site_id, new_site)
    return SiteResponse(id=site_id, **new_site)

@router.put("/{siteId}", response_model=SiteResponse)
async def update_site(
    siteId: str,
    site_in: SiteUpdate,
    token_data: dict = Depends(require_roles(["admin", "supervisor"]))
):
    s = db.get_site(siteId)
    if not s:
        raise HTTPException(status_code=404, detail="Substation not found")
    
    update_data = site_in.dict(exclude_unset=True)
    if "manager" in update_data and update_data["manager"]:
        update_data["manager"] = update_data["manager"]
        
    s.update(update_data)
    db.sites[s["_id"]] = s
    db.set_firestore_document("sites", s["_id"], s)
    return SiteResponse(id=s["_id"], **s)

@router.delete("/{siteId}")
async def delete_site(
    siteId: str,
    token_data: dict = Depends(require_roles(["admin"]))
):
    s = db.get_site(siteId)
    if s:
        doc_id = s.get("_id") or siteId
        if doc_id in db.sites:
            del db.sites[doc_id]
        if hasattr(db, "delete_firestore_document_async"):
            db.delete_firestore_document_async("sites", doc_id)
        return {"message": "Substation deleted successfully"}
    raise HTTPException(status_code=404, detail="Substation not found")
