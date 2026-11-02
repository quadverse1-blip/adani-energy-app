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
    # Employees must not see other employees' assigned sites.
    if user_role == "technician":
        emp_id = token_data.get("id")
        emp = db.get_employee(emp_id) or db.find_employee_by_identifier(emp_id)
        if emp:
            assigned_ids = set()
            if emp.get("assignedSiteId"):
                assigned_ids.add(str(emp["assignedSiteId"]))
            for s_id in emp.get("assignedSiteIds", []):
                assigned_ids.add(str(s_id))
            raw_sites = [s for s in raw_sites if str(s.get("_id")) in assigned_ids or str(s.get("id")) in assigned_ids]
        else:
            raw_sites = []

    response = []
    for s in raw_sites:
        response.append(SiteResponse(
            id=s["_id"],
            name=s["name"],
            code=s["code"],
            address=s["address"],
            latitude=s["latitude"],
            longitude=s["longitude"],
            radiusMeters=s.get("radiusMeters", 500.0),
            voltageClass=s.get("voltageClass", "220 kV GIS"),
            manager=s.get("manager", {"name": "Manager", "phone": "", "email": ""}),
            photoUrl=s.get("photoUrl"),
            activeEngineersCount=s.get("activeEngineersCount", 0),
            workingHours=s.get("workingHours", "09:00 AM - 06:00 PM"),
            status=s.get("status", "active")
        ))
    return response

@router.get("/{siteId}", response_model=SiteResponse)
async def get_site_details(siteId: str, token_data: dict = Depends(get_current_user_token)):
    user_role = str(token_data.get("role", "technician")).lower()
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
    return SiteResponse(
        id=s["_id"],
        name=s["name"],
        code=s["code"],
        address=s["address"],
        latitude=s["latitude"],
        longitude=s["longitude"],
        radiusMeters=s.get("radiusMeters", 500.0),
        voltageClass=s.get("voltageClass", "220 kV GIS"),
        manager=s.get("manager", {"name": "Manager", "phone": "", "email": ""}),
        photoUrl=s.get("photoUrl"),
        activeEngineersCount=s.get("activeEngineersCount", 0),
        workingHours=s.get("workingHours", "09:00 AM - 06:00 PM"),
        status=s.get("status", "active")
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
        "voltageClass": site_in.voltageClass or "220 kV GIS",
        "manager": site_in.manager.dict(),
        "photoUrl": site_in.photoUrl or "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80",
        "activeEngineersCount": 0,
        "workingHours": site_in.workingHours or "09:00 AM - 06:00 PM",
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
    if siteId in db.sites:
        del db.sites[siteId]
        return {"message": "Substation deleted successfully"}
    raise HTTPException(status_code=404, detail="Substation not found")
