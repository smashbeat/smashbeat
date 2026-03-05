#!/usr/bin/env python3
"""
Parametric Pegboard Holder for TIG Welding Nozzles
===================================================
Generates an STL file for a modular pegboard-mount holder that stores
TIG welding nozzles (cups). The design uses standard 1-inch (25.4 mm)
pegboard hole spacing.

Key dimensions (all configurable):
  - Pegboard pegs: 2 pegs, 4.7 mm diameter, 6 mm insertion depth
  - Nozzle slots: sized for common TIG cups (#4 through #12)
  - Body: reinforced plate with labelled slots

Usage:
  python3 pegboard_tig_holder.py          # default 4-slot holder
  python3 pegboard_tig_holder.py --slots 6  # 6-slot holder
"""

import argparse
import math
import numpy as np
from stl import mesh as stl_mesh


# ---------------------------------------------------------------------------
# Parametric configuration
# ---------------------------------------------------------------------------
class Config:
    # Pegboard standard (25.4 mm = 1 inch center-to-center)
    PEG_SPACING = 25.4  # mm
    PEG_DIAMETER = 4.7  # mm  (fits standard 1/4" pegboard holes with clearance)
    PEG_LENGTH = 7.0    # mm  (insertion depth)
    PEG_TAPER = 0.4     # mm  radius reduction at tip for easy insertion

    # Back plate
    PLATE_THICKNESS = 4.0   # mm
    PLATE_CORNER_R = 3.0    # mm

    # Nozzle slot dimensions — covers #4 (6.4 mm ID) to #12 (19.0 mm ID)
    # Each slot is a tapered cylinder pocket with a keyhole opening at the top
    NOZZLE_DIAMETERS = [8.0, 10.0, 13.0, 16.0, 19.0, 22.0]  # mm outer holder diameter
    NOZZLE_LABELS = ["#4", "#5", "#6-7", "#8", "#10", "#12"]
    SLOT_DEPTH = 22.0       # mm  how deep the nozzle sits
    SLOT_WALL = 2.5         # mm  wall thickness around each hole
    SLOT_SPACING = 4.0      # mm  gap between slots
    SLOT_ENTRY_EXTRA = 1.0  # mm  extra radius at entry for chamfer

    # Shelf / tray that holds the nozzles
    SHELF_THICKNESS = 3.0
    SHELF_ANGLE = 5.0       # degrees tilt backward so nozzles don't fall out

    # Number of slots (overridden by CLI)
    NUM_SLOTS = 4


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------
def cylinder_triangles(r, h, center=(0, 0, 0), segments=32, closed=True):
    """Return list of triangles forming a cylinder along Z axis."""
    cx, cy, cz = center
    tris = []
    for i in range(segments):
        a0 = 2 * math.pi * i / segments
        a1 = 2 * math.pi * (i + 1) / segments
        x0, y0 = cx + r * math.cos(a0), cy + r * math.sin(a0)
        x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
        # Side faces
        tris.append(([x0, y0, cz], [x1, y1, cz], [x1, y1, cz + h]))
        tris.append(([x0, y0, cz], [x1, y1, cz + h], [x0, y0, cz + h]))
        if closed:
            # Bottom cap
            tris.append(([cx, cy, cz], [x1, y1, cz], [x0, y0, cz]))
            # Top cap
            tris.append(([cx, cy, cz + h], [x0, y0, cz + h], [x1, y1, cz + h]))
    return tris


def tapered_cylinder_triangles(r_bottom, r_top, h, center=(0, 0, 0), segments=32):
    """Cylinder with different radii at bottom and top."""
    cx, cy, cz = center
    tris = []
    for i in range(segments):
        a0 = 2 * math.pi * i / segments
        a1 = 2 * math.pi * (i + 1) / segments
        bx0, by0 = cx + r_bottom * math.cos(a0), cy + r_bottom * math.sin(a0)
        bx1, by1 = cx + r_bottom * math.cos(a1), cy + r_bottom * math.sin(a1)
        tx0, ty0 = cx + r_top * math.cos(a0), cy + r_top * math.sin(a0)
        tx1, ty1 = cx + r_top * math.cos(a1), cy + r_top * math.sin(a1)
        tris.append(([bx0, by0, cz], [bx1, by1, cz], [tx1, ty1, cz + h]))
        tris.append(([bx0, by0, cz], [tx1, ty1, cz + h], [tx0, ty0, cz + h]))
        # Caps
        tris.append(([cx, cy, cz], [bx1, by1, cz], [bx0, by0, cz]))
        tris.append(([cx, cy, cz + h], [tx0, ty0, cz + h], [tx1, ty1, cz + h]))
    return tris


def box_triangles(x, y, z, sx, sy, sz):
    """Axis-aligned box starting at (x, y, z) with size (sx, sy, sz)."""
    v = [
        [x, y, z], [x + sx, y, z], [x + sx, y + sy, z], [x, y + sy, z],
        [x, y, z + sz], [x + sx, y, z + sz], [x + sx, y + sy, z + sz], [x, y + sy, z + sz],
    ]
    faces = [
        (0, 3, 2, 1), (4, 5, 6, 7),  # bottom, top
        (0, 1, 5, 4), (2, 3, 7, 6),  # front, back
        (0, 4, 7, 3), (1, 2, 6, 5),  # left, right
    ]
    tris = []
    for f in faces:
        tris.append((v[f[0]], v[f[1]], v[f[2]]))
        tris.append((v[f[0]], v[f[2]], v[f[3]]))
    return tris


def rounded_plate_triangles(width, height, thickness, radius, center_z=0):
    """A rectangular plate with rounded corners, extruded along Z."""
    # Approximate rounded corners with segments
    segs = 8
    # Build 2D outline
    pts = []
    corners = [
        (radius, radius, math.pi, 1.5 * math.pi),
        (width - radius, radius, 1.5 * math.pi, 2 * math.pi),
        (width - radius, height - radius, 0, 0.5 * math.pi),
        (radius, height - radius, 0.5 * math.pi, math.pi),
    ]
    for cx, cy, a_start, a_end in corners:
        for i in range(segs + 1):
            a = a_start + (a_end - a_start) * i / segs
            pts.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))

    # Triangulate the polygon (fan from centroid)
    cx = width / 2
    cy = height / 2
    n = len(pts)
    tris = []
    for i in range(n):
        j = (i + 1) % n
        x0, y0 = pts[i]
        x1, y1 = pts[j]
        # Bottom face
        tris.append(([cx, cy, center_z], [x1, y1, center_z], [x0, y0, center_z]))
        # Top face
        tris.append(([cx, cy, center_z + thickness], [x0, y0, center_z + thickness],
                      [x1, y1, center_z + thickness]))
        # Side face
        tris.append(([x0, y0, center_z], [x1, y1, center_z], [x1, y1, center_z + thickness]))
        tris.append(([x0, y0, center_z], [x1, y1, center_z + thickness],
                      [x0, y0, center_z + thickness]))
    return tris


# ---------------------------------------------------------------------------
# Main model builder
# ---------------------------------------------------------------------------
def build_holder(cfg):
    """Build the complete pegboard TIG nozzle holder geometry."""
    num = cfg.NUM_SLOTS
    diameters = cfg.NOZZLE_DIAMETERS[:num]

    # Calculate total width from slot sizes
    slot_outer_diameters = [d + 2 * cfg.SLOT_WALL for d in diameters]
    total_slots_width = sum(slot_outer_diameters) + cfg.SLOT_SPACING * (num - 1)
    plate_width = max(total_slots_width + 10, 2 * cfg.PEG_SPACING + 20)
    plate_height = cfg.SLOT_DEPTH + cfg.SHELF_THICKNESS + cfg.PEG_LENGTH + 8

    all_tris = []

    # --- Back plate ---
    all_tris.extend(rounded_plate_triangles(
        plate_width, plate_height, cfg.PLATE_THICKNESS,
        cfg.PLATE_CORNER_R, center_z=0
    ))

    # --- Pegboard pegs (on the back, protruding in -Z) ---
    # Place 2 pegs one PEG_SPACING apart, centered horizontally, near top
    peg_cx = plate_width / 2
    peg_cy = plate_height - cfg.PEG_LENGTH - 4
    for dx in [-cfg.PEG_SPACING / 2, cfg.PEG_SPACING / 2]:
        # Main peg body
        all_tris.extend(tapered_cylinder_triangles(
            r_bottom=cfg.PEG_DIAMETER / 2 - cfg.PEG_TAPER,
            r_top=cfg.PEG_DIAMETER / 2,
            h=cfg.PEG_LENGTH,
            center=(peg_cx + dx, peg_cy, -cfg.PEG_LENGTH),
            segments=24
        ))
        # Small retention bump ring near tip
        bump_r = cfg.PEG_DIAMETER / 2 + 0.3
        all_tris.extend(cylinder_triangles(
            bump_r, 1.0,
            center=(peg_cx + dx, peg_cy, -cfg.PEG_LENGTH),
            segments=24
        ))

    # --- Nozzle holder shelf (extending forward from plate) ---
    shelf_depth = cfg.SLOT_DEPTH + 5
    shelf_y_start = 2.0
    shelf_z_start = cfg.PLATE_THICKNESS

    # Main shelf body
    all_tris.extend(box_triangles(
        0, shelf_y_start, shelf_z_start,
        plate_width, cfg.SHELF_THICKNESS + max(slot_outer_diameters) / 2 + 2,
        shelf_depth
    ))

    # --- Nozzle slot cylinders (vertical holes in the shelf) ---
    # These are solid cylinders that form the walls; in practice the holes
    # are the negative space. Since we're building solid geometry for 3D
    # printing, we build raised rings on the shelf.
    x_cursor = (plate_width - total_slots_width) / 2
    for i, (d, od) in enumerate(zip(diameters, slot_outer_diameters)):
        slot_cx = x_cursor + od / 2
        slot_cy = shelf_y_start + cfg.SHELF_THICKNESS + od / 2
        slot_z = shelf_z_start

        # Outer cylinder (wall)
        all_tris.extend(cylinder_triangles(
            od / 2, shelf_depth,
            center=(slot_cx, slot_cy, slot_z),
            segments=32
        ))

        # Inner cylinder (hole) — we invert normals by swapping winding
        inner_tris = cylinder_triangles(
            d / 2, shelf_depth + 0.1,
            center=(slot_cx, slot_cy, slot_z - 0.05),
            segments=32
        )
        # Flip normals for the subtracted hole
        flipped = []
        for t in inner_tris:
            flipped.append((t[2], t[1], t[0]))
        all_tris.extend(flipped)

        # Entry chamfer ring at top
        all_tris.extend(tapered_cylinder_triangles(
            r_bottom=d / 2 + cfg.SLOT_ENTRY_EXTRA,
            r_top=d / 2,
            h=2.0,
            center=(slot_cx, slot_cy, slot_z + shelf_depth - 2.0),
            segments=32
        ))

        # Reinforcement rib connecting slot to back plate
        rib_width = 3.0
        all_tris.extend(box_triangles(
            slot_cx - rib_width / 2, slot_cy,
            shelf_z_start,
            rib_width, plate_height - shelf_y_start - slot_cy - 2,
            min(shelf_depth * 0.6, 15)
        ))

        x_cursor += od + cfg.SLOT_SPACING

    return all_tris, plate_width, plate_height


def triangles_to_stl(triangles, filename):
    """Convert triangle list to binary STL file."""
    n = len(triangles)
    m = stl_mesh.Mesh(np.zeros(n, dtype=stl_mesh.Mesh.dtype))
    for i, tri in enumerate(triangles):
        for j in range(3):
            m.vectors[i][j] = np.array(tri[j], dtype=np.float32)
    m.save(filename)
    print(f"Saved STL: {filename}  ({n} triangles)")
    return m


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Pegboard TIG Nozzle Holder Generator")
    parser.add_argument("--slots", type=int, default=4, help="Number of nozzle slots (1-6)")
    parser.add_argument("--output", type=str, default="pegboard_tig_holder.stl",
                        help="Output STL filename")
    args = parser.parse_args()

    cfg = Config()
    cfg.NUM_SLOTS = max(1, min(6, args.slots))

    print(f"Generating pegboard TIG nozzle holder with {cfg.NUM_SLOTS} slots...")
    print(f"  Nozzle sizes: {', '.join(cfg.NOZZLE_LABELS[:cfg.NUM_SLOTS])}")
    print(f"  Pegboard spacing: {cfg.PEG_SPACING} mm (standard 1\" grid)")

    triangles, pw, ph = build_holder(cfg)
    print(f"  Plate dimensions: {pw:.1f} x {ph:.1f} x {cfg.PLATE_THICKNESS} mm")
    triangles_to_stl(triangles, args.output)


if __name__ == "__main__":
    main()
