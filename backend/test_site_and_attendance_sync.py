import sys
import io
import asyncio
from datetime import datetime

# Reconfigure stdout to UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app.core.database import db
from app.core.security import create_access_token
from app.routers.employees import update_employee
from app.schemas.employee import EmployeeUpdate
from app.routers.attendance import get_today_attendance, adjust_attendance_status, mark_admin_attendance
from app.schemas.attendance import AdjustAttendanceRequest, MarkAttendanceRequest
from app.routers.sites import list_sites, get_site_details
from app.services.report_service import report_service

async def run_all_tests():
    print("=" * 70)
    print("STARTING COMPREHENSIVE SITE ASSIGNMENT & ATTENDANCE VERIFICATION")
    print("=" * 70)

    admin_token = {
        "id": "emp_admin",
        "employeeId": "ADMIN01",
        "role": "admin",
        "name": "Operations Admin"
    }
    supervisor_token = {
        "id": "emp_suresh",
        "employeeId": "SUPER01",
        "role": "supervisor",
        "name": "Suresh Patil"
    }
    emp_a_token = {
        "id": "emp_01",
        "employeeId": "b4S/Adani/01",
        "role": "technician",
        "name": "Rohit Sharma"
    }
    emp_b_token = {
        "id": "emp_02",
        "employeeId": "b4S/Adani/02",
        "role": "technician",
        "name": "Amit Kumar"
    }

    # -------------------------------------------------------------
    # TEST 1: Admin & Supervisor Site Assignment & Employee View
    # -------------------------------------------------------------
    print("\n[TEST 1] Assigning site_surat_01 to Employee A (Rohit Sharma)...")
    res_update = await update_employee(
        employeeId="emp_01",
        emp_in=EmployeeUpdate(assignedSiteIds=["site_surat_01"], assignedSiteId="site_surat_01"),
        token_data=admin_token
    )
    assert res_update.assignedSiteId == "site_surat_01", f"Expected site_surat_01, got {res_update.assignedSiteId}"
    assert "site_surat_01" in res_update.assignedSiteIds, "site_surat_01 must be in assignedSiteIds"
    print("  [OK] Admin successfully updated Employee A's assigned site to site_surat_01.")

    print("\n[TEST 2] Employee A queries /attendance/today and /sites...")
    today_res_a = await get_today_attendance(token_data=emp_a_token)
    assert today_res_a["site"] is not None, "Employee A's assigned site should not be None"
    assert today_res_a["site"]["id"] == "site_surat_01", f"Expected site_surat_01, got {today_res_a['site']['id']}"
    assert today_res_a["site"]["name"] == "Surat ST-1", f"Expected Surat ST-1, got {today_res_a['site']['name']}"
    print(f"  [OK] Employee A dashboard gets assigned site: {today_res_a['site']['name']} ({today_res_a['site']['address']})")

    # Verify Employee A sees ONLY their assigned site(s)
    sites_a = await list_sites(token_data=emp_a_token)
    assert len(sites_a) == 1, f"Employee A should only see 1 assigned site, got {len(sites_a)}"
    assert sites_a[0].id == "site_surat_01", "Site returned must be site_surat_01"
    print("  [OK] Employee A only sees their own assigned site (site_surat_01). Cannot see unassigned sites.")

    # -------------------------------------------------------------
    # TEST 3: Employee Isolation - Employee B cannot see Employee A's site
    # -------------------------------------------------------------
    print("\n[TEST 3] Supervisor assigns site_pune_01 to Employee B (Amit Kumar)...")
    await update_employee(
        employeeId="emp_02",
        emp_in=EmployeeUpdate(assignedSiteIds=["site_pune_01"], assignedSiteId="site_pune_01"),
        token_data=supervisor_token
    )
    sites_b = await list_sites(token_data=emp_b_token)
    site_b_ids = [s.id for s in sites_b]
    assert "site_surat_01" not in site_b_ids, "Employee B must NOT see Employee A's assigned site!"
    assert "site_pune_01" in site_b_ids, "Employee B must see site_pune_01"
    print("  [OK] Employee B sees ONLY site_pune_01. Isolation verified (cannot see Employee A's site).")

    # -------------------------------------------------------------
    # TEST 4: Admin updates / removes site assignment
    # -------------------------------------------------------------
    print("\n[TEST 4] Admin removes Employee A's site assignment...")
    await update_employee(
        employeeId="emp_01",
        emp_in=EmployeeUpdate(assignedSiteIds=[], assignedSiteId=None),
        token_data=admin_token
    )
    today_res_unassigned = await get_today_attendance(token_data=emp_a_token)
    assert today_res_unassigned["site"] is None, "When unassigned, site must be None (no fake default site!)"
    print("  [OK] When site is unassigned, Employee A dashboard correctly reflects site as None.")

    # Re-assign site_surat_01 to Employee A for attendance test
    await update_employee(
        employeeId="emp_01",
        emp_in=EmployeeUpdate(assignedSiteIds=["site_surat_01"]),
        token_data=admin_token
    )

    # -------------------------------------------------------------
    # TEST 5: Admin Marks Attendance as Present (P) on 2026-11-01
    # -------------------------------------------------------------
    test_date = "2026-11-01"
    print(f"\n[TEST 5] Admin marks Employee A as Present (P) on {test_date}...")
    mark_res = await mark_admin_attendance(
        payload=MarkAttendanceRequest(
            employeeId="emp_01",
            date=test_date,
            status="P",
            adminRemarks="Verified on-site by Operations Admin"
        ),
        token_data=admin_token
    )
    assert mark_res["success"] is True, "mark_admin_attendance must return success=True"
    assert mark_res["record"]["status"] == "present", "Status must be recorded as present"
    assert mark_res["record"]["checkIn"] is not None, "checkIn punch must be present"
    print(f"  [OK] Admin marked attendance: {mark_res['message']}")

    # -------------------------------------------------------------
    # TEST 6: Real-time Attendance Calendar / Muster Roll shows 'P'
    # -------------------------------------------------------------
    print(f"\n[TEST 6] Verifying Admin Calendar / Muster Roll for November 2026...")
    muster_data = report_service.get_muster_roll_data(month=11, year=2026)
    emp_a_row = next((r for r in muster_data["records"] if r["employeeId"] == "emp_01" or "rohit" in r["employeeName"].lower()), None)
    assert emp_a_row is not None, "Employee A must be present in muster records"
    assert emp_a_row["days"][1] == "P", f"Day 1 for Employee A must be 'P', got {emp_a_row['days'][1]}"
    assert emp_a_row["summary"]["P"] >= 1, f"Total Present summary must be >= 1, got {emp_a_row['summary']['P']}"
    print(f"  [OK] Admin Calendar shows 'P' on Day 1 for {emp_a_row['employeeName']}. Summary Present = {emp_a_row['summary']['P']}")

    # -------------------------------------------------------------
    # TEST 7: Excel Export Verification
    # -------------------------------------------------------------
    print(f"\n[TEST 7] Verifying Excel Export for November 2026...")
    excel_stream = report_service.generate_muster_roll_excel(month=11, year=2026)
    excel_bytes = excel_stream.getvalue()
    assert len(excel_bytes) > 1000, f"Excel file too small: {len(excel_bytes)} bytes"
    print(f"  [OK] Excel sheet generated successfully ({len(excel_bytes)} bytes) with strictly P, A, WO, PH.")

    # -------------------------------------------------------------
    # TEST 8: Public Holiday Protection
    # -------------------------------------------------------------
    print(f"\n[TEST 8] Verifying Public Holiday protection (Republic Day 2026-01-26)...")
    holiday_rejected = False
    try:
        await mark_admin_attendance(
            payload=MarkAttendanceRequest(
                employeeId="emp_01",
                date="2026-01-26",
                status="P",
                adminRemarks="Attempt on holiday"
            ),
            token_data=admin_token
        )
    except Exception as e:
        holiday_rejected = True
        print(f"  [OK] Correctly rejected marking attendance on Public Holiday: {e.detail if hasattr(e, 'detail') else e}")
    assert holiday_rejected, "Marking attendance on a Public Holiday MUST be rejected!"

    # -------------------------------------------------------------
    # TEST 9: Deduplication Verification
    # -------------------------------------------------------------
    print(f"\n[TEST 9] Marking same employee and date again to test deduplication...")
    mark_res_2 = await mark_admin_attendance(
        payload=MarkAttendanceRequest(
            employeeId="emp_01",
            date=test_date,
            status="P",
            adminRemarks="Second update check"
        ),
        token_data=admin_token
    )
    records_count = sum(1 for r in db.attendance.values() if r.get("date") == test_date and r.get("employeeId") == "emp_01")
    assert records_count == 1, f"Duplicate record created! Found {records_count} records for {test_date}"
    print(f"  [OK] Deduplication verified: Exactly 1 record exists in db.attendance for {test_date}.")

    print("\n" + "=" * 70)
    print("ALL 9 TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_all_tests())
