# Server Script (type: DocType Event, doctype: Shift Location, event: Before Save)
# Menyelaraskan peta (field Geolocation `geolocation`, GeoJSON dari Leaflet) dengan latitude/longitude/checkin_radius.
# Pilih titik (marker) atau gambar lingkaran di peta -> koordinat (dan radius dari lingkaran) terisi saat disimpan.
# Isi koordinat manual tanpa peta -> peta dibuat dari koordinat itu. GeoJSON memakai urutan [longitude, latitude].
geo = doc.geolocation
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
        doc.checkin_radius = int(rad)
elif doc.latitude and doc.longitude:
    pt = [doc.longitude, doc.latitude]
    doc.geolocation = json.dumps({"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"point_type": "circle", "radius": doc.checkin_radius or 100},
         "geometry": {"type": "Point", "coordinates": pt}},
        {"type": "Feature", "properties": {}, "geometry": {"type": "Point", "coordinates": pt}}]})
