import os
import json
import logging
import threading
from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional
import requests
from app.core.config import settings

logger = logging.getLogger("database")

# Seed initial dataset representing Adani Smart Meter Infrastructure
SEED_SITES = [
    {
        "_id": "site_surat_01",
        "name": "Surat ST-1",
        "code": "ADN-SITE-010",
        "address": "Ring Road, Textile Market Hub, Surat, Gujarat 395002",
        "voltageClass": "66 kV Substation & Smart Feeder",
        "location": {
            "type": "Point",
            "coordinates": [72.7997, 21.1926]
        },
        "latitude": 21.1926,
        "longitude": 72.7997,
        "radiusMeters": 500,
        "manager": {
            "name": "Dhaval Patel",
            "designation": "Zonal Project Lead",
            "phone": "+91 98251 98765",
            "email": "dhaval.patel@adani.com",
            "photoUrl": "https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=400&q=80"
        },
        "photoUrl": "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80",
        "activeEngineersCount": 10,
        "workingHours": "09:00 AM - 06:00 PM",
        "status": "active"
    },
    {
        "_id": "site_st_joseph",
        "name": "st. joseph university",
        "code": "ADN-SITE-006",
        "address": "36 Lalbagh Main Rd, Shanti Nagar, Bengaluru, Karnataka 560027",
        "voltageClass": "33 kV Substation & Smart Meter Feeder",
        "location": {
            "type": "Point",
            "coordinates": [77.5963, 12.9610]
        },
        "latitude": 12.9610,
        "longitude": 77.5963,
        "radiusMeters": 500,
        "manager": {
            "name": "Father Victor",
            "designation": "Campus Facility Director",
            "phone": "+91 98450 12345",
            "email": "facilities@sju.edu.in",
            "photoUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"
        },
        "photoUrl": "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=800&q=80",
        "activeEngineersCount": 6,
        "status": "active"
    },
    {
        "_id": "site_pune_01",
        "name": "Pune - Phase 1",
        "code": "ADN-PS-001",
        "address": "Hinjawadi Phase 1, Near Tata T-Hub, Pune, Maharashtra 411057",
        "voltageClass": "220 kV GIS Substation",
        "location": {
            "type": "Point",
            "coordinates": [73.857, 18.520]
        },
        "latitude": 18.520,
        "longitude": 73.857,
        "radiusMeters": 500,
        "manager": {
            "name": "Sunil Shinde",
            "designation": "Executive Grid Manager",
            "phone": "+91 98220 12345",
            "email": "sunil.shinde@adani.com",
            "photoUrl": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80"
        },
        "photoUrl": "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80",
        "activeEngineersCount": 8,
        "status": "active"
    },
    {
        "_id": "site_pune_02",
        "name": "Pune - Phase 2",
        "code": "ADN-PS-002",
        "address": "EON Free Zone Rd, Kharadi, Pune, Maharashtra 411014",
        "voltageClass": "132 kV AIS Substation",
        "location": {
            "type": "Point",
            "coordinates": [73.787, 18.550]
        },
        "latitude": 18.550,
        "longitude": 73.787,
        "radiusMeters": 500,
        "manager": {
            "name": "Rajeev Nambiar",
            "designation": "Area Technical Lead",
            "phone": "+91 98220 12346",
            "email": "rajeev.n@adani.com",
            "photoUrl": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80"
        },
        "photoUrl": "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80",
        "activeEngineersCount": 6,
        "status": "active"
    },
    {
        "_id": "site_mumbai_01",
        "name": "Mumbai - Central Hub",
        "code": "ADN-MH-001",
        "address": "MIDC Central Road, Andheri East, Mumbai, Maharashtra 400093",
        "voltageClass": "400 kV GIS",
        "location": {
            "type": "Point",
            "coordinates": [72.880, 19.080]
        },
        "latitude": 19.080,
        "longitude": 72.880,
        "radiusMeters": 600,
        "manager": {
            "name": "Devendra Mehta",
            "designation": "Senior Director Transmission",
            "phone": "+91 98200 11223",
            "email": "devendra.m@adani.com",
            "photoUrl": "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80"
        },
        "photoUrl": "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80",
        "activeEngineersCount": 12,
        "status": "active"
    },
    {
        "_id": "site_amd_01",
        "name": "Ahmedabad Smart Grid Hub",
        "code": "ADN-AMD-001",
        "address": "Adani Shantigram, SG Highway, Ahmedabad, Gujarat 382421",
        "voltageClass": "220 kV Digital Substation",
        "location": {
            "type": "Point",
            "coordinates": [72.5714, 23.0225]
        },
        "latitude": 23.0225,
        "longitude": 72.5714,
        "radiusMeters": 500,
        "manager": {
            "name": "Kirit Patel",
            "designation": "State Infrastructure Head",
            "phone": "+91 98250 12347",
            "email": "kirit.patel@adani.com"
        },
        "photoUrl": "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80",
        "activeEngineersCount": 15,
        "status": "active"
    }
]

SEED_EMPLOYEES = [
    {
        "_id": "emp_01",
        "employeeId": "b4S/Adani/01",
        "name": "Rohit Sharma",
        "phone": "9876543210",
        "password": "password",
        "role": "technician",
        "designation": "Junior Engineer",
        "assignedSiteIds": ["site_surat_01", "site_st_joseph"],
        "assignedSiteId": "site_surat_01",
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
        "status": "active",
        "email": "rohit.sharma@b4s.in",
        "circle": "Gujarat Circle",
        "division": "Surat Division",
        "department": "Smart Meter Operations",
        "latitude": 12.962879,
        "longitude": 77.5968,
        "locationName": "St. Joseph's University, Richmond Circle Flyover, Langford Road",
        "shiftStatus": "present",
        "createdAt": "2025-01-10T09:00:00Z"
    },
    {
        "_id": "emp_02",
        "employeeId": "b4S/Adani/02",
        "name": "Amit Kumar",
        "phone": "9876543211",
        "password": "password",
        "role": "technician",
        "designation": "Junior Engineer",
        "assignedSiteIds": ["site_pune_01", "site_surat_01"],
        "assignedSiteId": "site_pune_01",
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
        "status": "active",
        "email": "amit.kumar@b4s.in",
        "circle": "Prc",
        "division": "Office",
        "department": "Smart Meter Operations",
        "shiftStatus": "present",
        "createdAt": "2024-06-15T09:00:00Z"
    },
    {
        "_id": "emp_03",
        "employeeId": "b4S/Adani/03",
        "name": "Sandeep Yadav",
        "phone": "9876543212",
        "password": "password",
        "role": "technician",
        "designation": "Junior Engineer",
        "assignedSiteIds": ["site_pune_02"],
        "assignedSiteId": "site_pune_02",
        "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
        "status": "active",
        "email": "sandeep.yadav@b4s.in",
        "circle": "Prc",
        "division": "Bundgarden",
        "department": "Smart Meter Operations",
        "shiftStatus": "present",
        "createdAt": "2023-01-01T09:00:00Z"
    },
    {
        "_id": "emp_04",
        "employeeId": "b4S/Adani/04",
        "name": "Vikash Singh",
        "phone": "9876543213",
        "password": "password",
        "role": "technician",
        "designation": "Junior Engineer",
        "assignedSiteIds": ["site_pune_01", "site_pune_02"],
        "assignedSiteId": "site_pune_01",
        "avatar": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
        "status": "active",
        "email": "vikash.singh@b4s.in",
        "circle": "Prc",
        "division": "Bundgarden",
        "department": "Transmission & Distribution",
        "shiftStatus": "present",
        "createdAt": "2024-06-15T09:00:00Z"
    },
    {
        "_id": "emp_05",
        "employeeId": "b4S/Adani/05",
        "name": "Neha Patil",
        "phone": "9876543215",
        "password": "password",
        "role": "supervisor",
        "designation": "Supervisor",
        "assignedSiteIds": ["site_pune_01", "site_surat_01"],
        "assignedSiteId": "site_pune_01",
        "avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
        "status": "active",
        "email": "neha.patil@b4s.in",
        "circle": "Prc",
        "division": "Office",
        "department": "Workforce Coordination",
        "shiftStatus": "present",
        "createdAt": "2024-02-01T09:00:00Z"
    },
    {
        "_id": "emp_06",
        "employeeId": "b4S/Adani/06",
        "name": "Harsh Parmar",
        "phone": "9876543216",
        "password": "password",
        "role": "technician",
        "designation": "Junior Engineer",
        "assignedSiteIds": ["site_st_joseph"],
        "assignedSiteId": "site_st_joseph",
        "avatar": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80",
        "status": "active",
        "email": "harsh.parmar@b4s.in",
        "circle": "Prc",
        "division": "st. joseph university",
        "department": "Smart Meter Operations",
        "shiftStatus": "present",
        "createdAt": "2024-03-15T09:00:00Z"
    },
    {
        "_id": "emp_suresh",
        "employeeId": "SUPER01",
        "name": "Suresh Patil",
        "phone": "9876543214",
        "password": "password",
        "role": "supervisor",
        "designation": "Area Operations Supervisor",
        "assignedSiteIds": ["site_pune_01"],
        "assignedSiteId": "site_pune_01",
        "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
        "status": "active",
        "email": "suresh.patil@b4s.in",
        "circle": "Maharashtra Circle",
        "division": "Pune Division",
        "department": "Smart Meter Operations",
        "shiftStatus": "present",
        "createdAt": "2024-06-15T09:00:00Z"
    },
    {
        "_id": "emp_admin",
        "employeeId": "b4S/Adani/Admin",
        "name": "Anita Sharma",
        "phone": "9876543299",
        "password": "password",
        "role": "admin",
        "designation": "Chief Operations Admin",
        "assignedSiteIds": ["site_surat_01", "site_st_joseph", "site_pune_01", "site_pune_02", "site_mumbai_01"],
        "assignedSiteId": "site_surat_01",
        "avatar": "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80",
        "status": "active",
        "email": "admin@adani.com",
        "circle": "Corporate Operations",
        "division": "HQ Central Command",
        "department": "Executive Management",
        "shiftStatus": "present",
        "createdAt": "2023-01-01T09:00:00Z"
    }
]

# Generate realistic 30-day attendance history
SEED_ATTENDANCE: List[Dict[str, Any]] = [
    {
        "_id": "att_rohit_21",
        "employeeId": "emp_01",
        "siteId": "site_st_joseph",
        "siteName": "st. joseph university",
        "checkOutSiteName": "Jain sos",
        "date": "2026-10-21",
        "checkIn": {
            "time": "2026-10-21T09:12:00Z",
            "latitude": 12.962590,
            "longitude": 77.593617,
            "accuracy": 10.0,
            "distanceMeters": 1260,
            "photoUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
            "remarks": "Smart meter installation route"
        },
        "checkOut": {
            "time": "2026-10-21T18:15:00Z",
            "latitude": 12.960500,
            "longitude": 77.584500,
            "accuracy": 10.0,
            "siteName": "Jain sos"
        },
        "status": "present",
        "workingMinutes": 543,
        "distanceTraveledKm": 1.26,
        "distanceTraveledFormatted": "1.26 km",
        "adminRemarks": "Regular shift completed on schedule",
        "createdAt": "2026-10-21T09:12:00Z"
    },
    {
        "_id": "att_rohit_22",
        "employeeId": "emp_01",
        "siteId": "site_st_joseph",
        "siteName": "st. joseph university",
        "checkOutSiteName": "Jain sos",
        "date": "2026-10-22",
        "checkIn": {
            "time": "2026-10-22T10:14:00Z",
            "latitude": 12.962590,
            "longitude": 77.593617,
            "accuracy": 10.0,
            "distanceMeters": 1260,
            "photoUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
            "remarks": "Smart meter installation at engineering block"
        },
        "checkOut": {
            "time": "2026-10-22T18:00:00Z",
            "latitude": 12.960500,
            "longitude": 77.584500,
            "accuracy": 10.0,
            "siteName": "Jain sos"
        },
        "status": "late",
        "workingMinutes": 466,
        "distanceTraveledKm": 1.26,
        "distanceTraveledFormatted": "1.26 km",
        "adminRemarks": "Auto-checked out at 06:00 PM (Shift End)",
        "createdAt": "2026-10-22T10:14:00Z"
    },
    {
        "_id": "att_suresh_22",
        "employeeId": "emp_suresh",
        "siteId": "site_pune_01",
        "date": "2026-10-22",
        "checkIn": {
            "time": "2026-10-22T10:43:00Z",
            "latitude": 18.5913,
            "longitude": 73.7389,
            "accuracy": 12.0,
            "distanceMeters": 736000,
            "photoUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
            "remarks": "Transit checkin"
        },
        "checkOut": {
            "time": "2026-10-22T10:44:00Z",
            "latitude": 18.5913,
            "longitude": 73.7389,
            "accuracy": 12.0
        },
        "status": "half_day",
        "workingMinutes": 1,
        "distanceTraveledKm": 736.0,
        "distanceTraveledFormatted": "736.0 km",
        "adminRemarks": "Partial shift recorded",
        "createdAt": "2026-10-22T10:43:00Z"
    },
    {
        "_id": "att_suresh_22_early",
        "employeeId": "emp_suresh",
        "siteId": "site_pune_01",
        "date": "2026-10-22",
        "checkIn": {
            "time": "2026-10-22T10:17:00Z",
            "latitude": 18.5913,
            "longitude": 73.7389,
            "accuracy": 10.0,
            "distanceMeters": 14,
            "photoUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
            "remarks": "Phase 1 substation arrival"
        },
        "checkOut": {
            "time": "2026-10-22T10:43:00Z",
            "latitude": 18.5913,
            "longitude": 73.7389,
            "accuracy": 10.0
        },
        "status": "half_day",
        "workingMinutes": 25,
        "distanceTraveledFormatted": "14 m",
        "adminRemarks": "Partial shift recorded",
        "createdAt": "2026-10-22T10:17:00Z"
    },
    {
        "_id": "att_suresh_21",
        "employeeId": "emp_suresh",
        "siteId": "site_pune_01",
        "date": "2026-10-21",
        "checkIn": {
            "time": "2026-10-21T18:55:00Z",
            "latitude": 18.5913,
            "longitude": 73.7389,
            "accuracy": 15.0,
            "photoUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
            "remarks": "Evening supervisory round"
        },
        "checkOut": {
            "time": "2026-10-22T18:00:00Z",
            "latitude": 18.5913,
            "longitude": 73.7389,
            "accuracy": 15.0,
            "isAutoCheckedOut": True
        },
        "status": "half_day",
        "workingMinutes": 1385,
        "distanceTraveledFormatted": "--",
        "adminRemarks": "Auto-checked out at 06:00 PM (Shift End)",
        "createdAt": "2026-10-21T18:55:00Z"
    },
    {
        "_id": "att_amit_21",
        "employeeId": "emp_02",
        "siteId": "site_pune_01",
        "date": "2026-10-21",
        "checkIn": {
            "time": "2026-10-21T09:02:00Z",
            "latitude": 18.5913,
            "longitude": 73.7389,
            "accuracy": 10.0,
            "distanceMeters": 1200
        },
        "checkOut": {
            "time": "2026-10-21T18:05:00Z",
            "latitude": 18.5913,
            "longitude": 73.7389,
            "accuracy": 10.0
        },
        "status": "present",
        "workingMinutes": 543,
        "distanceTraveledKm": 1.2,
        "adminRemarks": "Regular shift completed on schedule",
        "createdAt": "2026-10-21T09:02:00Z"
    },
    {
        "_id": "att_sandeep_20",
        "employeeId": "emp_03",
        "siteId": "site_pune_02",
        "date": "2026-10-20",
        "checkIn": {
            "time": "2026-10-20T09:15:00Z",
            "latitude": 18.5204,
            "longitude": 73.8567,
            "accuracy": 12.0
        },
        "checkOut": {
            "time": "2026-10-20T18:00:00Z",
            "latitude": 18.5204,
            "longitude": 73.8567,
            "accuracy": 12.0
        },
        "status": "present",
        "workingMinutes": 525,
        "createdAt": "2026-10-20T09:15:00Z"
    },
    {
        "_id": "att_pooja_19",
        "employeeId": "emp_05",
        "siteId": "site_pune_02",
        "date": "2026-10-19",
        "checkIn": {
            "time": "2026-10-19T10:05:10Z",
            "latitude": 18.5580,
            "longitude": 73.9550,
            "accuracy": 18.5,
            "distanceMeters": 680
        },
        "checkOut": None,
        "status": "late",
        "workingMinutes": 420,
        "createdAt": "2026-10-19T10:05:10Z"
    },
    {
        "_id": "att_vikram_18",
        "employeeId": "emp_06",
        "siteId": "site_surat_01",
        "date": "2026-10-18",
        "checkIn": None,
        "checkOut": None,
        "status": "absent",
        "workingMinutes": 0,
        "adminRemarks": "Unexcused leave of absence",
        "createdAt": "2026-10-18T09:00:00Z"
    },
    {
        "_id": "att_rohit_26",
        "employeeId": "emp_01",
        "siteId": "site_st_joseph",
        "date": "2026-10-26",
        "checkIn": {
            "time": "2026-10-26T10:14:00Z",
            "latitude": 12.962590,
            "longitude": 77.593617,
            "accuracy": 10.0,
            "distanceMeters": 0,
            "remarks": "Smart meter installation at engineering block"
        },
        "checkOut": {
            "time": "2026-10-26T18:00:00Z",
            "latitude": 12.962590,
            "longitude": 77.593617,
            "accuracy": 10.0
        },
        "status": "late",
        "workingMinutes": 466,
        "adminRemarks": "Auto-checked out at 06:00 PM (Shift End)",
        "createdAt": "2026-10-26T10:14:00Z"
    },
    {
        "_id": "att_suresh_26",
        "employeeId": "emp_suresh",
        "siteId": "site_pune_01",
        "date": "2026-10-26",
        "checkIn": {
            "time": "2026-10-26T10:43:00Z",
            "latitude": 18.5913,
            "longitude": 73.7389,
            "accuracy": 12.0,
            "distanceMeters": 736000,
            "remarks": "Transit checkin"
        },
        "checkOut": {
            "time": "2026-10-26T18:00:00Z",
            "latitude": 18.5913,
            "longitude": 73.7389,
            "accuracy": 12.0
        },
        "status": "half_day",
        "workingMinutes": 437,
        "distanceTraveledKm": 736.0,
        "adminRemarks": "Shift concluded normally",
        "createdAt": "2026-10-26T10:43:00Z"
    }
]

for day in range(1, 24):
    d_str = f"2026-10-{day:02d}"
    weekday = date(2026, 10, day).weekday()
    if weekday == 6:
        st = "weekly_off"
        ci, co, wm = None, None, 0
    elif day == 12:
        st = "absent"
        ci, co, wm = None, None, 0
    elif day == 5:
        st = "half_day"
        ci = {
            "time": f"{d_str}T09:25:00Z",
            "latitude": 18.59127,
            "longitude": 73.73891,
            "accuracy": 14.0,
            "distanceMeters": 85,
            "photoUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
            "remarks": "Half day morning shift"
        }
        co = {
            "time": f"{d_str}T14:00:00Z",
            "latitude": 18.59129,
            "longitude": 73.73890,
            "accuracy": 11.0
        }
        wm = 275
    elif day in [8, 19]:
        st = "late"
        ci = {
            "time": f"{d_str}T09:52:00Z",
            "latitude": 18.59127,
            "longitude": 73.73891,
            "accuracy": 15.0,
            "distanceMeters": 90,
            "photoUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
            "remarks": "Substation maintenance"
        }
        co = {
            "time": f"{d_str}T18:15:00Z",
            "latitude": 18.59128,
            "longitude": 73.73892,
            "accuracy": 12.0
        }
        wm = 503
    else:
        st = "present"
        ci = {
            "time": f"{d_str}T09:22:00Z",
            "latitude": 18.59127,
            "longitude": 73.73891,
            "accuracy": 10.0,
            "distanceMeters": 55,
            "photoUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
            "remarks": "Regular shift"
        }
        co = {
            "time": f"{d_str}T18:05:00Z",
            "latitude": 18.59127,
            "longitude": 73.73891,
            "accuracy": 10.0
        }
        wm = 523

    SEED_ATTENDANCE.append({
        "_id": f"att_seed_01_{day}",
        "employeeId": "emp_01",
        "siteId": "site_pune_01",
        "date": d_str,
        "checkIn": ci,
        "checkOut": co,
        "status": st,
        "workingMinutes": wm,
        "createdAt": f"{d_str}T09:22:00Z"
    })


# -------------------------------------------------------------
SEED_HOLIDAYS = [
    {
        "_id": "hol_2026_01_26",
        "name": "Republic Day",
        "date": "2026-01-26",
        "day": "Monday",
        "description": "National Gazetted Holiday",
        "type": "National Gazetted",
        "status": "active"
    },
    {
        "_id": "hol_2026_02_15",
        "name": "Maha Shivaratri",
        "date": "2026-02-15",
        "day": "Sunday",
        "description": "Gazetted Holiday",
        "type": "Gazetted",
        "status": "active"
    },
    {
        "_id": "hol_2026_03_03",
        "name": "Holi (Dhulivandan)",
        "date": "2026-03-03",
        "day": "Tuesday",
        "description": "Festival of Colors",
        "type": "Gazetted",
        "status": "active"
    },
    {
        "_id": "hol_2026_03_20",
        "name": "Eid-ul-Fitr (Ramzan Eid)",
        "date": "2026-03-20",
        "day": "Friday",
        "description": "Gazetted Holiday",
        "type": "Gazetted",
        "status": "active"
    },
    {
        "_id": "hol_2026_04_14",
        "name": "Dr. Ambedkar Jayanti",
        "date": "2026-04-14",
        "day": "Tuesday",
        "description": "Birth anniversary of Dr. B.R. Ambedkar",
        "type": "Gazetted",
        "status": "active"
    },
    {
        "_id": "hol_2026_05_01",
        "name": "Maharashtra / Gujarat Day",
        "date": "2026-05-01",
        "day": "Friday",
        "description": "Regional State Foundation Day",
        "type": "Regional",
        "status": "active"
    },
    {
        "_id": "hol_2026_08_15",
        "name": "Independence Day",
        "date": "2026-08-15",
        "day": "Saturday",
        "description": "National Gazetted Holiday",
        "type": "National Gazetted",
        "status": "active"
    },
    {
        "_id": "hol_2026_09_04",
        "name": "Janmashtami (Gokulashtami)",
        "date": "2026-09-04",
        "day": "Friday",
        "description": "Lord Krishna Birthday",
        "type": "Gazetted",
        "status": "active"
    },
    {
        "_id": "hol_2026_10_02",
        "name": "Mahatma Gandhi Jayanti",
        "date": "2026-10-02",
        "day": "Friday",
        "description": "National Gazetted Holiday",
        "type": "National Gazetted",
        "status": "active"
    },
    {
        "_id": "hol_2026_10_20",
        "name": "Dussehra (Vijayadashami)",
        "date": "2026-10-20",
        "day": "Tuesday",
        "description": "Gazetted Holiday",
        "type": "Gazetted",
        "status": "active"
    },
    {
        "_id": "hol_2026_11_08",
        "name": "Diwali (Deepavali Laxmi Pujan)",
        "date": "2026-11-08",
        "day": "Sunday",
        "description": "Festival of Lights",
        "type": "Gazetted",
        "status": "active"
    },
    {
        "_id": "hol_2026_11_09",
        "name": "Diwali Balipratipada",
        "date": "2026-11-09",
        "day": "Monday",
        "description": "New Year / Balipratipada",
        "type": "Gazetted",
        "status": "active"
    },
    {
        "_id": "hol_2026_12_25",
        "name": "Christmas Day",
        "date": "2026-12-25",
        "day": "Friday",
        "description": "Gazetted Holiday",
        "type": "Gazetted",
        "status": "active"
    }
]

# Firestore REST Data Converter & Helpers
# -------------------------------------------------------------
def to_firestore_value(val: Any) -> dict:
    if val is None:
        return {"nullValue": None}
    elif isinstance(val, bool):
        return {"booleanValue": val}
    elif isinstance(val, int):
        return {"integerValue": str(val)}
    elif isinstance(val, float):
        return {"doubleValue": val}
    elif isinstance(val, str):
        return {"stringValue": val}
    elif isinstance(val, list):
        return {"arrayValue": {"values": [to_firestore_value(v) for v in val]}}
    elif isinstance(val, dict):
        return {"mapValue": {"fields": {k: to_firestore_value(v) for k, v in val.items()}}}
    else:
        return {"stringValue": str(val)}

def from_firestore_value(field: dict) -> Any:
    if not isinstance(field, dict):
        return field
    if "nullValue" in field:
        return None
    elif "booleanValue" in field:
        return field["booleanValue"]
    elif "integerValue" in field:
        return int(field["integerValue"])
    elif "doubleValue" in field:
        return float(field["doubleValue"])
    elif "stringValue" in field:
        return field["stringValue"]
    elif "timestampValue" in field:
        return field["timestampValue"]
    elif "arrayValue" in field:
        return [from_firestore_value(v) for v in field["arrayValue"].get("values", [])]
    elif "mapValue" in field:
        return {k: from_firestore_value(v) for k, v in field["mapValue"].get("fields", {}).items()}
    return None

def dict_to_firestore_doc(data: dict) -> dict:
    fields = {}
    for k, v in data.items():
        fields[k] = to_firestore_value(v)
    return {"fields": fields}

def firestore_doc_to_dict(doc: dict) -> dict:
    if not doc or "fields" not in doc:
        return {}
    res = {}
    for k, v in doc["fields"].items():
        res[k] = from_firestore_value(v)
    # Extract document ID if _id wasn't in fields
    if "_id" not in res and "name" in doc:
        res["_id"] = doc["name"].split("/")[-1]
    return res


# -------------------------------------------------------------
# Firestore Collection Wrapper
# -------------------------------------------------------------
class FirestoreCollectionDictWrapper:
    """
    Dictionary-like interface synchronizing reads and writes directly
    with Firebase Cloud Firestore collections.
    """
    def __init__(self, db_manager, collection_name: str, fallback_dict: dict):
        self.db_manager = db_manager
        self.collection_name = collection_name
        self.fallback_dict = fallback_dict

    def __getitem__(self, key: str) -> dict:
        if key in self.fallback_dict:
            return self.fallback_dict[key]
        doc = self.db_manager.get_firestore_document(self.collection_name, key)
        if doc is not None:
            self.fallback_dict[key] = doc
            return doc
        return self.fallback_dict[key]

    def __setitem__(self, key: str, value: dict):
        self.fallback_dict[key] = value
        self.db_manager.set_firestore_document_async(self.collection_name, key, value)

    def __delitem__(self, key: str):
        if key in self.fallback_dict:
            del self.fallback_dict[key]
        self.db_manager.delete_firestore_document_async(self.collection_name, key)

    def __contains__(self, key: str) -> bool:
        if key in self.fallback_dict:
            return True
        if self.db_manager.is_connected:
            doc = self.db_manager.get_firestore_document(self.collection_name, key)
            if doc is not None:
                self.fallback_dict[key] = doc
                return True
        return False

    def get(self, key: str, default=None):
        if key in self.fallback_dict:
            return self.fallback_dict[key]
        doc = self.db_manager.get_firestore_document(self.collection_name, key)
        if doc is not None:
            self.fallback_dict[key] = doc
            return doc
        return default

    def values(self) -> List[dict]:
        # Merge local in-memory operational records with remote Firestore documents
        merged = dict(self.fallback_dict)
        remote_docs = self.db_manager.list_firestore_collection(self.collection_name)
        if remote_docs:
            for doc in remote_docs:
                doc_id = doc.get("_id") or doc.get("id")
                if doc_id:
                    if doc_id in merged:
                        local_doc = merged[doc_id]
                        local_time = local_doc.get("updatedAt") or (local_doc.get("checkIn") or {}).get("time") or ""
                        remote_time = doc.get("updatedAt") or (doc.get("checkIn") or {}).get("time") or ""
                        if remote_time >= local_time:
                            merged[doc_id] = doc
                            self.fallback_dict[doc_id] = doc
                    else:
                        merged[doc_id] = doc
                        self.fallback_dict[doc_id] = doc
        return list(merged.values())


# -------------------------------------------------------------
# DatabaseManager (Firebase Cloud Database)
# -------------------------------------------------------------
class DatabaseManager:
    """
    Enterprise Firebase Cloud Firestore Database layer for Adani Smart Meter
    Workforce Platform with automatic seeding, non-blocking sync, and resilience.
    """
    def __init__(self):
        self.is_connected: bool = False
        self.connection_status_message: str = "Connecting to Firebase..."
        self.project_id: str = settings.FIREBASE_PROJECT_ID
        self.api_key: str = settings.FIREBASE_API_KEY
        self.firestore_base_url: str = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents"

        # In-memory synchronized high-performance operational cache
        self._raw_employees: Dict[str, dict] = {e["_id"]: e for e in SEED_EMPLOYEES}
        self._raw_sites: Dict[str, dict] = {s["_id"]: s for s in SEED_SITES}
        self._raw_attendance: Dict[str, dict] = {a["_id"]: a for a in SEED_ATTENDANCE}
        self._raw_holidays: Dict[str, dict] = {h["_id"]: h for h in SEED_HOLIDAYS}
        self.gps_events: List[dict] = []
        self.audit_logs: List[dict] = []

        # Optional firebase-admin client
        self.admin_db: Optional[Any] = None

        # Collection dict wrappers used by all routers
        self.employees = FirestoreCollectionDictWrapper(self, "employees", self._raw_employees)
        self.sites = FirestoreCollectionDictWrapper(self, "sites", self._raw_sites)
        self.attendance = FirestoreCollectionDictWrapper(self, "attendance", self._raw_attendance)
        self.holidays = FirestoreCollectionDictWrapper(self, "holidays", self._raw_holidays)

        # Initialize connection
        self.connect_to_firebase()

    def connect_to_firebase(self):
        """Attempts connection to Firebase via Admin SDK or Firestore REST API"""
        # Try Firebase Admin SDK if service account file is provided
        sa_path = settings.FIREBASE_SERVICE_ACCOUNT_PATH
        if not sa_path:
            # Check for standard local service account file
            default_sa = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "serviceAccountKey.json")
            if os.path.exists(default_sa):
                sa_path = default_sa

        if sa_path and os.path.exists(sa_path):
            try:
                import firebase_admin
                from firebase_admin import credentials, firestore
                cred = credentials.Certificate(sa_path)
                try:
                    app = firebase_admin.get_app()
                except ValueError:
                    app = firebase_admin.initialize_app(cred, {
                        'projectId': self.project_id,
                        'storageBucket': settings.FIREBASE_STORAGE_BUCKET
                    })
                self.admin_db = firestore.client()
                self.is_connected = True
                self.connection_status_message = f"Connected to Firebase Firestore (Admin SDK): {self.project_id}"
                logger.info(self.connection_status_message)
                print(f"[Firebase Firestore] {self.connection_status_message}")
                self._seed_firebase_data_async()
                return
            except Exception as e:
                logger.warning(f"Firebase Admin SDK init failed: {e}")

        # Test Firestore REST connection
        try:
            url = f"{self.firestore_base_url}/sites?key={self.api_key}"
            resp = requests.get(url, timeout=3.0)
            if resp.status_code in [200, 403, 404]:
                # 200 = open/authorized, 403 = active rules configured, 404 = collection empty
                self.is_connected = True
                self.connection_status_message = f"Connected to Firebase Firestore Cloud: {self.project_id}"
                print(f"[Firebase Firestore] {self.connection_status_message}")
                self._seed_firebase_data_async()
            else:
                self.is_connected = False
                self.connection_status_message = f"Firebase responded with code {resp.status_code}"
                print(f"[Firebase Firestore] Notice: {self.connection_status_message}. Running on synchronized store.")
        except Exception as e:
            self.is_connected = False
            self.connection_status_message = f"Firebase offline ({str(e)[:60]}). Operational store active."
            print(f"[Firebase Firestore] Notice: {self.connection_status_message}")

    # ---------------------------------------------------------
    # Firestore REST / Admin SDK Operations
    # ---------------------------------------------------------
    def get_firestore_document(self, collection: str, doc_id: str) -> Optional[dict]:
        if self.admin_db:
            try:
                snap = self.admin_db.collection(collection).document(doc_id).get()
                if snap.exists:
                    data = snap.to_dict()
                    data["_id"] = doc_id
                    return data
            except Exception as e:
                logger.debug(f"Admin SDK read error: {e}")

        # REST API fallback
        try:
            url = f"{self.firestore_base_url}/{collection}/{doc_id}?key={self.api_key}"
            resp = requests.get(url, timeout=2.0)
            if resp.status_code == 200:
                return firestore_doc_to_dict(resp.json())
        except Exception:
            pass
        return None

    def list_firestore_collection(self, collection: str) -> Optional[List[dict]]:
        if self.admin_db:
            try:
                docs = []
                for snap in self.admin_db.collection(collection).stream():
                    d = snap.to_dict()
                    d["_id"] = snap.id
                    docs.append(d)
                if docs:
                    return docs
            except Exception as e:
                logger.debug(f"Admin SDK list error: {e}")

        try:
            url = f"{self.firestore_base_url}/{collection}?pageSize=100&key={self.api_key}"
            resp = requests.get(url, timeout=2.5)
            if resp.status_code == 200:
                data = resp.json()
                raw_docs = data.get("documents", [])
                if raw_docs:
                    return [firestore_doc_to_dict(d) for d in raw_docs]
        except Exception:
            pass
        return None

    def set_firestore_document(self, collection: str, doc_id: str, data: dict):
        if self.admin_db:
            try:
                clean_data = dict(data)
                self.admin_db.collection(collection).document(doc_id).set(clean_data)
                return
            except Exception as e:
                logger.warning(f"Admin SDK write error on {collection}/{doc_id}: {e}")

        try:
            url = f"{self.firestore_base_url}/{collection}/{doc_id}?key={self.api_key}"
            payload = dict_to_firestore_doc(data)
            requests.patch(url, json=payload, timeout=2.5)
        except Exception as e:
            logger.debug(f"Firebase REST write error on {collection}/{doc_id}: {e}")

    def delete_firestore_document(self, collection: str, doc_id: str):
        if self.admin_db:
            try:
                self.admin_db.collection(collection).document(doc_id).delete()
                return
            except Exception as e:
                logger.warning(f"Admin SDK delete error on {collection}/{doc_id}: {e}")

        try:
            url = f"{self.firestore_base_url}/{collection}/{doc_id}?key={self.api_key}"
            requests.delete(url, timeout=2.0)
        except Exception as e:
            logger.debug(f"Firebase REST delete error on {collection}/{doc_id}: {e}")

    def set_firestore_document_async(self, collection: str, doc_id: str, data: dict):
        threading.Thread(
            target=self.set_firestore_document,
            args=(collection, doc_id, data),
            daemon=True
        ).start()

    def delete_firestore_document_async(self, collection: str, doc_id: str):
        threading.Thread(
            target=self.delete_firestore_document,
            args=(collection, doc_id),
            daemon=True
        ).start()

    # ---------------------------------------------------------
    # Seeding
    # ---------------------------------------------------------
    def _seed_firebase_data_async(self):
        threading.Thread(target=self._seed_firebase_data, daemon=True).start()

    def _seed_firebase_data(self):
        try:
            logger.info("Synchronizing initial Adani workforce dataset to Firebase Firestore...")
            for s in self._raw_sites.values():
                self.set_firestore_document("sites", s["_id"], s)
            for e in self._raw_employees.values():
                self.set_firestore_document("employees", e["_id"], e)
            for a in list(self._raw_attendance.values())[:30]:
                self.set_firestore_document("attendance", a["_id"], a)
            logger.info("Firebase Firestore synchronization complete.")
        except Exception as e:
            logger.warning(f"Error seeding Firebase data: {e}")

    # ---------------------------------------------------------
    # Core Queries
    # ---------------------------------------------------------
    def get_employee(self, emp_id: str) -> Optional[dict]:
        doc = self.get_firestore_document("employees", emp_id)
        if doc:
            return doc
        return self._raw_employees.get(emp_id)

    def get_user_by_id(self, emp_id: str) -> Optional[dict]:
        """Lookup employee/user by document _id or employeeId identifier"""
        return self.get_employee(emp_id) or self.find_employee_by_identifier(emp_id)

    def find_employee_by_identifier(self, identifier: str) -> Optional[dict]:
        clean_id = (identifier or "").strip().lower()
        if not clean_id:
            return None

        # Direct alias support for operations admin
        if clean_id in ["admin", "b4s/adani/admin", "operations.admin", "admin@adani.com"]:
            for emp in self._raw_employees.values():
                if emp.get("role") == "admin":
                    return emp

        # Direct alias support for supervisor
        if clean_id in ["supervisor", "super01", "suresh", "suresh.patil", "suresh.patil@b4s.in", "b4s/adani/04"]:
            for emp in self._raw_employees.values():
                if emp.get("employeeId") == "SUPER01" or (emp.get("role") == "supervisor" and "suresh" in emp.get("name", "").lower()):
                    return emp
            for emp in self._raw_employees.values():
                if emp.get("role") == "supervisor":
                    return emp

        # Check in memory and cached
        for emp in self._raw_employees.values():
            e_id = (emp.get("employeeId") or "").strip().lower()
            e_phone = (emp.get("phone") or "").strip().lower()
            e_email = (emp.get("email") or "").strip().lower()
            if clean_id == e_id or clean_id == e_phone or clean_id == e_email:
                return emp

        # Check firestore
        all_emps = self.get_all_employees()
        for emp in all_emps:
            e_id = (emp.get("employeeId") or "").strip().lower()
            e_phone = (emp.get("phone") or "").strip().lower()
            e_email = (emp.get("email") or "").strip().lower()
            if clean_id == e_id or clean_id == e_phone or clean_id == e_email:
                return emp
        return None

    def get_site(self, site_id: str) -> Optional[dict]:
        doc = self.get_firestore_document("sites", site_id)
        if doc:
            return doc
        return self._raw_sites.get(site_id)

    def get_all_sites(self) -> List[dict]:
        remote = self.list_firestore_collection("sites")
        if remote:
            return remote
        return list(self._raw_sites.values())

    def get_all_employees(self) -> List[dict]:
        remote = self.list_firestore_collection("employees")
        if remote:
            return remote
        return list(self._raw_employees.values())

    def get_today_attendance(self, emp_id: str, today_str: Optional[str] = None) -> Optional[dict]:
        valid_ids = {str(emp_id).lower().strip()}
        emp = self.get_employee(emp_id) or self.find_employee_by_identifier(emp_id)
        if emp:
            for k in ["_id", "id", "employeeId", "code", "phone"]:
                if emp.get(k):
                    valid_ids.add(str(emp[k]).lower().strip())

        now_utc = datetime.utcnow()
        ist_dt = now_utc + timedelta(hours=5, minutes=30)
        target_dates = {now_utc.strftime("%Y-%m-%d"), ist_dt.strftime("%Y-%m-%d")}
        if today_str:
            target_dates.add(today_str)

        all_att = self.attendance.values()
        matching = [
            att for att in all_att
            if (
                str(att.get("employeeId") or "").lower().strip() in valid_ids
                or str(att.get("technicianCode") or "").lower().strip() in valid_ids
                or str(att.get("userId") or "").lower().strip() in valid_ids
            )
            and str(att.get("date") or "") in target_dates
        ]
        if not matching:
            return None

        # Return active shift (no checkout yet) first
        for att in matching:
            if not att.get("checkOut"):
                return att

        # Otherwise return latest check-in
        matching.sort(key=lambda x: str((x.get("checkIn") or {}).get("time") or ""), reverse=True)
        return matching[0]

    def get_attendance_history(
        self,
        emp_id: Optional[str] = None,
        month: Optional[int] = None,
        year: Optional[int] = None
    ) -> List[dict]:
        results = []
        valid_ids = set()
        if emp_id:
            valid_ids.add(str(emp_id).lower().strip())
            emp = self.get_employee(emp_id) or self.find_employee_by_identifier(emp_id)
            if emp:
                for k in ["_id", "id", "employeeId", "code", "phone"]:
                    if emp.get(k):
                        valid_ids.add(str(emp[k]).lower().strip())

        all_att = self.attendance.values()
        for att in all_att:
            if not isinstance(att, dict):
                continue
            if valid_ids:
                att_emp = str(att.get("employeeId") or "").lower().strip()
                att_tech = str(att.get("technicianCode") or "").lower().strip()
                att_user = str(att.get("userId") or "").lower().strip()
                if att_emp not in valid_ids and att_tech not in valid_ids and att_user not in valid_ids:
                    continue
            date_str = str(att.get("date") or "")
            if month and year:
                prefix = f"{year}-{month:02d}"
                if not date_str.startswith(prefix):
                    continue
            results.append(att)
        results.sort(key=lambda x: str(x.get("date") or ""), reverse=True)
        return results

    def save_attendance(self, record: dict) -> dict:
        self._raw_attendance[record["_id"]] = record
        self.set_firestore_document_async("attendance", record["_id"], record)
        return record


    def get_all_holidays(self, year: Optional[int] = None) -> List[dict]:
        all_h = list(self.holidays.values())
        if year:
            y_prefix = f"{year}-"
            all_h = [h for h in all_h if str(h.get("date", "")).startswith(y_prefix)]
        all_h.sort(key=lambda x: str(x.get("date", "")))
        return all_h

    def get_holiday_by_id(self, holiday_id: str) -> Optional[dict]:
        return self.holidays.get(holiday_id)

    def get_holiday_by_date(self, date_str: str) -> Optional[dict]:
        target = str(date_str).strip()
        for h in self.holidays.values():
            if str(h.get("date", "")).strip() == target and h.get("status") != "deleted":
                return h
        return None

    def save_holiday(self, holiday_data: dict) -> dict:
        h_id = holiday_data.get("_id") or f"hol_{holiday_data.get('date', '').replace('-', '_')}"
        holiday_data["_id"] = h_id
        if "status" not in holiday_data:
            holiday_data["status"] = "active"
        if "updatedAt" not in holiday_data:
            holiday_data["updatedAt"] = datetime.utcnow().isoformat() + "Z"
        self._raw_holidays[h_id] = holiday_data
        self.set_firestore_document_async("holidays", h_id, holiday_data)
        return holiday_data

    def delete_holiday(self, holiday_id: str) -> bool:
        if holiday_id in self.holidays:
            del self.holidays[holiday_id]
            self.delete_firestore_document_async("holidays", holiday_id)
            return True
        return False

db = DatabaseManager()
