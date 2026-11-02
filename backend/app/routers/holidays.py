from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel, Field

from app.core.database import db

router = APIRouter(prefix="/holidays", tags=["Holidays"])

class HolidayCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Holiday name (e.g. Republic Day)")
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Date in YYYY-MM-DD format")
    description: Optional[str] = Field("", description="Optional notes or details")
    type: Optional[str] = Field("Gazetted", description="National Gazetted, Gazetted, Regional, etc.")

class HolidayUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    description: Optional[str] = None
    type: Optional[str] = None

@router.get("")
@router.get("/")
async def list_holidays(year: Optional[int] = Query(None, description="Optional year filter")):
    """
    Returns all centralized holidays from the master database.
    """
    holidays = db.get_all_holidays(year=year)
    return {
        "status": "success",
        "total": len(holidays),
        "year": year,
        "holidays": holidays
    }

@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_holiday(payload: HolidayCreate):
    """
    Adds a new public holiday to the centralized holiday table.
    Enforces uniqueness of date to prevent duplicate holidays.
    """
    date_str = payload.date.strip()
    # Check date validity
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Expected YYYY-MM-DD."
        )

    # Check for existing holiday on the same date
    existing = db.get_holiday_by_date(date_str)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A holiday already exists for {date_str}: '{existing.get('name')}'"
        )

    weekday_name = dt.strftime("%A")
    holiday_id = f"hol_{date_str.replace('-', '_')}"

    new_holiday = {
        "_id": holiday_id,
        "name": payload.name.strip(),
        "date": date_str,
        "day": weekday_name,
        "description": (payload.description or "").strip(),
        "type": payload.type or "Gazetted",
        "status": "active",
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "updatedAt": datetime.utcnow().isoformat() + "Z"
    }

    saved = db.save_holiday(new_holiday)
    return {
        "status": "success",
        "message": f"Holiday '{payload.name}' on {date_str} added successfully.",
        "holiday": saved
    }

@router.get("/{holiday_id}")
async def get_holiday(holiday_id: str):
    h = db.get_holiday_by_id(holiday_id)
    if not h:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holiday not found")
    return {"status": "success", "holiday": h}

@router.put("/{holiday_id}")
async def update_holiday(holiday_id: str, payload: HolidayUpdate):
    """
    Updates an existing holiday record.
    """
    existing = db.get_holiday_by_id(holiday_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holiday not found")

    updated = dict(existing)
    if payload.name is not None:
        updated["name"] = payload.name.strip()
    if payload.description is not None:
        updated["description"] = payload.description.strip()
    if payload.type is not None:
        updated["type"] = payload.type.strip()

    if payload.date is not None:
        new_date_str = payload.date.strip()
        try:
            dt = datetime.strptime(new_date_str, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Expected YYYY-MM-DD."
            )
        # Check duplicate if date changed
        if new_date_str != existing.get("date"):
            conflict = db.get_holiday_by_date(new_date_str)
            if conflict and conflict.get("_id") != holiday_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Another holiday already exists for {new_date_str}: '{conflict.get('name')}'"
                )
            updated["date"] = new_date_str
            updated["day"] = dt.strftime("%A")

    updated["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    saved = db.save_holiday(updated)
    return {
        "status": "success",
        "message": "Holiday updated successfully.",
        "holiday": saved
    }

@router.delete("/{holiday_id}")
async def delete_holiday(holiday_id: str):
    """
    Deletes a holiday from the centralized holiday table.
    """
    existing = db.get_holiday_by_id(holiday_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holiday not found")

    deleted = db.delete_holiday(holiday_id)
    return {
        "status": "success",
        "message": f"Holiday '{existing.get('name')}' deleted successfully."
    }
