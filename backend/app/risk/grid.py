"""Splits a bounding box into square grid cells — the "divide the
demonstration area into grid cells" step from the spec. Plain lon/lat
degree steps are precise enough at demo scale (~city-block cells); no
geodesic projection needed.
"""
import math
from dataclasses import dataclass


@dataclass(frozen=True)
class BoundingBox:
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float


@dataclass(frozen=True)
class GridCell:
    index: int
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float

    @property
    def center(self) -> tuple[float, float]:
        return ((self.min_lon + self.max_lon) / 2, (self.min_lat + self.max_lat) / 2)

    def to_wkt_polygon(self) -> str:
        return (
            f"POLYGON(({self.min_lon} {self.min_lat}, {self.max_lon} {self.min_lat}, "
            f"{self.max_lon} {self.max_lat}, {self.min_lon} {self.max_lat}, "
            f"{self.min_lon} {self.min_lat}))"
        )


def generate_grid(bbox: BoundingBox, cell_size_deg: float) -> list[GridCell]:
    # Step counts are computed from a rounded ratio (not by repeatedly
    # adding cell_size_deg) so float drift never produces a spurious,
    # near-zero-width sliver cell at the far edge of the bbox.
    n_lon = max(1, math.ceil(round((bbox.max_lon - bbox.min_lon) / cell_size_deg, 9)))
    n_lat = max(1, math.ceil(round((bbox.max_lat - bbox.min_lat) / cell_size_deg, 9)))

    cells: list[GridCell] = []
    index = 0
    for i in range(n_lon):
        lon = bbox.min_lon + i * cell_size_deg
        next_lon = min(lon + cell_size_deg, bbox.max_lon)
        for j in range(n_lat):
            lat = bbox.min_lat + j * cell_size_deg
            next_lat = min(lat + cell_size_deg, bbox.max_lat)
            cells.append(GridCell(index, lon, lat, next_lon, next_lat))
            index += 1
    return cells
