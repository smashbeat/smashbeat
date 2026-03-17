#!/usr/bin/env python3
"""
M811 Multicell Horn Generator
==============================
8-Cell (4x2) Exponential Horn for compression drivers.

Specs from reference:
  - 11.22" (285mm) wide at mouth
  - 5.86" (149mm) deep
  - 10.68" (271mm) total height including throat adapter
  - 8 cells: 4 columns x 2 rows
  - 550Hz cutoff, +10dB from 600Hz
  - 1" throat with 1-3/8"-18 UNS thread
  - Compatible with JBL (3-bolt) and Altec Lansing (2-bolt) drivers

Output parts (split for Bambu Lab X1 256mm build volume):
  1. horn_right.stl     - Right half of horn body (4 cells)
  2. horn_left.stl      - Left half (mirror of right)
  3. throat_adapter.stl  - Throat transition + 1-3/8"-18 thread
  4. flange_jbl.stl      - JBL driver flange adapter (3-bolt)
  5. flange_altec.stl    - Altec driver flange adapter (2-bolt)
  6. joining_plate.stl   - Joining plates (x2 needed)

Target weight: ~730g in Hyper PLA+
Material: PLA+ / Hyper PLA+
"""

import math
import os
import sys
import argparse
import numpy as np
from stl import mesh as stl_mesh


# ============================================================================
# Configuration
# ============================================================================
class Config:
    # Overall dimensions (from reference drawings, inches → mm)
    MOUTH_WIDTH = 285.0       # 11.22" - total width at mouth
    HORN_DEPTH = 149.0        # 5.86" - depth from throat-end to mouth
    TOTAL_HEIGHT = 271.3      # 10.68" - total height including throat
    MOUTH_HEIGHT = 120.0      # Estimated height of cell grid at mouth

    # Cell grid
    COLS = 4
    ROWS = 2

    # Wall thickness
    WALL = 2.0                # mm - internal divider walls
    OUTER_WALL = 2.5          # mm - outer shell walls

    # Throat dimensions
    THROAT_DIA = 25.4         # mm (1")
    THROAT_AREA = math.pi * (25.4 / 2) ** 2  # 506.7 mm²

    # Per-cell throat dimensions
    CELL_THROAT_W = 8.0       # mm (sqrt(506.7/8) ≈ 7.96, rounded)
    CELL_THROAT_H = 8.0       # mm

    # Throat grid total size (including walls)
    THROAT_GRID_W = 4 * 8.0 + 5 * 2.0   # 42mm
    THROAT_GRID_H = 2 * 8.0 + 3 * 2.0   # 22mm

    # Thread: 1-3/8"-18 UNS
    THREAD_OD = 34.925        # mm (1.375")
    THREAD_PITCH = 25.4 / 18  # 1.411mm
    THREAD_DEPTH = 0.65       # mm (thread form depth for 3D printing)
    THREAD_LENGTH = 20.0      # mm

    # Throat adapter section
    THROAT_SECTION_LEN = 120.0  # mm - transition from grid to thread

    # Acoustic
    CUTOFF_FREQ = 550         # Hz
    SPEED_OF_SOUND = 343000   # mm/s

    # Mesh resolution
    STATIONS = 40             # stations along horn depth
    CIRC_SEGS = 48            # segments for circular features
    THREAD_SEGS = 64          # segments per revolution for thread

    # Mouth cell dimensions (derived)
    @property
    def mouth_cell_w(self):
        return (self.MOUTH_WIDTH - (self.COLS + 1) * self.WALL) / self.COLS

    @property
    def mouth_cell_h(self):
        return (self.MOUTH_HEIGHT - (self.ROWS + 1) * self.WALL) / self.ROWS

    # Flare constant
    @property
    def flare_m(self):
        return 4 * math.pi * self.CUTOFF_FREQ / self.SPEED_OF_SOUND

    # JBL driver flange: 3-bolt pattern on 2.625" (66.675mm) BCD
    JBL_BOLT_BCD = 66.675     # mm bolt circle diameter
    JBL_BOLT_DIA = 5.5        # mm bolt hole diameter
    JBL_BOLT_COUNT = 3

    # Altec driver flange: 2-bolt pattern
    ALTEC_BOLT_SPACING = 63.5  # mm between bolt holes
    ALTEC_BOLT_DIA = 5.5       # mm

    # Flange dimensions
    FLANGE_OD = 80.0           # mm outer diameter
    FLANGE_THICKNESS = 6.0     # mm

    # Joining features
    DOWEL_DIA = 4.0            # mm alignment dowel holes
    DOWEL_DEPTH = 8.0          # mm
    BOLT_DIA = 4.5             # mm for M4 bolts
    BOLT_SPACING_Z = 60.0      # mm vertical distance between join bolts


# ============================================================================
# Mesh Utility Functions
# ============================================================================
def loft_profiles(profiles, closed=True):
    """Connect ordered profiles with triangle strips. Each profile is a list
    of (x,y,z) 3-tuples. All profiles must have the same point count."""
    tris = []
    for i in range(len(profiles) - 1):
        p0 = profiles[i]
        p1 = profiles[i + 1]
        n = len(p0)
        limit = n if closed else n - 1
        for j in range(limit):
            j1 = (j + 1) % n
            tris.append((p0[j], p1[j], p1[j1]))
            tris.append((p0[j], p1[j1], p0[j1]))
    return tris


def cap_polygon(pts, flip=False):
    """Triangulate a planar polygon using fan from centroid."""
    n = len(pts)
    cx = sum(p[0] for p in pts) / n
    cy = sum(p[1] for p in pts) / n
    cz = sum(p[2] for p in pts) / n
    center = (cx, cy, cz)
    tris = []
    for i in range(n):
        j = (i + 1) % n
        if flip:
            tris.append((center, pts[j], pts[i]))
        else:
            tris.append((center, pts[i], pts[j]))
    return tris


def rect_profile(x_min, x_max, z_min, z_max, y):
    """Create a rectangular profile in the XZ plane at given Y."""
    return [
        (x_min, y, z_min),
        (x_max, y, z_min),
        (x_max, y, z_max),
        (x_min, y, z_max),
    ]


def cylinder_mesh(r, length, center, axis='y', segs=32):
    """Generate closed cylinder triangles along specified axis."""
    tris = []
    cx, cy, cz = center
    for i in range(segs):
        a0 = 2 * math.pi * i / segs
        a1 = 2 * math.pi * (i + 1) / segs
        if axis == 'y':
            p0b = (cx + r * math.cos(a0), cy, cz + r * math.sin(a0))
            p1b = (cx + r * math.cos(a1), cy, cz + r * math.sin(a1))
            p0t = (cx + r * math.cos(a0), cy + length, cz + r * math.sin(a0))
            p1t = (cx + r * math.cos(a1), cy + length, cz + r * math.sin(a1))
            cb = (cx, cy, cz)
            ct = (cx, cy + length, cz)
        elif axis == 'z':
            p0b = (cx + r * math.cos(a0), cy + r * math.sin(a0), cz)
            p1b = (cx + r * math.cos(a1), cy + r * math.sin(a1), cz)
            p0t = (cx + r * math.cos(a0), cy + r * math.sin(a0), cz + length)
            p1t = (cx + r * math.cos(a1), cy + r * math.sin(a1), cz + length)
            cb = (cx, cy, cz)
            ct = (cx, cy, cz + length)
        else:
            continue
        # Side
        tris.append((p0b, p1b, p1t))
        tris.append((p0b, p1t, p0t))
        # Bottom cap
        tris.append((cb, p1b, p0b))
        # Top cap
        tris.append((ct, p0t, p1t))
    return tris


def box_mesh(x, y, z, sx, sy, sz):
    """Axis-aligned box from (x,y,z) with size (sx,sy,sz)."""
    v = [
        (x, y, z), (x+sx, y, z), (x+sx, y+sy, z), (x, y+sy, z),
        (x, y, z+sz), (x+sx, y, z+sz), (x+sx, y+sy, z+sz), (x, y+sy, z+sz),
    ]
    faces = [
        (0, 3, 2, 1), (4, 5, 6, 7),
        (0, 1, 5, 4), (2, 3, 7, 6),
        (0, 4, 7, 3), (1, 2, 6, 5),
    ]
    tris = []
    for f in faces:
        tris.append((v[f[0]], v[f[1]], v[f[2]]))
        tris.append((v[f[0]], v[f[2]], v[f[3]]))
    return tris


def mirror_x(triangles):
    """Mirror triangles across X=0 plane (flip X and reverse winding)."""
    mirrored = []
    for t in triangles:
        mirrored.append((
            (-t[0][0], t[0][1], t[0][2]),
            (-t[2][0], t[2][1], t[2][2]),
            (-t[1][0], t[1][1], t[1][2]),
        ))
    return mirrored


def annular_ring(r_inner, r_outer, z, segs=48, flip=False):
    """Create a flat annular ring (washer shape) at height z."""
    tris = []
    for i in range(segs):
        a0 = 2 * math.pi * i / segs
        a1 = 2 * math.pi * (i + 1) / segs
        pi0 = (r_inner * math.cos(a0), r_inner * math.sin(a0), z)
        pi1 = (r_inner * math.cos(a1), r_inner * math.sin(a1), z)
        po0 = (r_outer * math.cos(a0), r_outer * math.sin(a0), z)
        po1 = (r_outer * math.cos(a1), r_outer * math.sin(a1), z)
        if flip:
            tris.append((pi0, po0, po1))
            tris.append((pi0, po1, pi1))
        else:
            tris.append((pi0, po1, po0))
            tris.append((pi0, pi1, po1))
    return tris


# ============================================================================
# Horn Body Generator
# ============================================================================
def compute_cell_geometry(t, col, row, cfg):
    """Compute cell center and size at parameter t (0=throat, 1=mouth).
    Returns (cx, cz, cell_w, cell_h) in the XZ plane."""
    # Cell size: interpolate using modified exponential
    # Use a blend of exponential (acoustic) and linear (structural)
    m = cfg.flare_m
    y_pos = t * cfg.HORN_DEPTH
    exp_ratio = math.exp(m * y_pos)
    # Area expansion from exponential
    area_exp = cfg.CELL_THROAT_W * cfg.CELL_THROAT_H * exp_ratio
    # Area at mouth (maximum)
    area_mouth = cfg.mouth_cell_w * cfg.mouth_cell_h
    # Blend: use exponential up to where it hits the mouth area, then cap
    area = min(area_exp, area_mouth)

    # Distribute area between width and height following the fan shape
    # Width grows faster due to horizontal fan
    w_ratio = cfg.mouth_cell_w / cfg.CELL_THROAT_W
    h_ratio = cfg.mouth_cell_h / cfg.CELL_THROAT_H

    cell_w = cfg.CELL_THROAT_W * (1 + t * (w_ratio - 1))
    cell_h = cfg.CELL_THROAT_H * (1 + t * (h_ratio - 1))

    # Cell center positions: interpolate from throat grid to mouth grid
    # Throat positions
    spacing_w0 = cfg.CELL_THROAT_W + cfg.WALL
    spacing_h0 = cfg.CELL_THROAT_H + cfg.WALL
    cx0 = (col - (cfg.COLS - 1) / 2.0) * spacing_w0
    cz0 = (row - (cfg.ROWS - 1) / 2.0) * spacing_h0

    # Mouth positions
    spacing_w1 = cfg.mouth_cell_w + cfg.WALL
    spacing_h1 = cfg.mouth_cell_h + cfg.WALL
    cx1 = (col - (cfg.COLS - 1) / 2.0) * spacing_w1
    cz1 = (row - (cfg.ROWS - 1) / 2.0) * spacing_h1

    # Interpolate center positions (fan spreading)
    cx = cx0 + t * (cx1 - cx0)
    cz = cz0 + t * (cz1 - cz0)

    return cx, cz, cell_w, cell_h


def generate_horn_half(cfg, side='right'):
    """Generate one half of the multicell horn body.

    The horn is split at X=0. 'right' generates the X>0 half (columns 2,3).
    'left' generates the X<0 half (columns 0,1) = mirror of right.
    """
    tris = []

    # For the right half, we use columns 2 and 3 (positive X side)
    if side == 'right':
        cols = [2, 3]
    else:
        cols = [0, 1]
    rows = [0, 1]

    # --- Generate outer shell ---
    # Compute outer boundary at each station
    outer_profiles = []
    for si in range(cfg.STATIONS + 1):
        t = si / cfg.STATIONS
        y = t * cfg.HORN_DEPTH

        # Find outer boundary from cell positions
        x_min_cells = float('inf')
        x_max_cells = float('-inf')
        z_min_cells = float('inf')
        z_max_cells = float('-inf')

        for col in cols:
            for row in rows:
                cx, cz, cw, ch = compute_cell_geometry(t, col, row, cfg)
                x_min_cells = min(x_min_cells, cx - cw / 2)
                x_max_cells = max(x_max_cells, cx + cw / 2)
                z_min_cells = min(z_min_cells, cz - ch / 2)
                z_max_cells = max(z_max_cells, cz + ch / 2)

        # Add outer wall thickness
        x_max = x_max_cells + cfg.OUTER_WALL
        z_min = z_min_cells - cfg.OUTER_WALL
        z_max = z_max_cells + cfg.OUTER_WALL

        # For the split half, X starts at 0 (joining face)
        if side == 'right':
            x_min = 0.0
        else:
            x_min = x_min_cells - cfg.OUTER_WALL
            x_max = 0.0

        outer_profiles.append(rect_profile(x_min, x_max, z_min, z_max, y))

    # Loft outer shell
    tris.extend(loft_profiles(outer_profiles, closed=True))

    # Cap throat end (Y=0) and mouth end (Y=HORN_DEPTH)
    tris.extend(cap_polygon(outer_profiles[0], flip=True))   # throat end (back)
    tris.extend(cap_polygon(outer_profiles[-1], flip=False))  # mouth end (front)

    # --- Generate cell passages (inverted normals for subtraction) ---
    for col in cols:
        for row in rows:
            cell_profiles = []
            for si in range(cfg.STATIONS + 1):
                t = si / cfg.STATIONS
                y = t * cfg.HORN_DEPTH
                cx, cz, cw, ch = compute_cell_geometry(t, col, row, cfg)

                # Cell opening rectangle (slightly oversized at ends for clean cut)
                y_adj = y
                if si == 0:
                    y_adj = -1.0  # extend past throat face
                elif si == cfg.STATIONS:
                    y_adj = cfg.HORN_DEPTH + 1.0  # extend past mouth face

                cell_profiles.append(rect_profile(
                    cx - cw / 2, cx + cw / 2,
                    cz - ch / 2, cz + ch / 2,
                    y_adj
                ))

            # Loft cell passage with INVERTED normals (reverse winding)
            cell_tris = loft_profiles(cell_profiles, closed=True)
            inverted = [(t[2], t[1], t[0]) for t in cell_tris]
            tris.extend(inverted)

            # Cell end caps (also inverted)
            tris.extend(cap_polygon(cell_profiles[0], flip=False))   # inverted
            tris.extend(cap_polygon(cell_profiles[-1], flip=True))   # inverted

    # --- Add reinforcement ribs between cell rows ---
    for si in range(0, cfg.STATIONS, 5):
        t = si / cfg.STATIONS
        y = t * cfg.HORN_DEPTH
        # Horizontal divider rib
        for col in cols:
            cx_top, cz_top, cw_top, ch_top = compute_cell_geometry(t, col, 1, cfg)
            cx_bot, cz_bot, cw_bot, ch_bot = compute_cell_geometry(t, col, 0, cfg)
            # The horizontal divider sits between row 0 top and row 1 bottom
            rib_z_bot = cz_bot + ch_bot / 2
            rib_z_top = cz_top - ch_top / 2
            if rib_z_top > rib_z_bot + 0.5:
                rib_cx = (cx_top + cx_bot) / 2
                rib_w = max(cw_top, cw_bot)
                tris.extend(box_mesh(
                    rib_cx - rib_w / 2, y, rib_z_bot,
                    rib_w, cfg.HORN_DEPTH / cfg.STATIONS * 4, rib_z_top - rib_z_bot
                ))

    # --- Joining face features (dowel holes at X=0) ---
    # Add small registration bumps on the joining face
    for dz in [-25, 0, 25]:
        if side == 'right':
            # Small cylindrical bump protruding from X=0 face
            tris.extend(cylinder_mesh(
                cfg.DOWEL_DIA / 2, cfg.DOWEL_DEPTH / 2,
                center=(0, cfg.HORN_DEPTH / 2, dz),
                axis='z',  # Use as X-direction protrusion - approximate
                segs=16
            ))

    return tris


# ============================================================================
# Throat Adapter Generator
# ============================================================================
def generate_throat_adapter(cfg):
    """Generate the throat transition piece.
    Transitions from rectangular cell grid opening to circular 1" throat
    with 1-3/8"-18 UNS female thread.
    """
    tris = []
    segs = cfg.CIRC_SEGS
    stations = 30

    # Dimensions
    rect_w = cfg.THROAT_GRID_W + 2 * cfg.OUTER_WALL  # outer width at top
    rect_h = cfg.THROAT_GRID_H + 2 * cfg.OUTER_WALL  # outer height at top
    total_len = cfg.THROAT_SECTION_LEN

    # The adapter goes from Y=0 (top, mates with horn body) to Y=-total_len (bottom, thread)
    # At Y=0: rectangular cross-section matching horn throat
    # At Y=-total_len: circular cross-section for thread

    # --- Outer shell transition (rectangle to circle) ---
    profiles = []
    for si in range(stations + 1):
        t = si / stations  # 0=top (rectangle), 1=bottom (circle)
        y = -t * total_len

        n_pts = segs  # Use same point count for all stations
        pts = []

        if t < 0.01:
            # Pure rectangle (top)
            for i in range(n_pts):
                frac = i / n_pts
                if frac < 0.25:
                    f = frac / 0.25
                    x = -rect_w / 2 + f * rect_w
                    z = -rect_h / 2
                elif frac < 0.5:
                    f = (frac - 0.25) / 0.25
                    x = rect_w / 2
                    z = -rect_h / 2 + f * rect_h
                elif frac < 0.75:
                    f = (frac - 0.5) / 0.25
                    x = rect_w / 2 - f * rect_w
                    z = rect_h / 2
                else:
                    f = (frac - 0.75) / 0.25
                    x = -rect_w / 2
                    z = rect_h / 2 - f * rect_h
                pts.append((x, y, z))
        else:
            # Blend from rectangle toward circle
            # At t=1, it's a circle with radius = THREAD_OD/2 + OUTER_WALL
            r_circle = cfg.THREAD_OD / 2 + cfg.OUTER_WALL
            for i in range(n_pts):
                angle = 2 * math.pi * i / n_pts
                # Circle point
                cx = r_circle * math.cos(angle)
                cz = r_circle * math.sin(angle)
                # Rectangle point
                frac = i / n_pts
                if frac < 0.25:
                    f = frac / 0.25
                    rx = -rect_w / 2 + f * rect_w
                    rz = -rect_h / 2
                elif frac < 0.5:
                    f = (frac - 0.25) / 0.25
                    rx = rect_w / 2
                    rz = -rect_h / 2 + f * rect_h
                elif frac < 0.75:
                    f = (frac - 0.5) / 0.25
                    rx = rect_w / 2 - f * rect_w
                    rz = rect_h / 2
                else:
                    f = (frac - 0.75) / 0.25
                    rx = -rect_w / 2
                    rz = rect_h / 2 - f * rect_h

                # Smooth blend
                blend = t ** 1.5  # ease into circle
                x = rx * (1 - blend) + cx * blend
                z = rz * (1 - blend) + cz * blend

                # Also shrink the rectangle part
                rect_scale = 1.0 - t * (1.0 - 2 * r_circle / rect_w)
                if blend < 1.0:
                    x = rx * rect_scale * (1 - blend) + cx * blend
                    z = rz * rect_scale * (1 - blend) + cz * blend

                pts.append((x, y, z))

        profiles.append(pts)

    # Loft outer shell
    tris.extend(loft_profiles(profiles, closed=True))

    # Cap top (rectangular end, mates with horn body)
    tris.extend(cap_polygon(profiles[0], flip=True))

    # --- Inner passage (also transitions from rect grid to circle) ---
    inner_profiles = []
    for si in range(stations + 1):
        t = si / stations
        y = -t * total_len

        n_pts = segs
        pts = []

        # Inner opening
        inner_rect_w = cfg.THROAT_GRID_W  # cell grid opening (no walls)
        inner_rect_h = cfg.THROAT_GRID_H
        r_inner = cfg.THROAT_DIA / 2

        for i in range(n_pts):
            angle = 2 * math.pi * i / n_pts
            cx = r_inner * math.cos(angle)
            cz = r_inner * math.sin(angle)
            frac = i / n_pts
            if frac < 0.25:
                f = frac / 0.25
                rx = -inner_rect_w / 2 + f * inner_rect_w
                rz = -inner_rect_h / 2
            elif frac < 0.5:
                f = (frac - 0.25) / 0.25
                rx = inner_rect_w / 2
                rz = -inner_rect_h / 2 + f * inner_rect_h
            elif frac < 0.75:
                f = (frac - 0.5) / 0.25
                rx = inner_rect_w / 2 - f * inner_rect_w
                rz = inner_rect_h / 2
            else:
                f = (frac - 0.75) / 0.25
                rx = -inner_rect_w / 2
                rz = inner_rect_h / 2 - f * inner_rect_h

            blend = t ** 1.5
            x = rx * (1 - blend) + cx * blend
            z = rz * (1 - blend) + cz * blend

            # Adjust Y slightly for clean Boolean
            y_adj = y
            if si == 0:
                y_adj = y + 1.0
            elif si == stations:
                y_adj = y - 1.0

            pts.append((x, y_adj, z))

        inner_profiles.append(pts)

    # Loft inner passage with inverted normals
    inner_tris = loft_profiles(inner_profiles, closed=True)
    tris.extend([(t[2], t[1], t[0]) for t in inner_tris])

    # Inner end caps (inverted)
    tris.extend(cap_polygon(inner_profiles[0], flip=False))
    tris.extend(cap_polygon(inner_profiles[-1], flip=True))

    # --- Thread section (extends below the transition) ---
    thread_y_start = -total_len
    thread_y_end = thread_y_start - cfg.THREAD_LENGTH

    # Outer cylinder for thread section
    r_outer = cfg.THREAD_OD / 2 + cfg.OUTER_WALL
    tris.extend(cylinder_mesh(
        r_outer, -cfg.THREAD_LENGTH,
        center=(0, thread_y_start, 0),
        axis='y', segs=segs
    ))

    # Internal thread (female) - helical groove
    # Approximate thread as a series of helical cuts
    r_thread_major = cfg.THREAD_OD / 2
    r_thread_minor = r_thread_major - cfg.THREAD_DEPTH
    thread_revs = cfg.THREAD_LENGTH / cfg.THREAD_PITCH
    thread_pts = int(thread_revs * cfg.THREAD_SEGS)

    # Generate thread as a helical tube with triangular cross-section
    for i in range(thread_pts):
        frac0 = i / thread_pts
        frac1 = (i + 1) / thread_pts
        a0 = 2 * math.pi * frac0 * thread_revs
        a1 = 2 * math.pi * frac1 * thread_revs
        y0 = thread_y_start - frac0 * cfg.THREAD_LENGTH
        y1 = thread_y_start - frac1 * cfg.THREAD_LENGTH

        # Thread groove: V-shape between major and minor diameter
        # Outer edge (major diameter)
        p0_out = (r_thread_major * math.cos(a0), y0, r_thread_major * math.sin(a0))
        p1_out = (r_thread_major * math.cos(a1), y1, r_thread_major * math.sin(a1))
        # Inner edge (minor diameter, half pitch offset)
        y0m = y0 - cfg.THREAD_PITCH / 4
        y1m = y1 - cfg.THREAD_PITCH / 4
        p0_in = (r_thread_minor * math.cos(a0), y0m, r_thread_minor * math.sin(a0))
        p1_in = (r_thread_minor * math.cos(a1), y1m, r_thread_minor * math.sin(a1))

        # Thread groove triangle strip
        tris.append((p0_out, p1_out, p1_in))
        tris.append((p0_out, p1_in, p0_in))

    # Bottom cap of thread section (closed)
    bottom_y = thread_y_end
    tris.extend(annular_ring(r_thread_major, r_outer, 0, segs))
    # Remap annular ring Y coordinates
    bottom_cap = annular_ring(cfg.THROAT_DIA / 2, r_outer, 0, segs, flip=True)
    remapped = []
    for t_tri in bottom_cap:
        remapped.append(tuple((p[0], bottom_y, p[2]) for p in t_tri))
    tris.extend(remapped)

    # Inner bore through thread section
    bore_tris = cylinder_mesh(
        cfg.THROAT_DIA / 2, -cfg.THREAD_LENGTH - 2.0,
        center=(0, thread_y_start + 1.0, 0),
        axis='y', segs=segs
    )
    tris.extend([(t[2], t[1], t[0]) for t in bore_tris])

    return tris


# ============================================================================
# Driver Flange Adapter
# ============================================================================
def generate_driver_flange(cfg, driver_type='jbl'):
    """Generate a driver adapter flange.
    - One side: 1-3/8"-18 UNS male thread (screws into horn throat)
    - Other side: bolt pattern for driver mounting
    """
    tris = []
    segs = cfg.CIRC_SEGS

    # Flange disc
    r_outer = cfg.FLANGE_OD / 2
    r_inner = cfg.THROAT_DIA / 2
    thickness = cfg.FLANGE_THICKNESS

    # Main disc body
    tris.extend(cylinder_mesh(
        r_outer, thickness,
        center=(0, 0, 0), axis='y', segs=segs
    ))

    # Center bore (inverted for subtraction)
    bore = cylinder_mesh(
        r_inner, thickness + 2,
        center=(0, -1, 0), axis='y', segs=segs
    )
    tris.extend([(t[2], t[1], t[0]) for t in bore])

    # Male thread stub (extends from one side)
    thread_stub_len = 15.0
    r_thread = cfg.THREAD_OD / 2

    # Thread cylinder
    tris.extend(cylinder_mesh(
        r_thread, thread_stub_len,
        center=(0, thickness, 0), axis='y', segs=segs
    ))

    # Thread bore (inverted)
    thread_bore = cylinder_mesh(
        r_inner, thread_stub_len + 1,
        center=(0, thickness - 0.5, 0), axis='y', segs=segs
    )
    tris.extend([(t[2], t[1], t[0]) for t in thread_bore])

    # Helical thread on the stub (male thread)
    thread_revs = thread_stub_len / cfg.THREAD_PITCH
    thread_pts = int(thread_revs * cfg.THREAD_SEGS)

    for i in range(thread_pts):
        frac0 = i / thread_pts
        frac1 = (i + 1) / thread_pts
        a0 = 2 * math.pi * frac0 * thread_revs
        a1 = 2 * math.pi * frac1 * thread_revs
        y0 = thickness + frac0 * thread_stub_len
        y1 = thickness + frac1 * thread_stub_len

        r_major = r_thread
        r_minor = r_thread - cfg.THREAD_DEPTH

        p0_out = (r_major * math.cos(a0), y0, r_major * math.sin(a0))
        p1_out = (r_major * math.cos(a1), y1, r_major * math.sin(a1))
        p0_in = (r_minor * math.cos(a0), y0 + cfg.THREAD_PITCH / 4, r_minor * math.sin(a0))
        p1_in = (r_minor * math.cos(a1), y1 + cfg.THREAD_PITCH / 4, r_minor * math.sin(a1))

        tris.append((p0_out, p0_in, p1_in))
        tris.append((p0_out, p1_in, p1_out))

    # Bolt holes
    if driver_type == 'jbl':
        bolt_count = cfg.JBL_BOLT_COUNT
        bolt_r = cfg.JBL_BOLT_BCD / 2
        bolt_dia = cfg.JBL_BOLT_DIA
        angle_offset = 0
    else:  # altec
        bolt_count = 2
        bolt_r = cfg.ALTEC_BOLT_SPACING / 2
        bolt_dia = cfg.ALTEC_BOLT_DIA
        angle_offset = math.pi / 2  # orient horizontally

    for b in range(bolt_count):
        angle = angle_offset + 2 * math.pi * b / bolt_count
        bx = bolt_r * math.cos(angle)
        bz = bolt_r * math.sin(angle)

        # Bolt hole (inverted cylinder for subtraction)
        hole = cylinder_mesh(
            bolt_dia / 2, thickness + 2,
            center=(bx, -1, bz), axis='y', segs=16
        )
        tris.extend([(t[2], t[1], t[0]) for t in hole])

    return tris


# ============================================================================
# Joining Plate
# ============================================================================
def generate_joining_plate(cfg):
    """Generate a plate used to join the two horn halves together."""
    tris = []

    # Plate dimensions
    plate_w = 40.0   # mm
    plate_h = 100.0  # mm (spans most of the horn height)
    plate_t = 3.0    # mm

    # Main plate
    tris.extend(box_mesh(
        -plate_w / 2, 0, -plate_h / 2,
        plate_w, plate_t, plate_h
    ))

    # Bolt holes (4 holes in corners)
    for dx in [-12, 12]:
        for dz in [-35, 35]:
            hole = cylinder_mesh(
                cfg.BOLT_DIA / 2, plate_t + 2,
                center=(dx, -1, dz), axis='y', segs=16
            )
            tris.extend([(t[2], t[1], t[0]) for t in hole])

    # Dowel holes for alignment
    for dz in [-20, 20]:
        dowel = cylinder_mesh(
            cfg.DOWEL_DIA / 2, plate_t + 2,
            center=(0, -1, dz), axis='y', segs=16
        )
        tris.extend([(t[2], t[1], t[0]) for t in dowel])

    return tris


# ============================================================================
# STL Export
# ============================================================================
def save_stl(triangles, filename):
    """Save triangles to binary STL file."""
    n = len(triangles)
    m = stl_mesh.Mesh(np.zeros(n, dtype=stl_mesh.Mesh.dtype))
    for i, tri in enumerate(triangles):
        for j in range(3):
            m.vectors[i][j] = np.array(tri[j], dtype=np.float32)
    m.save(filename)
    print(f"  Saved: {filename} ({n} triangles)")
    return m


# ============================================================================
# Main
# ============================================================================
def main():
    parser = argparse.ArgumentParser(description="M811 Multicell Horn Generator")
    parser.add_argument("--output-dir", default=".", help="Output directory for STL files")
    parser.add_argument("--all", action="store_true", default=True,
                        help="Generate all parts (default)")
    args = parser.parse_args()

    cfg = Config()
    outdir = args.output_dir
    os.makedirs(outdir, exist_ok=True)

    print("=" * 60)
    print("M811 MULTICELL HORN GENERATOR")
    print("=" * 60)
    print(f"  Mouth width:    {cfg.MOUTH_WIDTH:.1f} mm ({cfg.MOUTH_WIDTH/25.4:.2f}\")")
    print(f"  Horn depth:     {cfg.HORN_DEPTH:.1f} mm ({cfg.HORN_DEPTH/25.4:.2f}\")")
    print(f"  Total height:   {cfg.TOTAL_HEIGHT:.1f} mm ({cfg.TOTAL_HEIGHT/25.4:.2f}\")")
    print(f"  Cells:          {cfg.COLS} x {cfg.ROWS} = {cfg.COLS * cfg.ROWS}")
    print(f"  Cutoff freq:    {cfg.CUTOFF_FREQ} Hz")
    print(f"  Throat:         {cfg.THROAT_DIA:.1f} mm (1\")")
    print(f"  Thread:         1-3/8\"-18 UNS ({cfg.THREAD_OD:.3f} mm)")
    print(f"  Cell throat:    {cfg.CELL_THROAT_W:.1f} x {cfg.CELL_THROAT_H:.1f} mm")
    print(f"  Cell mouth:     {cfg.mouth_cell_w:.1f} x {cfg.mouth_cell_h:.1f} mm")
    print(f"  Wall thickness: {cfg.WALL:.1f} mm (inner) / {cfg.OUTER_WALL:.1f} mm (outer)")
    print()

    # Generate right half
    print("Generating horn body - right half...")
    right_tris = generate_horn_half(cfg, side='right')
    save_stl(right_tris, os.path.join(outdir, "horn_right.stl"))

    # Generate left half (mirror)
    print("Generating horn body - left half...")
    left_tris = mirror_x(right_tris)
    save_stl(left_tris, os.path.join(outdir, "horn_left.stl"))

    # Generate throat adapter
    print("Generating throat adapter with 1-3/8\"-18 thread...")
    throat_tris = generate_throat_adapter(cfg)
    save_stl(throat_tris, os.path.join(outdir, "throat_adapter.stl"))

    # Generate JBL flange
    print("Generating JBL driver flange adapter (3-bolt)...")
    jbl_tris = generate_driver_flange(cfg, driver_type='jbl')
    save_stl(jbl_tris, os.path.join(outdir, "flange_jbl.stl"))

    # Generate Altec flange
    print("Generating Altec driver flange adapter (2-bolt)...")
    altec_tris = generate_driver_flange(cfg, driver_type='altec')
    save_stl(altec_tris, os.path.join(outdir, "flange_altec.stl"))

    # Generate joining plates
    print("Generating joining plate...")
    join_tris = generate_joining_plate(cfg)
    save_stl(join_tris, os.path.join(outdir, "joining_plate.stl"))

    print()
    print("All parts generated successfully!")
    print()
    print("Assembly instructions:")
    print("  1. Print 2x horn halves (right + left)")
    print("  2. Print 1x throat adapter")
    print("  3. Print 2x joining plates")
    print("  4. Print 1x driver flange (JBL or Altec)")
    print("  5. Join halves using joining plates + M4 bolts + adhesive")
    print("  6. Thread throat adapter into horn body")
    print("  7. Attach driver flange to compression driver")
    print("  8. Thread driver+flange into throat adapter")
    print()
    print("Print settings for Bambu Lab X1 (Hyper PLA+):")
    print("  Layer height: 0.20mm")
    print("  Infill: 25-30% (grid or gyroid)")
    print("  Walls: 3-4 loops")
    print("  Temperature: 220°C nozzle / 60°C bed")
    print("  Support: minimal (throat adapter may need some)")


if __name__ == "__main__":
    main()
