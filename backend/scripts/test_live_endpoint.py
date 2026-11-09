import asyncio
from app.routers.tracking import get_live_fleet_radar

async def main():
    res = await get_live_fleet_radar({"id": "test_admin", "role": "admin"})
    techs = res["technicians"]
    summary = res["summary"]
    print("=" * 60)
    print("FLEET RADAR SUMMARY:")
    for k, v in summary.items():
        print(f"  {k}: {v}")
    print("=" * 60)

    has_gps = [t for t in techs if t["hasGps"]]
    no_gps = [t for t in techs if not t["hasGps"]]

    print(f"\nTechnicians with Real GPS ({len(has_gps)}):")
    for t in has_gps:
        print(f"  * {t['name']} ({t['employeeId']}): coords=({t['latitude']}, {t['longitude']}) | {t['displayLabel']} | {t['lastLocationUpdate']}")

    print(f"\nTechnicians with NO Location ({len(no_gps)}):")
    for t in no_gps[:5]:
        print(f"  * {t['name']} ({t['employeeId']}): {t['displayLabel']} | coords=({t['latitude']}, {t['longitude']})")

if __name__ == "__main__":
    asyncio.run(main())

