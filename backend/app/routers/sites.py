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
    raw_sites = [
        s for s in db.get_all_sites()
        if s and s.get("status", "active") != "deleted"
        and str(s.get("_id") or "") not in db._deleted_site_ids
        and str(s.get("id") or "") not in db._deleted_site_ids
        and str(s.get("code") or "").lower() not in db._deleted_site_ids
    ]
    
    # Requirement: Employees should only see the sites assigned to them.
    # If no sites are assigned (or assigned site was removed), employee must see 0 sites.
    if user_role == "technician":
        emp_id = token_data.get("id")
        emp = db.get_employee(emp_id) or db.find_employee_by_identifier(emp_id)
        if emp:
            assigned_ids = set()
            if emp.get("assignedSiteId"):
                s_obj = db.get_site(str(emp["assignedSiteId"]))
                if s_obj and s_obj.get("status", "active") != "deleted":
                    assigned_ids.add(str(emp["assignedSiteId"]))
                    if s_obj.get("_id"):
                        assigned_ids.add(str(s_obj["_id"]))
                    if s_obj.get("id"):
                        assigned_ids.add(str(s_obj["id"]))
            for s_id in emp.get("assignedSiteIds", []):
                if s_id:
                    s_obj = db.get_site(str(s_id))
                    if s_obj and s_obj.get("status", "active") != "deleted":
                        assigned_ids.add(str(s_id))
                        if s_obj.get("_id"):
                            assigned_ids.add(str(s_obj["_id"]))
                        if s_obj.get("id"):
                            assigned_ids.add(str(s_obj["id"]))

            raw_sites = [
                s for s in raw_sites 
                if (str(s.get("_id")) in assigned_ids or str(s.get("id")) in assigned_ids)
            ]
        else:
            raw_sites = []

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

def _cascade_unlink_deleted_site(doc_id: str, site_id: str):
    try:
        for emp_id, emp in list(db.employees.items()):
            modified = False
            if emp.get("assignedSiteIds"):
                old_ids = [str(x) for x in emp["assignedSiteIds"]]
                if doc_id in old_ids or str(site_id) in old_ids:
                    new_ids = [x for x in old_ids if x != doc_id and x != str(site_id)]
                    emp["assignedSiteIds"] = new_ids
                    modified = True

            cur_assigned = str(emp.get("assignedSiteId") or "")
            if cur_assigned == doc_id or cur_assigned == str(site_id):
                remaining = emp.get("assignedSiteIds") or []
                if remaining:
                    next_id = remaining[0]
                    emp["assignedSiteId"] = next_id
                    nxt_s = db.get_site(next_id)
                    emp["assignedSiteName"] = nxt_s.get("name") if nxt_s else None
                else:
                    emp["assignedSiteId"] = None
                    emp["assignedSiteName"] = None
                modified = True

            if isinstance(emp.get("siteAssignments"), dict):
                for k in [doc_id, str(site_id)]:
                    if k in emp["siteAssignments"]:
                        del emp["siteAssignments"][k]
                        modified = True

            if modified:
                db.employees[emp_id] = emp
                if hasattr(db, "set_firestore_document_async"):
                    db.set_firestore_document_async("employees", emp.get("_id") or emp_id, emp)
                elif hasattr(db, "set_firestore_document"):
                    db.set_firestore_document("employees", emp.get("_id") or emp_id, emp)
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").warning(f"Error in cascade unlinking deleted site: {e}")

@router.delete("/{siteId}")
async def delete_site(
    siteId: str,
    token_data: dict = Depends(require_roles(["admin", "supervisor"]))
):
    import threading
    s = db.get_site(siteId)
    if not s:
        raise HTTPException(status_code=404, detail="Substation not found")

    doc_id = str(s.get("_id") or s.get("id") or siteId)

    # 1. Permanently record deletion in database memory layer
    s["status"] = "deleted"
    db.record_deleted_site(doc_id)
    db.record_deleted_site(str(siteId))

    if doc_id in db.sites:
        del db.sites[doc_id]
    if str(siteId) in db.sites:
        del db.sites[str(siteId)]
    if hasattr(db, "_raw_sites"):
        db._raw_sites.pop(doc_id, None)
        db._raw_sites.pop(str(siteId), None)

    # 2. Asynchronously delete from Firestore
    if hasattr(db, "set_firestore_document_async"):
        db.set_firestore_document_async("sites", doc_id, {"_id": doc_id, "status": "deleted"})
    if hasattr(db, "delete_firestore_document_async"):
        db.delete_firestore_document_async("sites", doc_id)

    # 3. Non-blocking background thread to cascade unlinking across all employees
    threading.Thread(
        target=_cascade_unlink_deleted_site,
        args=(doc_id, str(siteId)),
        daemon=True
    ).start()

    return {"message": "Substation deleted successfully", "id": doc_id}
