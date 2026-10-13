# Server Script (type: DocType Event, doctype: Work Location, event: Before Save)
# Menyelaraskan peta (field Geolocation `location_map`, titik/lingkaran GeoJSON dari Leaflet) dengan
# latitude/longitude/radius_m. Pilih titik di peta -> koordinat terisi; isi koordinat manual tanpa peta
# -> peta dibuat dari koordinat itu. GeoJSON memakai urutan [longitude, latitude].
geo = doc.location_map
lat = None
lng = None
rad = None
if geo:
    data = json.loads(geo)
    for f in (data.get("features") or []):
        g = f.get("geometry") or {}
        pr = f.get("properties") or {}
        if g.get("type") == "Point" and g.get("coordinates"):
            lng = g["coordinates"][0]
            lat = g["coordinates"][1]
            if pr.get("point_type") == "circle" and pr.get("radius"):
                rad = pr.get("radius")
            break
if lat is not None and lng is not None:
    doc.latitude = lat
    doc.longitude = lng
    if rad:
        doc.radius_m = int(rad)
elif doc.latitude and doc.longitude:
    doc.location_map = json.dumps({"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {},
         "geometry": {"type": "Point", "coordinates": [doc.longitude, doc.latitude]}}]})
