import sys
import os
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from app.main import app
from app.core.database import db

def test_site_assignment_flow():
    client = TestClient(app)
    
    print("--- 1. Login as Admin Anita Sharma ---")
    admin_login = client.post("/auth/login", json={
        "username": "b4S/Adani/Admin",
        "password": "password"
    })
    assert admin_login.status_code == 200, f"Admin login failed: {admin_login.text}"
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    admin_user = admin_login.json()["user"]
    print(f"Admin Logged In: {admin_user['name']} | Role: {admin_user['role']} | Phone: {admin_user['phone']}")

    print("\n--- 2. Admin Assigns Site 'site_surat_01' to Rohit Sharma (b4S/Adani/01) ---")
    emp_update_resp = client.put(
        "/employees/b4S%2FAdani%2F01",
        json={
            "assignedSiteId": "site_surat_01",
            "assignedSiteIds": ["site_surat_01", "site_st_joseph"]
        },
        headers=admin_headers
    )
    assert emp_update_resp.status_code == 200, f"Employee update failed: {emp_update_resp.text}"
    emp_data = emp_update_resp.json()
    print("Updated Employee Data:")
    print(f"  Assigned Site: {emp_data.get('assignedSiteId')}")
    print(f"  Assigned Sites: {emp_data.get('assignedSiteIds')}")
    print(f"  Assigned By: {emp_data.get('assignedBy')}")
    print(f"  Contact Phone: {emp_data.get('assignedByPhone')}")
    print(f"  Assigner Role: {emp_data.get('assignedByRole')}")
    print(f"  Assigned At: {emp_data.get('assignedAt')}")

    assert emp_data.get("assignedBy") == "Anita Sharma", f"Expected 'Anita Sharma', got {emp_data.get('assignedBy')}"
    assert emp_data.get("assignedByPhone") == "9876543299", f"Expected '9876543299', got {emp_data.get('assignedByPhone')}"
    assert emp_data.get("assignedByRole") == "admin", f"Expected 'admin', got {emp_data.get('assignedByRole')}"

    print("\n--- 3. Employee Rohit Sharma Logins and Checks /attendance/today & /auth/me ---")
    emp_login = client.post("/auth/login", json={
        "username": "b4S/Adani/01",
        "password": "password"
    })
    assert emp_login.status_code == 200, f"Employee login failed: {emp_login.text}"
    emp_token = emp_login.json()["access_token"]
    emp_headers = {"Authorization": f"Bearer {emp_token}"}

    today_resp = client.get("/attendance/today", headers=emp_headers)
    assert today_resp.status_code == 200, f"Today attendance failed: {today_resp.text}"
    today_data = today_resp.json()
    primary_site = today_data.get("site")
    print("Employee Today Attendance Response:")
    print(f"  Primary Site: {primary_site.get('name') if primary_site else None}")
    print(f"  Location: {primary_site.get('address') if primary_site else None}")
    print(f"  Assigned By: {today_data.get('assignedBy')}")
    print(f"  Assigned Phone: {today_data.get('assignedByPhone')}")
    print(f"  Site.Assigned By: {primary_site.get('assignedBy') if primary_site else None}")
    print(f"  Site.Contact: {primary_site.get('assignedByPhone') if primary_site else None}")

    assert today_data.get("assignedBy") == "Anita Sharma"
    assert today_data.get("assignedByPhone") == "9876543299"
    assert primary_site.get("assignedBy") == "Anita Sharma"

    print("\n--- 4. Supervisor Suresh Patil Logins and Reassigns Site ---")
    sup_login = client.post("/auth/login", json={
        "username": "SUPER01",
        "password": "password"
    })
    assert sup_login.status_code == 200, f"Supervisor login failed: {sup_login.text}"
    sup_token = sup_login.json()["access_token"]
    sup_headers = {"Authorization": f"Bearer {sup_token}"}
    sup_user = sup_login.json()["user"]
    print(f"Supervisor Logged In: {sup_user['name']} | Role: {sup_user['role']} | Phone: {sup_user['phone']}")

    print("\n--- 5. Supervisor Reassigns Site 'site_st_joseph' to Rohit Sharma ---")
    sup_reassign_resp = client.put(
        "/employees/b4S%2FAdani%2F01",
        json={
            "assignedSiteId": "site_st_joseph",
            "assignedSiteIds": ["site_st_joseph", "site_pune_01"]
        },
        headers=sup_headers
    )
    assert sup_reassign_resp.status_code == 200, f"Supervisor reassignment failed: {sup_reassign_resp.text}"
    reassigned_emp = sup_reassign_resp.json()
    print("Reassigned Employee Data:")
    print(f"  New Primary Site: {reassigned_emp.get('assignedSiteId')}")
    print(f"  Assigned By: {reassigned_emp.get('assignedBy')}")
    print(f"  Contact Phone: {reassigned_emp.get('assignedByPhone')}")
    print(f"  Assigner Role: {reassigned_emp.get('assignedByRole')}")

    assert reassigned_emp.get("assignedBy") == "Suresh Patil", f"Expected 'Suresh Patil', got {reassigned_emp.get('assignedBy')}"
    assert reassigned_emp.get("assignedByPhone") == "9876543214", f"Expected '9876543214', got {reassigned_emp.get('assignedByPhone')}"
    assert reassigned_emp.get("assignedByRole") == "supervisor"

    print("\n--- 6. Verify Employee Dashboard /attendance/today shows updated Supervisor Details ---")
    today_resp_2 = client.get("/attendance/today", headers=emp_headers)
    assert today_resp_2.status_code == 200
    today_data_2 = today_resp_2.json()
    primary_site_2 = today_data_2.get("site")
    print("Updated Employee Dashboard Data:")
    print(f"  Site: {primary_site_2.get('name')}")
    print(f"  Location: {primary_site_2.get('address')}")
    print(f"  Assigned By: {primary_site_2.get('assignedBy')}")
    print(f"  Contact: {primary_site_2.get('assignedByPhone')}")

    assert primary_site_2.get("name") == "st. joseph university"
    assert primary_site_2.get("assignedBy") == "Suresh Patil"
    assert primary_site_2.get("assignedByPhone") == "9876543214"
    assert today_data_2.get("assignedBy") == "Suresh Patil"
    assert today_data_2.get("assignedByPhone") == "9876543214"

    print("\n--- 7. Privacy & Isolation: Employee cannot view unassigned site ---")
    unassigned_site_resp = client.get("/sites/site_pune_02", headers=emp_headers)
    print(f"Attempting to access unassigned site: Status {unassigned_site_resp.status_code}")
    assert unassigned_site_resp.status_code == 403, f"Expected 403, got {unassigned_site_resp.status_code}"

    print("\n===========================================")
    print("ALL SITE ASSIGNMENT VERIFICATION TESTS PASSED!")
    print("===========================================")

if __name__ == "__main__":
    test_site_assignment_flow()

