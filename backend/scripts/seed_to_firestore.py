import os
import sys
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.core.config import settings
from app.core.database import db, dict_to_firestore_doc

def push_all_data():
    project_id = settings.FIREBASE_PROJECT_ID
    api_key = settings.FIREBASE_API_KEY
    base_url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents"

    print(f"Connecting to Firestore Project: {project_id}")
    print(f"Target URL: {base_url}\n")

    # 1. Test write
    test_url = f"{base_url}/test_connection/status?key={api_key}"
    test_payload = dict_to_firestore_doc({"status": "connected", "time": "now"})
    resp = requests.patch(test_url, json=test_payload, timeout=5)

    if resp.status_code == 403:
        print("[PERMISSION ERROR] Firestore Security Rules are blocking writes (HTTP 403 PERMISSION_DENIED).")
        print("Please enable read/write in Firebase Console -> Firestore Database -> Rules tab:")
        print("---------------------------------------------------------------------------------")
        print("rules_version = '2';")
        print("service cloud.firestore {")
        print("  match /databases/{database}/documents {")
        print("    match /{document=**} {")
        print("      allow read, write: if true;")
        print("    }")
        print("  }")
        print("}")
        print("---------------------------------------------------------------------------------")
        return False

    if resp.status_code not in [200, 201]:
        print(f"[ERROR] Failed with status {resp.status_code}: {resp.text}")
        return False

    print("[SUCCESS] Permission check passed! Seeding all collections to Firebase Firestore...\n")

    # 2. Upload Sites
    print(f"-> Uploading {len(db._raw_sites)} Sites...")
    for s_id, site in db._raw_sites.items():
        url = f"{base_url}/sites/{s_id}?key={api_key}"
        payload = dict_to_firestore_doc(site)
        r = requests.patch(url, json=payload)
        if r.status_code in [200, 201]:
            print(f"   [OK] Site: {site.get('name')} ({s_id})")
        else:
            print(f"   [FAIL] Site {s_id}: {r.status_code}")

    # 3. Upload Employees
    print(f"\n-> Uploading {len(db._raw_employees)} Employees...")
    for e_id, emp in db._raw_employees.items():
        url = f"{base_url}/employees/{e_id}?key={api_key}"
        payload = dict_to_firestore_doc(emp)
        r = requests.patch(url, json=payload)
        if r.status_code in [200, 201]:
            print(f"   [OK] Employee: {emp.get('name')} ({emp.get('employeeId')})")
        else:
            print(f"   [FAIL] Employee {e_id}: {r.status_code}")

    # 4. Upload Attendance Records
    attendance_items = list(db._raw_attendance.items())[:35]
    print(f"\n-> Uploading {len(attendance_items)} Attendance Records...")
    for a_id, att in attendance_items:
        url = f"{base_url}/attendance/{a_id}?key={api_key}"
        payload = dict_to_firestore_doc(att)
        r = requests.patch(url, json=payload)
        if r.status_code in [200, 201]:
            print(f"   [OK] Attendance: {a_id}")
        else:
            print(f"   [FAIL] Attendance {a_id}: {r.status_code}")

    print("\n[ALL DONE] All collections have been created and populated in Firebase Firestore!")
    return True

if __name__ == "__main__":
    push_all_data()

