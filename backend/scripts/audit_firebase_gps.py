from app.core.database import db

def audit():
    emps = db.get_all_employees()
    atts = list(db.attendance.values())
    pings = list(db.location_history.values())

    print("=" * 60)
    print(f"Total Employees in Firebase: {len(emps)}")
    print(f"Total Attendance records: {len(atts)}")
    print(f"Total Location Pings: {len(pings)}")
    print("=" * 60)

    # 1. Employees with direct GPS
    with_gps = [e for e in emps if e.get("latitude") is not None and e.get("longitude") is not None]
    print(f"\n1. Employees with coordinates on profile ({len(with_gps)}):")
    for e in with_gps:
        name = e.get("name")
        code = e.get("employeeId")
        lat = e.get("latitude")
        lon = e.get("longitude")
        ts = e.get("lastSeenTimestamp") or e.get("lastLocationTime") or e.get("lastSeen")
        role = e.get("role")
        print(f"   * {name} ({code}, role: {role}): ({lat}, {lon}) - Last seen: {ts}")

    # 2. Employees with GPS from attendance
    print("\n2. Attendance records with GPS:")
    att_by_emp = {}
    for a in atts:
        eid = a.get("employeeId") or a.get("technicianCode")
        ci = a.get("checkIn") or {}
        co = a.get("checkOut") or {}
        if ci.get("latitude") or co.get("latitude"):
            if eid not in att_by_emp:
                att_by_emp[eid] = []
            att_by_emp[eid].append({
                "date": a.get("date"),
                "ci_lat": ci.get("latitude"),
                "ci_lon": ci.get("longitude"),
                "ci_time": ci.get("timeIST") or ci.get("time"),
                "co_lat": co.get("latitude"),
                "co_lon": co.get("longitude"),
                "co_time": co.get("timeIST") or co.get("time")
            })
    print(f"   Found {len(att_by_emp)} employees with GPS in attendance records:")
    for eid, records in att_by_emp.items():
        print(f"   * Employee ID: {eid} - {len(records)} GPS attendance entries")
        for r in records[:3]:
            print(f"       Date: {r['date']}, CI: ({r['ci_lat']}, {r['ci_lon']} at {r['ci_time']}), CO: ({r['co_lat']}, {r['co_lon']} at {r['co_time']})")

    # 3. Location History Pings
    print(f"\n3. Location History Pings ({len(pings)}):")
    for p in pings[:5]:
        print(f"   * Ping: emp={p.get('employeeId')}, code={p.get('employeeCode')}, lat={p.get('latitude')}, lon={p.get('longitude')}, time={p.get('timestamp')}")

    # 4. Summary of Employees without ANY GPS history
    no_gps = []
    for e in emps:
        eid = e.get("_id")
        code = e.get("employeeId")
        has_profile_gps = e.get("latitude") is not None and e.get("longitude") is not None
        has_att_gps = eid in att_by_emp or code in att_by_emp
        if not has_profile_gps and not has_att_gps:
            no_gps.append(f"{e.get('name')} ({code})")

    print(f"\n4. Employees with NO GPS history anywhere ({len(no_gps)}):")
    for n in no_gps:
        print(f"   * {n}")

if __name__ == "__main__":
    audit()

