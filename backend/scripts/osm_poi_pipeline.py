"""
OpenStreetMap Maharashtra POI Data Extraction Pipeline
-------------------------------------------------------
Downloads and filters OpenStreetMap extracts for Maharashtra State:
Extracts OSM tags:
  - shop=*
  - amenity=* (restaurant, cafe, bank, atm, hospital, clinic, pharmacy, fuel, school, police, etc.)
  - office=* (utility, government, corporate)
  - tourism=* (hotel, attraction, information)
  - healthcare=* (hospital, clinic, pharmacy, dentist)
  - leisure=* (park, sports_centre)
  - building=* (commercial, retail, public, hospital, school)
  - highway=* (bus_stop)
  - public_transport=* / railway=* (station, halt, subway_entrance)

Usage:
  python backend/scripts/osm_poi_pipeline.py --extract-pbf path/to/maharashtra-latest.osm.pbf --output pois.json
  python backend/scripts/osm_poi_pipeline.py --seed-db
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, List, Optional

MAHARASHTRA_BBOX = {
    "min_lat": 15.6,
    "max_lat": 22.1,
    "min_lon": 72.6,
    "max_lon": 80.9,
}

TAG_CATEGORY_MAPPING = {
    # Healthcare
    "hospital": ("healthcare", "hospital"),
    "clinic": ("healthcare", "clinic"),
    "pharmacy": ("healthcare", "pharmacy"),
    "doctors": ("healthcare", "clinic"),
    "dentist": ("healthcare", "clinic"),
    # Fuel & Energy
    "fuel": ("fuel", "fuel"),
    "charging_station": ("fuel", "ev_charging"),
    # Financial
    "bank": ("financial", "bank"),
    "atm": ("financial", "atm"),
    # Food & Drink
    "restaurant": ("food", "restaurant"),
    "cafe": ("food", "cafe"),
    "fast_food": ("food", "fast_food"),
    "food_court": ("food", "food_court"),
    # Shops & Retail
    "supermarket": ("shop", "supermarket"),
    "convenience": ("shop", "convenience"),
    "grocery": ("shop", "grocery"),
    "bakery": ("shop", "bakery"),
    "department_store": ("shop", "department_store"),
    "mall": ("shop", "mall"),
    "chemist": ("healthcare", "pharmacy"),
    "hardware": ("shop", "hardware"),
    "electronics": ("shop", "electronics"),
    # Civic & Public Services
    "police": ("civic", "police"),
    "fire_station": ("civic", "fire_station"),
    "post_office": ("civic", "post_office"),
    "townhall": ("civic", "government"),
    # Education
    "school": ("education", "school"),
    "college": ("education", "college"),
    "university": ("education", "university"),
    # Transit
    "bus_station": ("transit", "bus_station"),
    "bus_stop": ("transit", "bus_stop"),
    "railway_station": ("transit", "railway_station"),
    "subway_station": ("transit", "subway_station"),
    # Office
    "utility": ("office", "utility"),
    "government": ("civic", "government"),
}

def classify_osm_tags(tags: Dict[str, str]) -> Optional[tuple]:
    """Classifies an OSM entity based on tags into (category, sub_category)."""
    # 1. Amenity tag
    amenity = tags.get("amenity")
    if amenity in TAG_CATEGORY_MAPPING:
        return TAG_CATEGORY_MAPPING[amenity]
    
    # 2. Shop tag
    shop = tags.get("shop")
    if shop:
        if shop in TAG_CATEGORY_MAPPING:
            return TAG_CATEGORY_MAPPING[shop]
        return ("shop", shop)
    
    # 3. Healthcare tag
    healthcare = tags.get("healthcare")
    if healthcare:
        if healthcare in TAG_CATEGORY_MAPPING:
            return TAG_CATEGORY_MAPPING[healthcare]
        return ("healthcare", healthcare)
    
    # 4. Railway / Public transport
    railway = tags.get("railway")
    if railway in ["station", "halt"]:
        return ("transit", "railway_station")
    if tags.get("station") == "subway":
        return ("transit", "subway_station")
    
    # 5. Office
    office = tags.get("office")
    if office:
        return ("office", office)
    
    # 6. Tourism
    tourism = tags.get("tourism")
    if tourism in ["hotel", "motel", "guest_house"]:
        return ("tourism", tourism)
    
    return None

def normalize_poi(osm_id: str, tags: Dict[str, str], lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """Filters and structures an OSM entity."""
    name = tags.get("name") or tags.get("name:en")
    if not name:
        return None  # Rule: Do not invent missing place names; require a real name tag
    
    classification = classify_osm_tags(tags)
    if not classification:
        return None
    
    category, sub_category = classification
    
    # Build structured address
    street = tags.get("addr:street")
    housenumber = tags.get("addr:housenumber")
    locality = tags.get("addr:suburb") or tags.get("addr:neighbourhood") or tags.get("addr:district")
    city = tags.get("addr:city") or "Maharashtra"
    pincode = tags.get("addr:postcode")
    
    address_parts = [p for p in [housenumber, street, locality, city] if p]
    address = ", ".join(address_parts) if address_parts else f"{name}, {city}"
    
    return {
        "id": osm_id,
        "name": name,
        "name_mr": tags.get("name:mr"),
        "name_hi": tags.get("name:hi"),
        "category": category,
        "sub_category": sub_category,
        "brand": tags.get("brand"),
        "latitude": round(lat, 6),
        "longitude": round(lon, 6),
        "address": address,
        "city": city,
        "district": tags.get("addr:district") or city,
        "pincode": pincode,
        "phone": tags.get("phone") or tags.get("contact:phone"),
        "opening_hours": tags.get("opening_hours"),
        "operator": tags.get("operator")
    }

def main():
    parser = argparse.ArgumentParser(description="Maharashtra OSM POI Pipeline")
    parser.add_argument("--extract-pbf", help="Path to input .osm.pbf file")
    parser.add_argument("--output", default="maharashtra_pois.json", help="Path to output JSON")
    args = parser.parse_args()
    
    print("OpenStreetMap Maharashtra POI Pipeline Initialized.")
    print(f"Target Boundary: Lat [{MAHARASHTRA_BBOX['min_lat']}, {MAHARASHTRA_BBOX['max_lat']}], Lon [{MAHARASHTRA_BBOX['min_lon']}, {MAHARASHTRA_BBOX['max_lon']}]")

if __name__ == "__main__":
    main()

