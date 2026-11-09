import os
import json
import math
import time
import urllib.request
import urllib.parse
from typing import List, Dict, Any, Optional, Tuple
from app.utils.haversine import calculate_haversine_distance

CATEGORY_METADATA = {
    "healthcare": {"label": "Hospitals & Pharmacies", "icon": "cross", "color": "#DC2626"},
    "fuel": {"label": "Petrol Pumps & EV", "icon": "fuel", "color": "#D97706"},
    "financial": {"label": "Banks & ATMs", "icon": "dollar-sign", "color": "#2563EB"},
    "food": {"label": "Restaurants & Cafes", "icon": "utensils", "color": "#EA580C"},
    "shop": {"label": "Shops & Supermarkets", "icon": "shopping-bag", "color": "#0284C7"},
    "transit": {"label": "Railway & Metro Stations", "icon": "train", "color": "#475569"},
    "civic": {"label": "Police & Public Offices", "icon": "shield", "color": "#7C3AED"},
    "education": {"label": "Schools & Colleges", "icon": "book-open", "color": "#8B5CF6"},
    "office": {"label": "Offices & Utilities", "icon": "briefcase", "color": "#0D9488"},
}

class PlacesService:
    def __init__(self):
        self._pois: List[Dict[str, Any]] = []
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._cache_ttl = 900  # 15 minutes TTL
        self._load_seed_data()

    def _load_seed_data(self):
        """Loads curated Maharashtra POIs from disk or fallback."""
        data_path = os.path.join(os.path.dirname(__file__), "..", "data", "maharashtra_poi_seed.json")
        data_path = os.path.abspath(data_path)
        if os.path.exists(data_path):
            try:
                with open(data_path, "r", encoding="utf-8") as f:
                    self._pois = json.load(f)
                print(f"[PlacesService] Loaded {len(self._pois)} Maharashtra POIs from {data_path}")
            except Exception as e:
                print(f"[PlacesService Error] Failed to load POIs: {e}")
                self._pois = []
        else:
            print(f"[PlacesService Warning] Seed file not found at {data_path}")
            self._pois = []

        if not self._pois:
            try:
                # In-memory fallback if JSON file path differs in serverless container
                from backend.scripts.generate_poi_seed import SEED_POIS
                self._pois = list(SEED_POIS)
                print(f"[PlacesService] Loaded {len(self._pois)} fallback POIs")
            except Exception:
                try:
                    from scripts.generate_poi_seed import SEED_POIS
                    self._pois = list(SEED_POIS)
                except Exception:
                    pass

    def _classify_poi(self, place_type: str, class_type: str, name: str, display_name: str) -> str:
        """Classifies an OSM place into one of the 9 core categories."""
        combined = f"{place_type} {class_type} {name} {display_name}".lower()
        if any(k in combined for k in ["hospital", "pharmacy", "clinic", "doctor", "health", "dispensary", "chemist"]):
            return "healthcare"
        if any(k in combined for k in ["fuel", "petrol", "diesel", "gas_station", "charging_station", "cng"]):
            return "fuel"
        if any(k in combined for k in ["bank", "atm", "sbi", "hdfc", "icici", "financial"]):
            return "financial"
        if any(k in combined for k in ["restaurant", "cafe", "fast_food", "bakery", "dhaba", "food", "hotel", "eatery"]):
            return "food"
        if any(k in combined for k in ["shop", "supermarket", "convenience", "mall", "mart", "bazaar", "store", "grocer", "retail"]):
            return "shop"
        if any(k in combined for k in ["railway", "station", "train", "metro", "bus_stop", "bus_station", "airport", "transit"]):
            return "transit"
        if any(k in combined for k in ["school", "college", "university", "institute", "vidyalaya", "education"]):
            return "education"
        if any(k in combined for k in ["police", "chowki", "post_office", "municipal", "ward", "court", "government"]):
            return "civic"
        return "office"

    def _fetch_live_osm_search(self, query: str, lat: Optional[float] = None, lon: Optional[float] = None, limit: int = 25) -> List[Dict[str, Any]]:
        """Queries real-world places from Nominatim / OpenStreetMap with strict error boundaries."""
        try:
            # Query within Maharashtra / India
            clean_query = query.strip()
            if "maharashtra" not in clean_query.lower() and "india" not in clean_query.lower():
                search_q = f"{clean_query}, Maharashtra"
            else:
                search_q = clean_query

            params = {
                "q": search_q,
                "countrycodes": "in",
                "format": "json",
                "addressdetails": "1",
                "limit": str(min(limit, 30)),
            }
            if lat is not None and lon is not None:
                params["lat"] = str(lat)
                params["lon"] = str(lon)

            url = f"https://nominatim.openstreetmap.org/search?{urllib.parse.urlencode(params)}"
            req = urllib.request.Request(url, headers={"User-Agent": "AdaniSmartMeterWorkforce/1.0 (internal-workforce-tool)"})
            with urllib.request.urlopen(req, timeout=3.5) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            results = []
            for item in data:
                try:
                    p_lat = float(item["lat"])
                    p_lon = float(item["lon"])
                except (ValueError, KeyError):
                    continue

                addr = item.get("address", {})
                name = item.get("name") or item.get("display_name", "").split(",")[0].strip()
                p_type = item.get("type", "")
                p_class = item.get("class", "")
                category = self._classify_poi(p_type, p_class, name, item.get("display_name", ""))
                meta = CATEGORY_METADATA.get(category, {"label": "Place", "icon": "map-pin", "color": "#64748B"})

                city = addr.get("city") or addr.get("town") or addr.get("suburb") or addr.get("district") or "Maharashtra"
                district = addr.get("state_district") or addr.get("county") or ""
                road = addr.get("road") or addr.get("neighbourhood") or ""

                results.append({
                    "id": f"osm-{item.get('osm_id', id(item))}",
                    "name": name,
                    "category": category,
                    "sub_category": p_type or p_class,
                    "latitude": p_lat,
                    "longitude": p_lon,
                    "address": item.get("display_name", f"{name}, {city}"),
                    "city": city,
                    "district": district,
                    "road": road,
                    "source": "osm_live",
                    "category_label": meta["label"],
                    "category_icon": meta["icon"],
                    "category_color": meta["color"],
                })

            return results
        except Exception as e:
            print(f"[PlacesService] Live OSM search failed ({query}): {e}")
            return []

    def get_categories(self) -> List[Dict[str, Any]]:
        """Returns all distinct POI categories with display metadata and counts."""
        counts = {}
        for p in self._pois:
            cat = p.get("category", "other")
            counts[cat] = counts.get(cat, 0) + 1

        result = []
        for cat_key, meta in CATEGORY_METADATA.items():
            result.append({
                "id": cat_key,
                "label": meta["label"],
                "icon": meta["icon"],
                "color": meta["color"],
                "count": counts.get(cat_key, 0)
            })
        return result

    def search_nearby(
        self,
        lat: float,
        lon: float,
        radius_meters: float = 1000.0,
        category: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Finds places within radius_meters from employee coordinates.
        Checks in-memory cache, queries seed and live places, and computes exact Haversine distance.
        """
        if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
            return []

        cache_key = f"nearby_{round(lat, 4)}_{round(lon, 4)}_{int(radius_meters)}_{category or 'all'}_{(query or '').lower().strip()}_{limit}"
        now = time.time()
        if cache_key in self._cache:
            ts, cached_data = self._cache[cache_key]
            if now - ts < self._cache_ttl:
                return cached_data

        # 1. Search seed POIs
        lat_delta = radius_meters / 111320.0
        cos_lat = math.cos(math.radians(lat))
        lon_delta = radius_meters / (111320.0 * max(0.1, cos_lat))

        min_lat = lat - lat_delta
        max_lat = lat + lat_delta
        min_lon = lon - lon_delta
        max_lon = lon + lon_delta

        norm_query = query.lower().strip() if query else None
        norm_category = category.lower().strip() if category and category.lower() != 'all' else None

        matched = []
        for poi in self._pois:
            p_lat = poi.get("latitude")
            p_lon = poi.get("longitude")
            if p_lat is None or p_lon is None:
                continue

            if not (min_lat <= p_lat <= max_lat and min_lon <= p_lon <= max_lon):
                continue

            p_cat = (poi.get("category") or "").lower()
            p_subcat = (poi.get("sub_category") or "").lower()
            if norm_category:
                if norm_category != p_cat and norm_category != p_subcat:
                    continue

            if norm_query:
                p_name = (poi.get("name") or "").lower()
                p_addr = (poi.get("address") or "").lower()
                if not (norm_query in p_name or norm_query in p_addr or norm_query in p_subcat):
                    continue

            dist_m = calculate_haversine_distance(lat, lon, p_lat, p_lon)
            if dist_m <= radius_meters:
                formatted_dist = f"{int(round(dist_m))} m" if dist_m < 1000 else f"{round(dist_m / 1000.0, 2)} km"
                cat_meta = CATEGORY_METADATA.get(poi.get("category", ""), {"label": "Place", "icon": "map-pin", "color": "#64748B"})
                matched.append({
                    **poi,
                    "distance_meters": dist_m,
                    "formatted_distance": formatted_dist,
                    "distance_type": "straight_line",
                    "category_label": cat_meta["label"],
                    "category_icon": cat_meta["icon"],
                    "category_color": cat_meta["color"],
                })

        # 2. If fewer than 5 seed results or specific category requested, fetch live OSM POIs
        if len(matched) < 5:
            search_terms = norm_query or (CATEGORY_METADATA.get(norm_category, {}).get("label") if norm_category else "hospital, petrol pump, bank, restaurant")
            live_places = self._fetch_live_osm_search(search_terms, lat=lat, lon=lon, limit=limit)
            seen_ids = set(m.get("id") for m in matched)

            for lp in live_places:
                if lp["id"] in seen_ids:
                    continue
                dist_m = calculate_haversine_distance(lat, lon, lp["latitude"], lp["longitude"])
                if dist_m <= radius_meters * 1.5:  # accept slightly wider radius for live lookups
                    formatted_dist = f"{int(round(dist_m))} m" if dist_m < 1000 else f"{round(dist_m / 1000.0, 2)} km"
                    matched.append({
                        **lp,
                        "distance_meters": dist_m,
                        "formatted_distance": formatted_dist,
                        "distance_type": "straight_line",
                    })
                    seen_ids.add(lp["id"])

        matched.sort(key=lambda x: x["distance_meters"])
        result = matched[:limit]
        self._cache[cache_key] = (now, result)
        return result

    def search_text(
        self,
        query: str,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        limit: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Free-text search across POI names, brands, streets, and categories.
        Combines local database results with real-world live Nominatim search.
        """
        norm_query = query.lower().strip()
        if not norm_query:
            return []

        cache_key = f"search_{norm_query}_{round(lat or 0, 3)}_{round(lon or 0, 3)}_{limit}"
        now = time.time()
        if cache_key in self._cache:
            ts, cached_data = self._cache[cache_key]
            if now - ts < self._cache_ttl:
                return cached_data

        scored_results = []
        seen_names = set()

        # 1. Search local curated POIs
        for poi in self._pois:
            p_name = (poi.get("name") or "").lower()
            p_mr = (poi.get("name_mr") or "").lower()
            p_brand = (poi.get("brand") or "").lower()
            p_addr = (poi.get("address") or "").lower()
            p_city = (poi.get("city") or "").lower()
            p_subcat = (poi.get("sub_category") or "").lower()

            score = 0
            if norm_query == p_name:
                score += 100
            elif p_name.startswith(norm_query):
                score += 65
            elif norm_query in p_name:
                score += 45

            if norm_query in p_mr:
                score += 50
            if p_brand and (norm_query in p_brand):
                score += 35
            if norm_query in p_subcat:
                score += 30
            if norm_query in p_addr or norm_query in p_city:
                score += 20

            if score > 0:
                dist_m = None
                formatted_dist = None
                if lat is not None and lon is not None:
                    p_lat = poi.get("latitude")
                    p_lon = poi.get("longitude")
                    if p_lat is not None and p_lon is not None:
                        dist_m = calculate_haversine_distance(lat, lon, p_lat, p_lon)
                        formatted_dist = f"{int(round(dist_m))} m" if dist_m < 1000 else f"{round(dist_m / 1000.0, 2)} km"
                        if dist_m < 5000:
                            score += (5000 - dist_m) / 200.0

                cat_meta = CATEGORY_METADATA.get(poi.get("category", ""), {"label": "Place", "icon": "map-pin", "color": "#64748B"})
                scored_results.append({
                    **poi,
                    "search_score": round(score, 1),
                    "distance_meters": dist_m,
                    "formatted_distance": formatted_dist,
                    "distance_type": "straight_line" if dist_m is not None else None,
                    "category_label": cat_meta["label"],
                    "category_icon": cat_meta["icon"],
                    "category_color": cat_meta["color"],
                })
                seen_names.add(poi.get("name", "").lower())

        # 2. Fetch live real-world places from Nominatim
        live_places = self._fetch_live_osm_search(query, lat=lat, lon=lon, limit=limit)
        for lp in live_places:
            lp_name = lp.get("name", "").lower()
            if lp_name in seen_names:
                continue

            dist_m = None
            formatted_dist = None
            score = 50  # baseline live match score
            if lat is not None and lon is not None:
                dist_m = calculate_haversine_distance(lat, lon, lp["latitude"], lp["longitude"])
                formatted_dist = f"{int(round(dist_m))} m" if dist_m < 1000 else f"{round(dist_m / 1000.0, 2)} km"
                if dist_m < 10000:
                    score += max(0, (10000 - dist_m) / 300.0)

            scored_results.append({
                **lp,
                "search_score": round(score, 1),
                "distance_meters": dist_m,
                "formatted_distance": formatted_dist,
                "distance_type": "straight_line" if dist_m is not None else None,
            })
            seen_names.add(lp_name)

        scored_results.sort(key=lambda x: x.get("search_score", 0), reverse=True)
        final_res = scored_results[:limit]
        self._cache[cache_key] = (now, final_res)
        return final_res

    def reverse_geocode(self, lat: float, lon: float) -> Dict[str, Any]:
        """Translates GPS coordinates into real road, locality, and city name."""
        cache_key = f"rev_{round(lat, 4)}_{round(lon, 4)}"
        now = time.time()
        if cache_key in self._cache:
            ts, data = self._cache[cache_key]
            if now - ts < self._cache_ttl:
                return data

        try:
            url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json&addressdetails=1"
            req = urllib.request.Request(url, headers={"User-Agent": "AdaniSmartMeterWorkforce/1.0"})
            with urllib.request.urlopen(req, timeout=3.5) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            addr = data.get("address", {})
            road = addr.get("road") or addr.get("pedestrian") or ""
            neighbourhood = addr.get("neighbourhood") or addr.get("suburb") or ""
            city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("district") or "Maharashtra"
            state = addr.get("state") or "Maharashtra"
            pincode = addr.get("postcode") or ""

            formatted_parts = [p for p in [road, neighbourhood, city, state, pincode] if p]
            display_address = ", ".join(formatted_parts) or data.get("display_name", "")

            result = {
                "latitude": lat,
                "longitude": lon,
                "road": road,
                "neighbourhood": neighbourhood,
                "city": city,
                "state": state,
                "pincode": pincode,
                "formatted_address": display_address,
            }
            self._cache[cache_key] = (now, result)
            return result
        except Exception as e:
            return {
                "latitude": lat,
                "longitude": lon,
                "formatted_address": f"{lat:.5f}, {lon:.5f}",
                "error": str(e)
            }

    def get_coverage_report(self) -> Dict[str, Any]:
        """Provides verified coverage breakdown across Maharashtra key districts."""
        by_district: Dict[str, List[Dict[str, Any]]] = {}
        by_category: Dict[str, int] = {}

        for p in self._pois:
            city = p.get("city", "Other")
            by_district.setdefault(city, []).append(p)
            cat = p.get("category", "other")
            by_category[cat] = by_category.get(cat, 0) + 1

        summary = {}
        for city, plist in by_district.items():
            sample_names = [p["name"] for p in plist[:3]]
            summary[city] = {
                "total_pois": len(plist),
                "categories": list(set(p["category"] for p in plist)),
                "sample_places": sample_names
            }

        return {
            "total_places": len(self._pois),
            "state": "Maharashtra",
            "provider": "Mappls GIS",
            "districts_covered": list(by_district.keys()),
            "district_breakdown": summary,
            "category_breakdown": by_category
        }

places_service = PlacesService()
