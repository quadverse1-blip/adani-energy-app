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
SEED_SITES: List[Dict[str, Any]] = [
    {
        "_id": "site_shantigram_01",
        "name": "Adani Shantigram Substation",
        "code": "ADN-SNT-01",
        "address": "Near SG Highway, Shantigram Township, Ahmedabad, Gujarat 382421",
        "latitude": 23.1412,
        "longitude": 72.5489,
        "radiusMeters": 500.0,
        "voltageClass": "66/11 kV Smart Feeder Hub",
        "status": "active",
        "manager": {
            "name": "Rajesh Varma",
            "phone": "9876543201",
            "email": "rajesh.varma@adani.com",
            "designation": "Executive Grid In-Charge"
        },
        "workingHours": "09:00 AM - 06:00 PM IST",
        "activeEngineersCount": 6
    },
    {
        "_id": "site_mundra_01",
        "name": "Mundra Ultra Feeder Grid Station",
        "code": "ADN-MND-01",
        "address": "Adani Port & SEZ Infrastructure Zone, Mundra, Kutch, Gujarat 370421",
        "latitude": 22.8394,
        "longitude": 69.7111,
        "radiusMeters": 600.0,
        "voltageClass": "220/66 kV Grid Substation",
        "status": "active",
        "manager": {
            "name": "Vikram Desai",
            "phone": "9876543202",
            "email": "vikram.desai@adani.com",
            "designation": "Zonal Superintending Engineer"
        },
        "workingHours": "09:00 AM - 06:00 PM IST",
        "activeEngineersCount": 8
    },
    {
        "_id": "site_navimumbai_01",
        "name": "Navi Mumbai Smart Meter Distribution Station",
        "code": "ADN-NVM-01",
        "address": "MIDC Industrial Area, Mahape, Navi Mumbai, Maharashtra 400710",
        "latitude": 19.1136,
        "longitude": 73.0169,
        "radiusMeters": 500.0,
        "voltageClass": "33/11 kV Urban Distribution Hub",
        "status": "active",
        "manager": {
            "name": "Sanjay Shinde",
            "phone": "9876543203",
            "email": "sanjay.shinde@adani.com",
            "designation": "Divisional Operations Lead"
        },
        "workingHours": "09:00 AM - 06:00 PM IST",
        "activeEngineersCount": 5
    },
    {
        "_id": "site_bkc_01",
        "name": "BKC Commercial Smart Meter Substation",
        "code": "ADN-BKC-01",
        "address": "G Block, Bandra Kurla Complex, Bandra East, Mumbai, Maharashtra 400051",
        "latitude": 19.0657,
        "longitude": 72.8687,
        "radiusMeters": 400.0,
        "voltageClass": "33/11 kV Metro Grid Substation",
        "status": "active",
        "manager": {
            "name": "Mahesh Joshi",
            "phone": "9876543204",
            "email": "mahesh.joshi@adani.com",
            "designation": "Senior Project Manager"
        },
        "workingHours": "09:00 AM - 06:00 PM IST",
        "activeEngineersCount": 4
    }
]

SEED_EMPLOYEES = [
    {
        "_id": "emp_admin",
        "employeeId": "b4S/Adani/Admin",
        "name": "Anita Sharma",
        "phone": "9876543299",
        "password": "password",
        "role": "admin",
        "designation": "Chief Operations Admin",
        "assignedSiteIds": ["site_shantigram_01", "site_mundra_01", "site_navimumbai_01", "site_bkc_01"],
        "assignedSiteId": "site_shantigram_01",
        "avatar": "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80",
        "status": "active",
        "email": "anita.sharma@adani.com",
        "circle": "Ahmedabad",
        "division": "Headquarters",
        "department": "Executive Management",
        "shiftStatus": "present",
        "createdAt": "2023-01-01T09:00:00Z"
    },
    {
        "_id": "emp_demo_admin",
        "employeeId": "ADMIN001",
        "name": "Demo Administrator",
        "phone": "9999999999",
        "password": "password",
        "role": "admin",
        "designation": "Operations Administrator",
        "assignedSiteIds": ["site_shantigram_01", "site_mundra_01", "site_navimumbai_01", "site_bkc_01"],
        "assignedSiteId": "site_shantigram_01",
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
        "status": "active",
        "email": "admin@adani.com",
        "circle": "Ahmedabad",
        "division": "Operations Central",
        "department": "Operations Administration",
        "shiftStatus": "present",
        "createdAt": "2026-01-01T09:00:00Z"
    },
    {
        "_id": "emp_demo_supervisor",
        "employeeId": "SUPER001",
        "name": "Demo Supervisor",
        "phone": "9876543210",
        "password": "password",
        "role": "supervisor",
        "designation": "Area Operations Supervisor",
        "assignedSiteIds": ["site_shantigram_01", "site_mundra_01"],
        "assignedSiteId": "site_shantigram_01",
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
        "status": "active",
        "email": "supervisor@adani.com",
        "circle": "Ahmedabad",
        "division": "North Division",
        "department": "Smart Meter Operations",
        "shiftStatus": "present",
        "latitude": 23.1415,
        "longitude": 72.5492,
        "createdAt": "2026-01-01T09:00:00Z"
    },
    {
        "_id": "emp_demo_technician",
        "employeeId": "TECH001",
        "name": "Demo Technician",
        "phone": "9876543211",
        "password": "password",
        "role": "technician",
        "designation": "Senior Field Technician",
        "assignedSiteIds": ["site_shantigram_01"],
        "assignedSiteId": "site_shantigram_01",
        "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
        "status": "active",
        "email": "technician@adani.com",
        "circle": "Ahmedabad",
        "division": "North Division",
        "department": "Field Installation",
        "shiftStatus": "present",
        "latitude": 23.1418,
        "longitude": 72.5485,
        "createdAt": "2026-01-01T09:00:00Z"
    }
]

SEED_ATTENDANCE: List[Dict[str, Any]] = [
    {
        "_id": "att_seed_01",
        "date": "2026-11-06",
        "employeeId": "emp_demo_technician",
        "technicianCode": "TECH001",
        "technicianName": "Demo Technician",
        "siteId": "site_shantigram_01",
        "siteName": "Adani Shantigram Substation",
        "status": "present",
        "checkIn": {
            "time": "2026-11-06T09:05:00Z",
            "timeIST": "09:05 AM IST",
            "latitude": 23.1412,
            "longitude": 72.5489,
            "siteName": "Adani Shantigram Substation"
        },
        "checkOut": {
            "time": "2026-11-06T18:02:00Z",
            "timeIST": "06:02 PM IST",
            "latitude": 23.1414,
            "longitude": 72.5488,
            "siteName": "Adani Shantigram Substation"
        },
        "workingMinutes": 537,
        "distanceTraveledKm": 0.05,
        "distanceTraveledFormatted": "50 m",
        "isHalfDay": False,
        "adminRemarks": "Full day shift completed"
    },
    {
        "_id": "att_seed_02",
        "date": "2026-11-05",
        "employeeId": "emp_demo_technician",
        "technicianCode": "TECH001",
        "technicianName": "Demo Technician",
        "siteId": "site_shantigram_01",
        "siteName": "Adani Shantigram Substation",
        "status": "present",
        "checkIn": {
            "time": "2026-11-05T09:12:00Z",
            "timeIST": "09:12 AM IST",
            "latitude": 23.1412,
            "longitude": 72.5489,
            "siteName": "Adani Shantigram Substation"
        },
        "checkOut": {
            "time": "2026-11-05T18:00:00Z",
            "timeIST": "06:00 PM IST",
            "latitude": 23.1413,
            "longitude": 72.5490,
            "siteName": "Adani Shantigram Substation"
        },
        "workingMinutes": 528,
        "distanceTraveledKm": 0.02,
        "distanceTraveledFormatted": "20 m",
        "isHalfDay": False,
        "adminRemarks": "Shift completed"
    },
    {
        "_id": "att_seed_03",
        "date": "2026-11-04",
        "employeeId": "emp_demo_supervisor",
        "technicianCode": "SUPER001",
        "technicianName": "Demo Supervisor",
        "siteId": "site_shantigram_01",
        "siteName": "Adani Shantigram Substation",
        "status": "present",
        "checkIn": {
            "time": "2026-11-04T08:55:00Z",
            "timeIST": "08:55 AM IST",
            "latitude": 23.1412,
            "longitude": 72.5489,
            "siteName": "Adani Shantigram Substation"
        },
        "checkOut": {
            "time": "2026-11-04T18:15:00Z",
            "timeIST": "06:15 PM IST",
            "latitude": 23.1412,
            "longitude": 72.5489,
            "siteName": "Adani Shantigram Substation"
        },
        "workingMinutes": 560,
        "distanceTraveledKm": 0.1,
        "distanceTraveledFormatted": "100 m",
        "isHalfDay": False,
        "adminRemarks": "Supervisor site inspection completed"
    }
]


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
        self._last_sync_time: float = 0.0
        self._sync_ttl: float = 10.0

    def __getitem__(self, key: str) -> dict:
        if self.collection_name == "sites" and hasattr(self.db_manager, "_deleted_site_ids") and key in self.db_manager._deleted_site_ids:
            raise KeyError(key)
        if key in self.fallback_dict:
            return self.fallback_dict[key]
        doc = self.db_manager.get_firestore_document(self.collection_name, key)
        if doc is not None:
            if self.collection_name == "sites" and (doc.get("status") == "deleted" or (hasattr(self.db_manager, "_deleted_site_ids") and key in self.db_manager._deleted_site_ids)):
                raise KeyError(key)
            self.fallback_dict[key] = doc
            return doc
        return self.fallback_dict[key]

    def __setitem__(self, key: str, value: dict):
        if self.collection_name == "sites" and hasattr(self.db_manager, "_deleted_site_ids"):
            self.db_manager._deleted_site_ids.discard(key)
        self.fallback_dict[key] = value
        self.db_manager.set_firestore_document_async(self.collection_name, key, value)

    def __delitem__(self, key: str):
        if key in self.fallback_dict:
            del self.fallback_dict[key]
        if self.collection_name == "sites" and hasattr(self.db_manager, "_deleted_site_ids"):
            self.db_manager._deleted_site_ids.add(key)
        self.db_manager.delete_firestore_document_async(self.collection_name, key)

    def __contains__(self, key: str) -> bool:
        if self.collection_name == "sites" and hasattr(self.db_manager, "_deleted_site_ids") and key in self.db_manager._deleted_site_ids:
            return False
        if key in self.fallback_dict:
            return True
        if self.db_manager.is_connected:
            doc = self.db_manager.get_firestore_document(self.collection_name, key)
            if doc is not None:
                if self.collection_name == "sites" and (doc.get("status") == "deleted" or (hasattr(self.db_manager, "_deleted_site_ids") and key in self.db_manager._deleted_site_ids)):
                    return False
                self.fallback_dict[key] = doc
                return True
        return False

    def get(self, key: str, default=None):
        if self.collection_name == "sites" and hasattr(self.db_manager, "_deleted_site_ids") and key in self.db_manager._deleted_site_ids:
            return default
        if key in self.fallback_dict:
            return self.fallback_dict[key]
        doc = self.db_manager.get_firestore_document(self.collection_name, key)
        if doc is not None:
            if self.collection_name == "sites" and (doc.get("status") == "deleted" or (hasattr(self.db_manager, "_deleted_site_ids") and key in self.db_manager._deleted_site_ids)):
                return default
            self.fallback_dict[key] = doc
            return doc
        return default

    def values(self, force_refresh: bool = False) -> List[dict]:
        import time
        now_ts = time.time()

        # Prune deleted sites from in-memory fallback dict
        if self.collection_name == "sites" and hasattr(self.db_manager, "_deleted_site_ids"):
            for d_id in list(self.db_manager._deleted_site_ids):
                self.fallback_dict.pop(d_id, None)

        if not force_refresh and (now_ts - self._last_sync_time) < self._sync_ttl and len(self.fallback_dict) > 0:
            return [
                v for v in self.fallback_dict.values()
                if not (self.collection_name == "sites" and (v.get("status") == "deleted" or (hasattr(self.db_manager, "_deleted_site_ids") and str(v.get("_id")) in self.db_manager._deleted_site_ids)))
            ]

        # Merge local in-memory operational records with remote Firestore documents
        merged = dict(self.fallback_dict)
        remote_docs = self.db_manager.list_firestore_collection(self.collection_name)
        if remote_docs:
            for doc in remote_docs:
                doc_id = doc.get("_id") or doc.get("id")
                if doc_id:
                    # Permanently skip deleted sites
                    if self.collection_name == "sites" and (doc.get("status") == "deleted" or (hasattr(self.db_manager, "_deleted_site_ids") and str(doc_id) in self.db_manager._deleted_site_ids)):
                        merged.pop(doc_id, None)
                        self.fallback_dict.pop(doc_id, None)
                        continue
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
        self._last_sync_time = now_ts
        return [
            v for v in merged.values()
            if not (self.collection_name == "sites" and (v.get("status") == "deleted" or (hasattr(self.db_manager, "_deleted_site_ids") and str(v.get("_id")) in self.db_manager._deleted_site_ids)))
        ]

    def keys(self):
        return [doc.get('_id') or doc.get('id') for doc in self.values() if doc.get('_id') or doc.get('id')]

    def items(self):
        return [(doc.get('_id') or doc.get('id'), doc) for doc in self.values()]


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

        # Seed initial salary configurations
        self._raw_salary_configs: Dict[str, dict] = {}
        self._raw_salary_statements: Dict[str, dict] = {}
        self._raw_location_history: Dict[str, dict] = {}

        # Optional firebase-admin client
        self.admin_db: Optional[Any] = None
        self._deleted_site_ids: Set[str] = set()

        # Collection dict wrappers used by all routers
        self.employees = FirestoreCollectionDictWrapper(self, "employees", self._raw_employees)
        self.sites = FirestoreCollectionDictWrapper(self, "sites", self._raw_sites)
        self.attendance = FirestoreCollectionDictWrapper(self, "attendance", self._raw_attendance)
        self.holidays = FirestoreCollectionDictWrapper(self, "holidays", self._raw_holidays)
        self.salary_configs = FirestoreCollectionDictWrapper(self, "salary_configs", self._raw_salary_configs)
        self.salary_statements = FirestoreCollectionDictWrapper(self, "salary_statements", self._raw_salary_statements)
        self.location_history = FirestoreCollectionDictWrapper(self, "location_history", self._raw_location_history)

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
        is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
        try:
            url = f"{self.firestore_base_url}/sites?key={self.api_key}"
            resp = requests.get(url, timeout=1.5 if is_serverless else 3.0)
            if resp.status_code in [200, 403, 404]:
                # 200 = open/authorized, 403 = active rules configured, 404 = collection empty
                self.is_connected = True
                self.connection_status_message = f"Connected to Firebase Firestore Cloud: {self.project_id}"
                print(f"[Firebase Firestore] {self.connection_status_message}")
                if not is_serverless:
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
            logger.info("Verifying Adani workforce database connection...")
            admin_doc = self._raw_employees.get("emp_admin")
            if admin_doc:
                remote_admin = self.get_firestore_document("employees", "emp_admin")
                if not remote_admin:
                    self.set_firestore_document("employees", "emp_admin", admin_doc)
            logger.info("Database connection to Firebase Firestore confirmed.")
        except Exception as e:
            logger.warning(f"Error verifying Firebase connection: {e}")

    # ---------------------------------------------------------
    # Core Queries
    # ---------------------------------------------------------
    def get_employee(self, emp_id: str) -> Optional[dict]:
        clean_id = (emp_id or "").strip()
        if not clean_id:
            return None
        # Authoritative operational in-memory check first
        if clean_id in self._raw_employees:
            return self._raw_employees[clean_id]
        for e in self._raw_employees.values():
            if str(e.get("employeeId") or "").lower() == clean_id.lower() or str(e.get("_id") or "").lower() == clean_id.lower():
                return e
        # Remote Firestore fallback
        doc = self.get_firestore_document("employees", clean_id)
        if doc:
            self._raw_employees[doc.get("_id") or clean_id] = doc
            return doc
        return None

    def get_user_by_id(self, emp_id: str) -> Optional[dict]:
        """Lookup employee/user by document _id or employeeId identifier"""
        return self.get_employee(emp_id) or self.find_employee_by_identifier(emp_id)

    def get_user_by_employee_id(self, emp_id: str) -> Optional[dict]:
        """Alias lookup employee/user by document _id or employeeId identifier"""
        return self.get_user_by_id(emp_id)

    def find_employee_by_identifier(self, identifier: str) -> Optional[dict]:
        clean_id = (identifier or "").strip().lower()
        if not clean_id:
            return None

        # Direct alias support for operations admin
        if clean_id in ["admin", "b4s/adani/admin", "operations.admin", "admin@adani.com", "admin001", "demo_admin", "demoadmin", "9999999999"]:
            for emp in self._raw_employees.values():
                if str(emp.get("employeeId", "")).upper() == "ADMIN001":
                    return emp
            for emp in self._raw_employees.values():
                if emp.get("role") == "admin":
                    return emp

        # Direct alias support for supervisor
        if clean_id in ["supervisor", "super001", "super01", "suresh", "suresh.patil", "suresh.patil@b4s.in", "b4s/adani/04", "supervisor@adani.com", "9876543210"]:
            for emp in self._raw_employees.values():
                if str(emp.get("employeeId", "")).upper() in ["SUPER001", "SUPER01"] or (emp.get("role") == "supervisor" and "supervisor" in emp.get("name", "").lower()):
                    return emp
            for emp in self._raw_employees.values():
                if emp.get("role") == "supervisor":
                    return emp

        # Direct alias support for technician
        if clean_id in ["tech001", "technician", "demo_technician", "technician@adani.com", "9876543211"]:
            for emp in self._raw_employees.values():
                if str(emp.get("employeeId", "")).upper() == "TECH001":
                    return emp

        # Check phone digits normalization (e.g. 9876543210 vs +91 98765 43210)
        import re
        clean_digits = re.sub(r"\D", "", clean_id)
        if len(clean_digits) > 10 and clean_digits.startswith("91"):
            clean_digits = clean_digits[2:]

        # Check in memory and cached
        for emp in self._raw_employees.values():
            e_id = (emp.get("employeeId") or "").strip().lower()
            e_phone = (emp.get("phone") or "").strip().lower()
            e_email = (emp.get("email") or "").strip().lower()
            if clean_id == e_id or clean_id == e_phone or clean_id == e_email or clean_id == str(emp.get("_id") or "").lower():
                return emp
            if clean_digits and len(clean_digits) >= 10:
                emp_phone_digits = re.sub(r"\D", "", e_phone)
                if len(emp_phone_digits) > 10 and emp_phone_digits.startswith("91"):
                    emp_phone_digits = emp_phone_digits[2:]
                if emp_phone_digits and emp_phone_digits == clean_digits:
                    return emp

        # Check firestore
        all_emps = self.get_all_employees()
        for emp in all_emps:
            e_id = (emp.get("employeeId") or "").strip().lower()
            e_phone = (emp.get("phone") or "").strip().lower()
            e_email = (emp.get("email") or "").strip().lower()
            if clean_id == e_id or clean_id == e_phone or clean_id == e_email or clean_id == str(emp.get("_id") or "").lower():
                return emp
            if clean_digits and len(clean_digits) >= 10:
                emp_phone_digits = re.sub(r"\D", "", e_phone)
                if len(emp_phone_digits) > 10 and emp_phone_digits.startswith("91"):
                    emp_phone_digits = emp_phone_digits[2:]
                if emp_phone_digits and emp_phone_digits == clean_digits:
                    return emp
        return None

    def record_deleted_site(self, site_id: str):
        if not site_id:
            return
        clean_id = str(site_id).strip()
        self._deleted_site_ids.add(clean_id)
        if clean_id in self._raw_sites:
            del self._raw_sites[clean_id]
        if hasattr(self, "sites") and clean_id in self.sites.fallback_dict:
            del self.sites.fallback_dict[clean_id]

    def get_site(self, site_id: str) -> Optional[dict]:
        clean_id = (site_id or "").strip()
        if not clean_id or clean_id in self._deleted_site_ids:
            return None
        if clean_id in self._raw_sites:
            s = self._raw_sites[clean_id]
            if s and s.get("status") != "deleted":
                return s
            return None
        for s in list(self._raw_sites.values()):
            if str(s.get("code") or "").lower() == clean_id.lower() or str(s.get("_id") or "").lower() == clean_id.lower() or str(s.get("id") or "").lower() == clean_id.lower():
                s_id = str(s.get("_id") or s.get("id") or "")
                if s_id in self._deleted_site_ids or s.get("status") == "deleted":
                    return None
                return s
        doc = self.get_firestore_document("sites", clean_id)
        if doc:
            d_id = str(doc.get("_id") or doc.get("id") or clean_id)
            if doc.get("status") == "deleted" or d_id in self._deleted_site_ids:
                return None
            self._raw_sites[d_id] = doc
            return doc
        return None

    def get_all_sites(self) -> List[dict]:
        return list(self.sites.values())

    def get_all_employees(self) -> List[dict]:
        return list(self.employees.values())

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

    def save_location_ping(self, ping: dict) -> dict:
        ping_id = ping.get("_id") or f"loc_{ping.get('employeeId', 'emp')}_{int(datetime.utcnow().timestamp() * 1000)}"
        ping["_id"] = ping_id
        self._raw_location_history[ping_id] = ping
        self.set_firestore_document_async("location_history", ping_id, ping)
        return ping

    def get_location_history(
        self,
        emp_id: str,
        date_str: Optional[str] = None,
        limit: int = 500
    ) -> List[dict]:
        valid_ids = {str(emp_id).lower().strip()}
        emp = self.get_employee(emp_id) or self.find_employee_by_identifier(emp_id)
        if emp:
            for k in ["_id", "id", "employeeId", "code", "phone"]:
                if emp.get(k):
                    valid_ids.add(str(emp[k]).lower().strip())

        all_pings = list(self.location_history.values())
        results = []
        for p in all_pings:
            p_emp = str(p.get("employeeId") or "").lower().strip()
            if p_emp not in valid_ids:
                continue
            if date_str:
                p_date = str(p.get("dateIST") or p.get("date") or "")
                if p_date and p_date != date_str:
                    continue
            results.append(p)

        # Sort chronologically (oldest to newest)
        results.sort(key=lambda x: str(x.get("timestamp") or x.get("time") or ""))
        return results[:limit]


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


    # ---------------------------------------------------------
    # Salary & Compensation Management
    # ---------------------------------------------------------
    def get_salary_config(self, emp_id: str) -> dict:
        emp = self.get_employee(emp_id) or self.find_employee_by_identifier(emp_id)
        c_id = emp.get("employeeId", emp_id).strip().lower() if emp else str(emp_id).strip().lower()
        raw_id = emp.get("_id", emp_id).strip().lower() if emp else str(emp_id).strip().lower()

        # Check existing configs
        for k, cfg in self._raw_salary_configs.items():
            clean_k = str(k).strip().lower()
            if clean_k == c_id or clean_k == raw_id:
                return cfg

        # Default configuration by role if not explicitly set
        role = (emp.get("role") or "technician").lower() if emp else "technician"
        if role == "admin":
            m_sal, a_ded, h_ded = 50000.0, 1000.0, 500.0
        elif role == "supervisor":
            m_sal, a_ded, h_ded = 35000.0, 800.0, 400.0
        else:
            m_sal, a_ded, h_ded = 20000.0, 500.0, 250.0

        canonical = emp.get("employeeId", emp_id) if emp else emp_id
        default_cfg = {
            "employeeId": canonical,
            "monthlySalary": m_sal,
            "absentDeductionRate": a_ded,
            "halfDayDeductionRate": h_ded,
            "effectiveDate": "2026-01-01",
            "updatedAt": datetime.utcnow().isoformat() + "Z",
            "updatedBy": "System Default",
            "notes": f"Default {role} compensation scale"
        }
        self._raw_salary_configs[canonical.lower()] = default_cfg
        return default_cfg

    def set_salary_config(self, emp_id: str, config_data: dict) -> dict:
        emp = self.get_employee(emp_id) or self.find_employee_by_identifier(emp_id)
        canonical = emp.get("employeeId", emp_id) if emp else emp_id
        c_key = canonical.lower()

        existing = self.get_salary_config(emp_id).copy()
        existing.update(config_data)
        existing["employeeId"] = canonical
        existing["updatedAt"] = datetime.utcnow().isoformat() + "Z"

        self._raw_salary_configs[c_key] = existing
        if emp and emp.get("_id"):
            self._raw_salary_configs[str(emp["_id"]).lower()] = existing

        self.set_firestore_document_async("salary_configs", canonical.replace("/", "_"), existing)
        return existing

    def _sync_salary_statements_from_firestore_if_needed(self, force: bool = False):
        """Pre-fetches all Firestore salary statements in a single batch to avoid per-employee N+1 roundtrips."""
        import time
        now_ts = time.time()
        is_synced = getattr(self, "_salary_statements_synced", False)
        last_sync = getattr(self, "_last_salary_statement_sync", 0.0)
        if not force and is_synced and (now_ts - last_sync) < 60.0:
            return

        try:
            remote_docs = self.list_firestore_collection("salary_statements")
            if remote_docs:
                for doc in remote_docs:
                    c = str(doc.get("employeeId") or "").strip()
                    raw_id = str(doc.get("rawId") or doc.get("_id") or "").strip()
                    m = doc.get("month", 10)
                    y = doc.get("year", 2026)
                    safe_c = c.replace('/', '_').lower()
                    safe_r = raw_id.replace('/', '_').lower()
                    for k in [
                        f"{c.lower()}_{y}_{m}",
                        f"{c.lower()}_{m}_{y}",
                        f"{raw_id.lower()}_{y}_{m}",
                        f"{raw_id.lower()}_{m}_{y}",
                        f"{safe_c}_{y}_{m}",
                        f"{safe_c}_{m}_{y}",
                        f"{safe_r}_{y}_{m}",
                        f"{safe_r}_{m}_{y}",
                    ]:
                        if k:
                            self._raw_salary_statements[k] = doc
            self._salary_statements_synced = True
            self._last_salary_statement_sync = now_ts
        except Exception as e:
            logger.warning(f"Error syncing salary statements from Firestore: {e}")

    def get_salary_statement(self, emp_id: str, month: int, year: int) -> Optional[dict]:
        self._sync_salary_statements_from_firestore_if_needed()

        emp = self.get_employee(emp_id) or self.find_employee_by_identifier(emp_id)
        canonical = str((emp.get("employeeId") if emp else None) or emp_id).strip()
        raw_id = str((emp.get("_id") if emp else None) or emp_id).strip()

        safe_canonical = canonical.replace('/', '_').lower()
        safe_raw = raw_id.replace('/', '_').lower()

        # Check all possible RAM keys
        possible_keys = [
            f"{canonical.lower()}_{year}_{month}",
            f"{raw_id.lower()}_{year}_{month}",
            f"{canonical.lower()}_{month}_{year}",
            f"{raw_id.lower()}_{month}_{year}",
            f"{safe_canonical}_{year}_{month}",
            f"{safe_raw}_{year}_{month}",
            f"{safe_canonical}_{month}_{year}",
            f"{safe_raw}_{month}_{year}",
        ]
        for k in possible_keys:
            if k in self._raw_salary_statements:
                return self._raw_salary_statements[k]

        return None

    def save_salary_statement(self, statement: dict) -> dict:
        canonical = str(statement.get("employeeId") or "").strip()
        raw_id = str(statement.get("rawId") or statement.get("_id") or "").strip()
        month = statement.get("month", 10)
        year = statement.get("year", 2026)

        safe_canonical = canonical.replace('/', '_').lower()
        safe_raw = raw_id.replace('/', '_').lower()
        doc_id = f"{safe_canonical}_{year}_{month}"

        possible_keys = [
            f"{canonical.lower()}_{year}_{month}",
            f"{canonical.lower()}_{month}_{year}",
            f"{raw_id.lower()}_{year}_{month}",
            f"{raw_id.lower()}_{month}_{year}",
            f"{safe_canonical}_{year}_{month}",
            f"{safe_canonical}_{month}_{year}",
            f"{safe_raw}_{year}_{month}",
            f"{safe_raw}_{month}_{year}",
        ]
        for pk in possible_keys:
            if pk:
                self._raw_salary_statements[pk] = statement

        self.set_firestore_document_async("salary_statements", doc_id, statement)
        return statement

    def list_salary_statements(self, month: int, year: int) -> List[dict]:
        results = []
        suffix = f"_{year}_{month}"
        for k, v in self._raw_salary_statements.items():
            if k.endswith(suffix):
                results.append(v)
        return results

db = DatabaseManager()
