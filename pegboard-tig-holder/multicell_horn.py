#!/usr/bin/env python3
"""
M811 Multicell Horn Generator  v2.0
=====================================
8-Cell (4x2) Exponential Horn for 1" compression drivers.

Precision revision matching reference drawings:
  - Technical drawing: 11.22" x 5.71" x 10.26"
  - Render dims:       11.22" x 5.86" x 10.68"
  - 3.94" internal cell diagonal
  - Thick structural walls matching reference photos (~4-5mm dividers)
  - Proper fan geometry: cells radiate from focal point behind throat
  - Faceted outer shell following cell wall panels
  - 1" throat with 1-3/8"-18 UNS thread
  - Compatible with JBL (3-bolt) and Altec Lansing (2-bolt) drivers

Output parts (split for Bambu Lab X1 256mm build volume):
  1. horn_right.stl      - Right half of horn body (4 cells)
  2. horn_left.stl       - Left half (mirror of right)
  3. throat_adapter.stl   - Throat transition + 1-3/8"-18 thread
  4. flange_jbl.stl       - JBL driver flange adapter (3-bolt)
  5. flange_altec.stl     - Altec driver flange adapter (2-bolt)
  6. joining_plate.stl    - Joining plates (x2 needed)

Target weight: ~730g in Hyper PLA+
"""

import math
import os
import argparse
import numpy as np
from stl import mesh as stl_mesh


# ============================================================================
# Configuration  — all dims from reference drawings/photos
# ============================================================================
class Config:
    # ---- Reference dimensions (technical drawing takes priority) ----
    MOUTH_WIDTH = 285.0        # 11.22" total width at mouth
    HORN_DEPTH = 145.0         # 5.71" depth (technical drawing top-view)
    TOTAL_HEIGHT_DRAW = 260.6  # 10.26" (technical drawing side-view)
    CELL_DIAG = 100.1          # 3.94" internal diagonal annotation

    # Cell grid
    COLS = 4
    ROWS = 2

    # ---- Wall thickness (from reference photos — clearly thick) ----
    WALL = 4.5                 # mm — internal divider walls
    OUTER_WALL = 5.5           # mm — outer shell walls

    # ---- Throat ----
    THROAT_DIA = 25.4          # mm (1")
    THROAT_AREA = math.pi * (25.4 / 2) ** 2  # 506.7 mm²

    # Per-cell throat (square, area = total/8)
    CELL_THROAT = 8.0          # mm  (sqrt(506.7/8) ≈ 7.96 → 8)

    # ---- Thread: 1-3/8"-18 UNS ----
    THREAD_OD = 34.925         # mm  (1.375")
    THREAD_PITCH = 25.4 / 18   # 1.411 mm
    THREAD_DEPTH = 0.65        # mm  (V-thread depth for 3D print)
    THREAD_LENGTH = 22.0       # mm

    # ---- Throat transition section ----
    # Derived: total height minus horn cell section height
    # Horn cell section height ≈ mouth_height (cells fan vertically)
    MOUTH_HEIGHT = 130.0       # mm — vertical extent of cells at mouth
    THROAT_SECTION_LEN = 110.0 # mm — rect-grid → round-thread transition

    # ---- Acoustic ----
    CUTOFF_FREQ = 550          # Hz
    SPEED_OF_SOUND = 343000.0  # mm/s

    # ---- Mesh resolution ----
    STATIONS = 50              # stations along horn depth (more = smoother)
    CIRC_SEGS = 48             # circular features
    THREAD_SEGS = 64           # per revolution for thread helix

    # ---- Fan geometry (derived from reference dimensions) ----
    # Focal point: where cell centre-lines converge behind the throat.
    # Computed from throat-grid width, mouth width and horn depth.
    @property
    def throat_grid_w(self):
        return self.COLS * self.CELL_THROAT + (self.COLS + 1) * self.WALL

    @property
    def throat_grid_h(self):
        return self.ROWS * self.CELL_THROAT + (self.ROWS + 1) * self.WALL

    @property
    def h_focal(self):
        """Horizontal focal distance behind throat plane."""
        half_thr = self.throat_grid_w / 2
        half_mth = self.MOUTH_WIDTH / 2
        return self.HORN_DEPTH * half_thr / (half_mth - half_thr)

    @property
    def v_focal(self):
        """Vertical focal distance behind throat plane."""
        half_thr = self.throat_grid_h / 2
        half_mth = self.MOUTH_HEIGHT / 2
        return self.HORN_DEPTH * half_thr / (half_mth - half_thr)

    @property
    def mouth_cell_w(self):
        return (self.MOUTH_WIDTH - (self.COLS + 1) * self.WALL) / self.COLS

    @property
    def mouth_cell_h(self):
        return (self.MOUTH_HEIGHT - (self.ROWS + 1) * self.WALL) / self.ROWS

    @property
    def flare_m(self):
        return 4 * math.pi * self.CUTOFF_FREQ / self.SPEED_OF_SOUND

    # ---- Driver flanges ----
    JBL_BOLT_BCD = 66.675     # mm bolt circle diameter
    JBL_BOLT_DIA = 5.5        # mm
    JBL_BOLT_COUNT = 3

    ALTEC_BOLT_SPACING = 63.5 # mm between holes
    ALTEC_BOLT_DIA = 5.5

    FLANGE_OD = 80.0          # mm
    FLANGE_THICKNESS = 6.0    # mm

    # ---- Joining hardware ----
    DOWEL_DIA = 4.0
    DOWEL_DEPTH = 8.0
    BOLT_DIA = 4.5             # M4 through-holes


# ============================================================================
# Mesh primitives
# ============================================================================
def loft_profiles(profiles, closed=True):
    """Triangle-strip loft between ordered profiles (same vertex count)."""
    tris = []
    for i in range(len(profiles) - 1):
        p0, p1 = profiles[i], profiles[i + 1]
        n = len(p0)
        limit = n if closed else n - 1
        for j in range(limit):
            j1 = (j + 1) % n
            tris.append((p0[j], p1[j], p1[j1]))
            tris.append((p0[j], p1[j1], p0[j1]))
    return tris


def cap_polygon(pts, flip=False):
    """Fan triangulation of a planar polygon."""
    n = len(pts)
    c = tuple(sum(p[k] for p in pts) / n for k in range(3))
    tris = []
    for i in range(n):
        j = (i + 1) % n
        tris.append((c, pts[j], pts[i]) if flip else (c, pts[i], pts[j]))
    return tris


def rect_profile(x0, x1, z0, z1, y):
    """4-point rectangle in the XZ plane at Y=y."""
    return [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]


def cylinder_mesh(r, length, center, axis='y', segs=32):
    """Closed cylinder along the given axis."""
    tris = []
    cx, cy, cz = center
    for i in range(segs):
        a0 = 2 * math.pi * i / segs
        a1 = 2 * math.pi * (i + 1) / segs
        c0, s0 = math.cos(a0), math.sin(a0)
        c1, s1 = math.cos(a1), math.sin(a1)
        if axis == 'y':
            b0 = (cx + r*c0, cy,          cz + r*s0)
            b1 = (cx + r*c1, cy,          cz + r*s1)
            t0 = (cx + r*c0, cy + length, cz + r*s0)
            t1 = (cx + r*c1, cy + length, cz + r*s1)
            cb, ct = (cx, cy, cz), (cx, cy + length, cz)
        else:  # axis == 'z'
            b0 = (cx + r*c0, cy + r*s0, cz)
            b1 = (cx + r*c1, cy + r*s1, cz)
            t0 = (cx + r*c0, cy + r*s0, cz + length)
            t1 = (cx + r*c1, cy + r*s1, cz + length)
            cb, ct = (cx, cy, cz), (cx, cy, cz + length)
        tris += [(b0, b1, t1), (b0, t1, t0), (cb, b1, b0), (ct, t0, t1)]
    return tris


def box_mesh(x, y, z, sx, sy, sz):
    """Axis-aligned box."""
    v = [
        (x,y,z),(x+sx,y,z),(x+sx,y+sy,z),(x,y+sy,z),
        (x,y,z+sz),(x+sx,y,z+sz),(x+sx,y+sy,z+sz),(x,y+sy,z+sz)]
    faces = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(2,3,7,6),(0,4,7,3),(1,2,6,5)]
    tris = []
    for f in faces:
        tris += [(v[f[0]],v[f[1]],v[f[2]]),(v[f[0]],v[f[2]],v[f[3]])]
    return tris


def mirror_x(triangles):
    """Mirror across X=0 (flip X + reverse winding)."""
    return [
        ((-t[0][0],t[0][1],t[0][2]),(-t[2][0],t[2][1],t[2][2]),(-t[1][0],t[1][1],t[1][2]))
        for t in triangles
    ]


def annular_cap(ri, ro, y, segs=48, flip=False):
    """Flat annular ring at Y=y."""
    tris = []
    for i in range(segs):
        a0 = 2*math.pi*i/segs
        a1 = 2*math.pi*(i+1)/segs
        pi0 = (ri*math.cos(a0), y, ri*math.sin(a0))
        pi1 = (ri*math.cos(a1), y, ri*math.sin(a1))
        po0 = (ro*math.cos(a0), y, ro*math.sin(a0))
        po1 = (ro*math.cos(a1), y, ro*math.sin(a1))
        if flip:
            tris += [(pi0,po0,po1),(pi0,po1,pi1)]
        else:
            tris += [(pi0,po1,po0),(pi0,pi1,po1)]
    return tris


# ============================================================================
# Fan-geometry cell computation
# ============================================================================
def cell_geometry(t, col, row, cfg):
    """Compute cell inner-opening centre (cx, cz) and size (w, h) at
    parameter *t* (0 = throat, 1 = mouth).

    Uses proper fan projection from the focal point so cells radiate
    outward rather than simply linearly interpolating.
    """
    y = t * cfg.HORN_DEPTH          # depth position

    # -- Horizontal (X) fan --
    # At the throat (y=0) the cell centres are tightly packed.
    # At any depth y the centre-X is projected from the focal point.
    half_cols = cfg.COLS / 2.0
    # Index from center: col 0 → -1.5, col 1 → -0.5, col 2 → +0.5, col 3 → +1.5
    ci = col - (cfg.COLS - 1) / 2.0

    # Throat centre X for this column
    spacing_w0 = cfg.CELL_THROAT + cfg.WALL
    cx0 = ci * spacing_w0
    # The angle of this column's centre-line from the horn axis
    theta_h = math.atan2(cx0, cfg.h_focal)
    # At depth y, the projected X position
    cx = (cfg.h_focal + y) * math.tan(theta_h)

    # -- Vertical (Z) fan --
    ri = row - (cfg.ROWS - 1) / 2.0
    spacing_h0 = cfg.CELL_THROAT + cfg.WALL
    cz0 = ri * spacing_h0
    theta_v = math.atan2(cz0, cfg.v_focal)
    cz = (cfg.v_focal + y) * math.tan(theta_v)

    # -- Cell opening size --
    # Exponential area expansion from horn physics, capped at mouth dims
    exp_ratio = math.exp(cfg.flare_m * y)
    area_throat = cfg.CELL_THROAT ** 2
    area_exp = area_throat * exp_ratio
    area_mouth = cfg.mouth_cell_w * cfg.mouth_cell_h
    area = min(area_exp, area_mouth)

    # Distribute area proportionally to the aspect ratio at the mouth
    aspect = cfg.mouth_cell_w / cfg.mouth_cell_h
    cell_h = math.sqrt(area / aspect)
    cell_w = area / cell_h

    # Clamp to mouth dimensions
    cell_w = min(cell_w, cfg.mouth_cell_w)
    cell_h = min(cell_h, cfg.mouth_cell_h)

    # Ensure minimum = throat size
    cell_w = max(cell_w, cfg.CELL_THROAT)
    cell_h = max(cell_h, cfg.CELL_THROAT)

    return cx, cz, cell_w, cell_h


def cell_outer_bounds(t, col, row, cfg):
    """Outer boundary of a single cell tube at parameter t, accounting
    for wall thickness.  Outer cells get the full outer-wall; inner cells
    get half the divider on each shared side.
    """
    cx, cz, cw, ch = cell_geometry(t, col, row, cfg)

    # Left / right wall contribution
    left_w  = cfg.OUTER_WALL if col == 0          else cfg.WALL / 2
    right_w = cfg.OUTER_WALL if col == cfg.COLS-1 else cfg.WALL / 2
    bot_w   = cfg.OUTER_WALL if row == 0          else cfg.WALL / 2
    top_w   = cfg.OUTER_WALL if row == cfg.ROWS-1 else cfg.WALL / 2

    x0 = cx - cw/2 - left_w
    x1 = cx + cw/2 + right_w
    z0 = cz - ch/2 - bot_w
    z1 = cz + ch/2 + top_w

    return x0, x1, z0, z1


# ============================================================================
# Horn body (one half)
# ============================================================================
def generate_horn_half(cfg, side='right'):
    """Generate the right (or left) half of the multicell horn body.

    Each cell is built as an independent thick-walled tube:
      - Outer solid  (outward normals) = material
      - Inner void   (inverted normals) = cell passage
    Adjacent cells' outer boundaries overlap at the shared divider wall,
    producing solid thick dividers when the slicer resolves the mesh.
    """
    tris = []

    # Columns for this half
    if side == 'right':
        cols = [2, 3]   # positive-X side
    else:
        cols = [0, 1]
    rows = list(range(cfg.ROWS))

    for col in cols:
        for row in rows:
            outer_profiles = []
            inner_profiles = []

            for si in range(cfg.STATIONS + 1):
                t = si / cfg.STATIONS
                y = t * cfg.HORN_DEPTH

                # Inner opening
                cx, cz, cw, ch = cell_geometry(t, col, row, cfg)
                # Outer boundary
                ox0, ox1, oz0, oz1 = cell_outer_bounds(t, col, row, cfg)

                # For the split half, clip at X=0
                if side == 'right':
                    ox0 = max(ox0, 0.0)
                    # Inner opening: if it crosses X=0, clip it
                    inner_x0 = max(cx - cw/2, 0.001)
                else:
                    ox1 = min(ox1, 0.0)
                    inner_x0 = cx - cw/2

                inner_x1 = cx + cw/2 if side == 'right' else min(cx + cw/2, -0.001)

                # Extend past faces for clean Boolean at mouth/throat
                y_outer = y
                y_inner = y
                if si == 0:
                    y_inner = -1.5
                elif si == cfg.STATIONS:
                    y_inner = cfg.HORN_DEPTH + 1.5

                outer_profiles.append(rect_profile(
                    ox0, ox1 if side == 'right' else ox1,
                    oz0, oz1, y_outer))
                inner_profiles.append(rect_profile(
                    inner_x0, inner_x1,
                    cz - ch/2, cz + ch/2, y_inner))

            # --- Outer solid ---
            tris.extend(loft_profiles(outer_profiles, closed=True))
            tris.extend(cap_polygon(outer_profiles[0], flip=True))
            tris.extend(cap_polygon(outer_profiles[-1], flip=False))

            # --- Inner void (inverted normals) ---
            inv = loft_profiles(inner_profiles, closed=True)
            tris.extend([(tri[2], tri[1], tri[0]) for tri in inv])
            tris.extend(cap_polygon(inner_profiles[0], flip=False))
            tris.extend(cap_polygon(inner_profiles[-1], flip=True))

    # --- Joining face reinforcement at X=0 ---
    # Tongue-and-groove: raised ridge along the split face for alignment
    ridge_h = 2.0   # protrusion height
    ridge_w = 3.0   # width of ridge
    # Compute Z extent of the horn at the midpoint
    _, _, _, _, oz0_mid, oz1_mid = _half_z_bounds(cfg, cols, rows, 0.5)
    if side == 'right':
        tris.extend(box_mesh(
            0.0, 0.0, oz0_mid + 5,
            ridge_h, cfg.HORN_DEPTH, oz1_mid - oz0_mid - 10))

    return tris


def _half_z_bounds(cfg, cols, rows, t):
    """Helper: compute overall X/Z bounds for given cols/rows at param t."""
    x_min = float('inf'); x_max = float('-inf')
    z_min = float('inf'); z_max = float('-inf')
    for c in cols:
        for r in rows:
            ox0, ox1, oz0, oz1 = cell_outer_bounds(t, c, r, cfg)
            x_min = min(x_min, ox0); x_max = max(x_max, ox1)
            z_min = min(z_min, oz0); z_max = max(z_max, oz1)
    return x_min, x_max, z_min, z_max, z_min, z_max


# ============================================================================
# Throat adapter
# ============================================================================
def generate_throat_adapter(cfg):
    """Transition from rectangular cell-grid opening to circular 1" throat
    with 1-3/8"-18 UNS female thread.
    """
    tris = []
    segs = cfg.CIRC_SEGS
    stations = 40

    # Outer rectangle at the top (mates with horn body throat)
    rect_w = cfg.throat_grid_w + 2 * cfg.OUTER_WALL
    rect_h = cfg.throat_grid_h + 2 * cfg.OUTER_WALL
    r_outer_circ = cfg.THREAD_OD / 2 + cfg.OUTER_WALL
    total_len = cfg.THROAT_SECTION_LEN

    # Inner rectangle at top / circle at bottom
    inner_rect_w = cfg.throat_grid_w
    inner_rect_h = cfg.throat_grid_h
    r_inner_circ = cfg.THROAT_DIA / 2

    def _rect_pt(w, h, frac):
        """Point on a rectangle perimeter at fraction 0..1."""
        if frac < 0.25:
            f = frac / 0.25
            return (-w/2 + f*w, -h/2)
        elif frac < 0.5:
            f = (frac-0.25) / 0.25
            return (w/2, -h/2 + f*h)
        elif frac < 0.75:
            f = (frac-0.5) / 0.25
            return (w/2 - f*w, h/2)
        else:
            f = (frac-0.75) / 0.25
            return (-w/2, h/2 - f*h)

    # --- Outer shell ---
    outer_profs = []
    inner_profs = []
    for si in range(stations + 1):
        t = si / stations
        y = -t * total_len
        # Smooth blend from rectangle → circle using t^1.3 ease
        blend = t ** 1.3

        outer_pts = []
        inner_pts = []
        for i in range(segs):
            frac = i / segs
            angle = 2 * math.pi * frac

            # Rectangle point
            orx, orz = _rect_pt(rect_w, rect_h, frac)
            irx, irz = _rect_pt(inner_rect_w, inner_rect_h, frac)

            # Circle point
            ocx = r_outer_circ * math.cos(angle)
            ocz = r_outer_circ * math.sin(angle)
            icx = r_inner_circ * math.cos(angle)
            icz = r_inner_circ * math.sin(angle)

            # Shrink rectangle toward circle as we descend
            scale = 1.0 - blend * (1.0 - 2*r_outer_circ/rect_w)
            ox = orx * scale * (1-blend) + ocx * blend
            oz = orz * scale * (1-blend) + ocz * blend

            i_scale = 1.0 - blend * (1.0 - 2*r_inner_circ/inner_rect_w)
            ix = irx * i_scale * (1-blend) + icx * blend
            iz = irz * i_scale * (1-blend) + icz * blend

            outer_pts.append((ox, y, oz))

            y_adj = y
            if si == 0:
                y_adj = y + 1.5
            elif si == stations:
                y_adj = y - 1.5
            inner_pts.append((ix, y_adj, iz))

        outer_profs.append(outer_pts)
        inner_profs.append(inner_pts)

    # Loft outer
    tris.extend(loft_profiles(outer_profs, closed=True))
    tris.extend(cap_polygon(outer_profs[0], flip=True))

    # Loft inner (inverted)
    inv = loft_profiles(inner_profs, closed=True)
    tris.extend([(tri[2],tri[1],tri[0]) for tri in inv])
    tris.extend(cap_polygon(inner_profs[0], flip=False))
    tris.extend(cap_polygon(inner_profs[-1], flip=True))

    # --- Thread section (cylinder below transition) ---
    thread_y0 = -total_len
    r_thread_outer = cfg.THREAD_OD / 2 + cfg.OUTER_WALL
    r_thread_major = cfg.THREAD_OD / 2
    r_thread_minor = r_thread_major - cfg.THREAD_DEPTH

    # Outer cylinder
    tris.extend(cylinder_mesh(r_thread_outer, -cfg.THREAD_LENGTH,
                              center=(0, thread_y0, 0), axis='y', segs=segs))

    # Helical female thread
    revs = cfg.THREAD_LENGTH / cfg.THREAD_PITCH
    n_pts = int(revs * cfg.THREAD_SEGS)
    for i in range(n_pts):
        f0, f1 = i/n_pts, (i+1)/n_pts
        a0 = 2*math.pi*f0*revs
        a1 = 2*math.pi*f1*revs
        y0 = thread_y0 - f0*cfg.THREAD_LENGTH
        y1 = thread_y0 - f1*cfg.THREAD_LENGTH
        # Major (crest)
        p0o = (r_thread_major*math.cos(a0), y0, r_thread_major*math.sin(a0))
        p1o = (r_thread_major*math.cos(a1), y1, r_thread_major*math.sin(a1))
        # Minor (root, offset half-pitch)
        p0i = (r_thread_minor*math.cos(a0), y0-cfg.THREAD_PITCH/4,
               r_thread_minor*math.sin(a0))
        p1i = (r_thread_minor*math.cos(a1), y1-cfg.THREAD_PITCH/4,
               r_thread_minor*math.sin(a1))
        tris += [(p0o,p1o,p1i),(p0o,p1i,p0i)]

    # Bottom annular cap
    bottom_y = thread_y0 - cfg.THREAD_LENGTH
    cap = annular_cap(cfg.THROAT_DIA/2, r_thread_outer, bottom_y, segs, flip=True)
    tris.extend(cap)

    # Inner bore
    bore = cylinder_mesh(cfg.THROAT_DIA/2, -cfg.THREAD_LENGTH-2,
                         center=(0, thread_y0+1, 0), axis='y', segs=segs)
    tris.extend([(t[2],t[1],t[0]) for t in bore])

    return tris


# ============================================================================
# Driver flange adapters
# ============================================================================
def generate_driver_flange(cfg, driver_type='jbl'):
    """Adapter flange: one side 1-3/8"-18 male thread, other side bolt pattern."""
    tris = []
    segs = cfg.CIRC_SEGS
    r_outer = cfg.FLANGE_OD / 2
    r_inner = cfg.THROAT_DIA / 2
    thick = cfg.FLANGE_THICKNESS
    r_thread = cfg.THREAD_OD / 2

    # Main disc
    tris.extend(cylinder_mesh(r_outer, thick, (0,0,0), 'y', segs))
    # Centre bore (inverted)
    b = cylinder_mesh(r_inner, thick+2, (0,-1,0), 'y', segs)
    tris.extend([(t[2],t[1],t[0]) for t in b])

    # Male thread stub
    stub = 15.0
    tris.extend(cylinder_mesh(r_thread, stub, (0,thick,0), 'y', segs))
    tb = cylinder_mesh(r_inner, stub+1, (0,thick-0.5,0), 'y', segs)
    tris.extend([(t[2],t[1],t[0]) for t in tb])

    # Helical thread
    revs = stub / cfg.THREAD_PITCH
    n_pts = int(revs * cfg.THREAD_SEGS)
    for i in range(n_pts):
        f0, f1 = i/n_pts, (i+1)/n_pts
        a0 = 2*math.pi*f0*revs
        a1 = 2*math.pi*f1*revs
        y0 = thick + f0*stub
        y1 = thick + f1*stub
        rm = r_thread - cfg.THREAD_DEPTH
        p0o = (r_thread*math.cos(a0), y0, r_thread*math.sin(a0))
        p1o = (r_thread*math.cos(a1), y1, r_thread*math.sin(a1))
        p0i = (rm*math.cos(a0), y0+cfg.THREAD_PITCH/4, rm*math.sin(a0))
        p1i = (rm*math.cos(a1), y1+cfg.THREAD_PITCH/4, rm*math.sin(a1))
        tris += [(p0o,p0i,p1i),(p0o,p1i,p1o)]

    # Bolt holes
    if driver_type == 'jbl':
        n_bolts, bolt_r, bolt_d, a_off = cfg.JBL_BOLT_COUNT, cfg.JBL_BOLT_BCD/2, cfg.JBL_BOLT_DIA, 0
    else:
        n_bolts, bolt_r, bolt_d, a_off = 2, cfg.ALTEC_BOLT_SPACING/2, cfg.ALTEC_BOLT_DIA, math.pi/2
    for b in range(n_bolts):
        a = a_off + 2*math.pi*b/n_bolts
        bx, bz = bolt_r*math.cos(a), bolt_r*math.sin(a)
        h = cylinder_mesh(bolt_d/2, thick+2, (bx,-1,bz), 'y', 16)
        tris.extend([(t[2],t[1],t[0]) for t in h])

    return tris


# ============================================================================
# Joining plate
# ============================================================================
def generate_joining_plate(cfg):
    """Structural plate to bolt the two horn halves together."""
    tris = []
    pw, ph, pt = 50.0, 120.0, 4.0   # wider & taller than before
    tris.extend(box_mesh(-pw/2, 0, -ph/2, pw, pt, ph))

    # 6 bolt holes (3 rows x 2 cols)
    for dx in [-15, 15]:
        for dz in [-45, 0, 45]:
            h = cylinder_mesh(cfg.BOLT_DIA/2, pt+2, (dx,-1,dz), 'y', 16)
            tris.extend([(t[2],t[1],t[0]) for t in h])

    # 2 dowel holes
    for dz in [-25, 25]:
        d = cylinder_mesh(cfg.DOWEL_DIA/2, pt+2, (0,-1,dz), 'y', 16)
        tris.extend([(t[2],t[1],t[0]) for t in d])

    return tris


# ============================================================================
# STL export
# ============================================================================
def save_stl(triangles, filename):
    n = len(triangles)
    m = stl_mesh.Mesh(np.zeros(n, dtype=stl_mesh.Mesh.dtype))
    for i, tri in enumerate(triangles):
        for j in range(3):
            m.vectors[i][j] = np.array(tri[j], dtype=np.float32)
    m.save(filename)
    print(f"  {filename}  ({n:,} triangles)")
    return m


# ============================================================================
# Main
# ============================================================================
def main():
    parser = argparse.ArgumentParser(description="M811 Multicell Horn v2.0")
    parser.add_argument("--output-dir", default=".", help="Output directory")
    args = parser.parse_args()

    cfg = Config()
    out = args.output_dir
    os.makedirs(out, exist_ok=True)

    print("=" * 62)
    print("  M811 MULTICELL HORN GENERATOR  v2.0")
    print("=" * 62)
    print(f"  Mouth width:      {cfg.MOUTH_WIDTH:.1f} mm  ({cfg.MOUTH_WIDTH/25.4:.2f}\")")
    print(f"  Mouth height:     {cfg.MOUTH_HEIGHT:.1f} mm")
    print(f"  Horn depth:       {cfg.HORN_DEPTH:.1f} mm  ({cfg.HORN_DEPTH/25.4:.2f}\")")
    print(f"  Total height:     {cfg.TOTAL_HEIGHT_DRAW:.1f} mm  ({cfg.TOTAL_HEIGHT_DRAW/25.4:.2f}\")")
    print(f"  Cells:            {cfg.COLS}x{cfg.ROWS} = {cfg.COLS*cfg.ROWS}")
    print(f"  Cell throat:      {cfg.CELL_THROAT:.1f} x {cfg.CELL_THROAT:.1f} mm")
    print(f"  Cell mouth:       {cfg.mouth_cell_w:.1f} x {cfg.mouth_cell_h:.1f} mm")
    print(f"  Divider wall:     {cfg.WALL:.1f} mm")
    print(f"  Outer wall:       {cfg.OUTER_WALL:.1f} mm")
    print(f"  Throat grid:      {cfg.throat_grid_w:.1f} x {cfg.throat_grid_h:.1f} mm")
    print(f"  H focal dist:     {cfg.h_focal:.1f} mm")
    print(f"  V focal dist:     {cfg.v_focal:.1f} mm")
    print(f"  Throat:           {cfg.THROAT_DIA:.1f} mm (1\")")
    print(f"  Thread:           1-3/8\"-18 UNS ({cfg.THREAD_OD:.3f} mm OD)")
    print(f"  Cutoff:           {cfg.CUTOFF_FREQ} Hz")
    print(f"  Flare constant:   {cfg.flare_m*1000:.4f} /m")
    print()

    print("Generating parts...")

    print("  Horn body — right half...")
    right = generate_horn_half(cfg, 'right')
    save_stl(right, os.path.join(out, "horn_right.stl"))

    print("  Horn body — left half (mirror)...")
    left = mirror_x(right)
    save_stl(left, os.path.join(out, "horn_left.stl"))

    print("  Throat adapter + 1-3/8\"-18 thread...")
    throat = generate_throat_adapter(cfg)
    save_stl(throat, os.path.join(out, "throat_adapter.stl"))

    print("  JBL flange (3-bolt)...")
    save_stl(generate_driver_flange(cfg, 'jbl'), os.path.join(out, "flange_jbl.stl"))

    print("  Altec flange (2-bolt)...")
    save_stl(generate_driver_flange(cfg, 'altec'), os.path.join(out, "flange_altec.stl"))

    print("  Joining plate...")
    save_stl(generate_joining_plate(cfg), os.path.join(out, "joining_plate.stl"))

    print()
    print("Done!  Key changes in v2.0:")
    print("  * Divider walls:  4.5 mm  (was 2.0 mm)")
    print("  * Outer walls:    5.5 mm  (was 2.5 mm)")
    print("  * Fan geometry:   proper focal-point projection")
    print("  * Dimensions:     from technical drawing (5.71\" depth, 10.26\" height)")
    print("  * Mesh stations:  50  (was 40)")
    print()
    print("Assembly: see M811_HORN_README.md")


if __name__ == "__main__":
    main()
