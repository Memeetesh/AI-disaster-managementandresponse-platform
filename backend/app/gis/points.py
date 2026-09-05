"""Shared PostGIS geometry helpers.

Every point-bearing table stores plain lat/lon floats (simple to read) AND
a Geometry(POINT, 4326) column (for real spatial queries) — this is the one
place that builds the latter from the former, so it's built the same way
everywhere.
"""
from geoalchemy2.elements import WKTElement


def make_point(latitude: float, longitude: float) -> WKTElement:
    return WKTElement(f"POINT({longitude} {latitude})", srid=4326)
