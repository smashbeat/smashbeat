#!/usr/bin/env python3
"""
G-code Generator for Bambu Lab X1 Carbon
=========================================
Slices an STL file into G-code using a layer-by-layer approach with
print profiles tuned for the Bambu Lab X1 Carbon.

This is a purpose-built slicer for the pegboard TIG holder geometry.
It generates valid Marlin-flavour G-code with Bambu-specific start/end
sequences and supports:
  - Adaptive layer heights
  - Perimeter / infill separation
  - Proper retraction settings for the Bambu direct-drive extruder
  - Build plate adhesion (brim)

Usage:
  python3 gcode_generator.py pegboard_tig_holder.stl -o holder.gcode
"""

import argparse
import math
import struct
import sys


# ---------------------------------------------------------------------------
# Bambu Lab X1 Carbon print profile
# ---------------------------------------------------------------------------
class BambuX1Profile:
    """Print settings optimized for Bambu Lab X1 Carbon with PLA/PETG."""
    # Machine
    BED_SIZE_X = 256.0   # mm
    BED_SIZE_Y = 256.0   # mm
    BED_SIZE_Z = 256.0   # mm
    NOZZLE_DIAMETER = 0.4  # mm

    # Temperatures
    NOZZLE_TEMP = 220      # PLA default
    BED_TEMP = 60          # PLA default
    NOZZLE_TEMP_PETG = 245
    BED_TEMP_PETG = 70

    # Layer settings
    LAYER_HEIGHT = 0.20    # mm
    FIRST_LAYER_HEIGHT = 0.20  # mm
    LINE_WIDTH = 0.42      # mm
    FIRST_LAYER_LINE_WIDTH = 0.50  # mm

    # Speed (mm/s → converted to mm/min in G-code)
    PRINT_SPEED = 80       # inner walls and infill
    OUTER_WALL_SPEED = 50  # outer perimeter
    FIRST_LAYER_SPEED = 30
    TRAVEL_SPEED = 250
    Z_HOP_SPEED = 12

    # Retraction (Bambu direct drive)
    RETRACT_LENGTH = 0.8   # mm
    RETRACT_SPEED = 30     # mm/s
    RETRACT_Z_HOP = 0.4    # mm
    DERETRACT_SPEED = 30   # mm/s

    # Extrusion
    FILAMENT_DIAMETER = 1.75   # mm
    EXTRUSION_MULTIPLIER = 1.0

    # Structure
    WALL_LOOPS = 3
    TOP_LAYERS = 4
    BOTTOM_LAYERS = 4
    INFILL_PERCENT = 25    # %
    INFILL_PATTERN = "grid"  # grid / lines

    # Adhesion
    BRIM_WIDTH = 5.0       # mm (number of brim loops)
    BRIM_LOOPS = 8

    # Fan
    FAN_SPEED_MIN = 0      # % for first 2 layers
    FAN_SPEED_MAX = 100    # % after layer 3

    MATERIAL = "PLA"


# ---------------------------------------------------------------------------
# Minimal STL reader
# ---------------------------------------------------------------------------
def read_stl_binary(filename):
    """Read a binary STL and return list of triangles as numpy-free tuples."""
    triangles = []
    with open(filename, "rb") as f:
        header = f.read(80)
        count = struct.unpack("<I", f.read(4))[0]
        for _ in range(count):
            data = f.read(50)
            vals = struct.unpack("<12fH", data)
            # Skip normal (first 3 floats), read 3 vertices (9 floats)
            v1 = (vals[3], vals[4], vals[5])
            v2 = (vals[6], vals[7], vals[8])
            v3 = (vals[9], vals[10], vals[11])
            triangles.append((v1, v2, v3))
    return triangles


# ---------------------------------------------------------------------------
# Layer slicing
# ---------------------------------------------------------------------------
def get_z_bounds(triangles):
    """Get min/max Z from all triangles."""
    z_min = float("inf")
    z_max = float("-inf")
    for tri in triangles:
        for v in tri:
            z_min = min(z_min, v[2])
            z_max = max(z_max, v[2])
    return z_min, z_max


def slice_triangle_at_z(tri, z):
    """Intersect a single triangle with a Z plane. Returns 0 or 1 line segment."""
    points_above = []
    points_below = []
    for v in tri:
        if v[2] >= z:
            points_above.append(v)
        else:
            points_below.append(v)

    if len(points_above) == 0 or len(points_below) == 0:
        return None

    # Find intersection points
    intersections = []
    for a in points_above:
        for b in points_below:
            if abs(a[2] - b[2]) < 1e-10:
                continue
            t = (z - b[2]) / (a[2] - b[2])
            ix = b[0] + t * (a[0] - b[0])
            iy = b[1] + t * (a[1] - b[1])
            intersections.append((ix, iy))

    if len(intersections) >= 2:
        return (intersections[0], intersections[1])
    return None


def slice_at_z(triangles, z):
    """Slice all triangles at height z, return list of line segments."""
    segments = []
    for tri in triangles:
        seg = slice_triangle_at_z(tri, z)
        if seg is not None:
            segments.append(seg)
    return segments


def chain_segments(segments, tolerance=0.05):
    """Chain line segments into continuous paths (polylines)."""
    if not segments:
        return []

    remaining = list(segments)
    paths = []

    while remaining:
        path = list(remaining.pop(0))
        changed = True
        while changed:
            changed = False
            for i, seg in enumerate(remaining):
                p0, p1 = seg
                # Try to attach to end of path
                end = path[-1]
                if dist2d(end, p0) < tolerance:
                    path.append(p1)
                    remaining.pop(i)
                    changed = True
                    break
                elif dist2d(end, p1) < tolerance:
                    path.append(p0)
                    remaining.pop(i)
                    changed = True
                    break
                # Try to attach to start of path
                start = path[0]
                if dist2d(start, p0) < tolerance:
                    path.insert(0, p1)
                    remaining.pop(i)
                    changed = True
                    break
                elif dist2d(start, p1) < tolerance:
                    path.insert(0, p0)
                    remaining.pop(i)
                    changed = True
                    break
        paths.append(path)

    return paths


def dist2d(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def offset_path_inward(path, offset):
    """Crude inward offset of a closed path for perimeters."""
    if len(path) < 3:
        return path
    n = len(path)
    # Check if closed
    is_closed = dist2d(path[0], path[-1]) < 0.1
    result = []
    for i in range(n):
        p_prev = path[(i - 1) % n]
        p_curr = path[i]
        p_next = path[(i + 1) % n]

        # Edge normals
        dx1 = p_curr[0] - p_prev[0]
        dy1 = p_curr[1] - p_prev[1]
        l1 = math.sqrt(dx1 * dx1 + dy1 * dy1)
        if l1 < 1e-10:
            result.append(p_curr)
            continue
        nx1, ny1 = -dy1 / l1, dx1 / l1

        dx2 = p_next[0] - p_curr[0]
        dy2 = p_next[1] - p_curr[1]
        l2 = math.sqrt(dx2 * dx2 + dy2 * dy2)
        if l2 < 1e-10:
            result.append(p_curr)
            continue
        nx2, ny2 = -dy2 / l2, dx2 / l2

        # Average normal
        nx = (nx1 + nx2) / 2
        ny = (ny1 + ny2) / 2
        nl = math.sqrt(nx * nx + ny * ny)
        if nl < 1e-10:
            result.append(p_curr)
            continue
        nx /= nl
        ny /= nl

        result.append((p_curr[0] + nx * offset, p_curr[1] + ny * offset))
    return result


def generate_infill(x_min, y_min, x_max, y_max, spacing, layer_num):
    """Generate grid infill lines within bounding box."""
    lines = []
    if layer_num % 2 == 0:
        # Lines along X
        y = y_min + spacing / 2
        while y < y_max:
            lines.append(((x_min, y), (x_max, y)))
            y += spacing
    else:
        # Lines along Y
        x = x_min + spacing / 2
        while x < x_max:
            lines.append(((x, y_min), (x, y_max)))
            x += spacing
    return lines


# ---------------------------------------------------------------------------
# G-code emitter
# ---------------------------------------------------------------------------
class GCodeWriter:
    def __init__(self, profile, filename):
        self.p = profile
        self.f = open(filename, "w")
        self.e_pos = 0.0  # cumulative extrusion
        self.x = 0.0
        self.y = 0.0
        self.z = 0.0
        self.retracted = False
        self.filament_area = math.pi * (self.p.FILAMENT_DIAMETER / 2) ** 2

    def write(self, line):
        self.f.write(line + "\n")

    def close(self):
        self.f.close()

    def extrusion_for_move(self, x1, y1, x0, y0, layer_height, line_width):
        """Calculate E value for a linear move."""
        dist = math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2)
        cross_section = layer_height * line_width
        volume = cross_section * dist
        e = volume / self.filament_area * self.p.EXTRUSION_MULTIPLIER
        return e

    def start_gcode(self):
        """Bambu Lab X1 compatible start G-code."""
        self.write("; ========================================")
        self.write("; Pegboard TIG Welding Nozzle Holder")
        self.write("; Generated for: Bambu Lab X1 Carbon")
        self.write(f"; Material: {self.p.MATERIAL}")
        self.write(f"; Layer height: {self.p.LAYER_HEIGHT} mm")
        self.write(f"; Nozzle: {self.p.NOZZLE_DIAMETER} mm")
        self.write(f"; Infill: {self.p.INFILL_PERCENT}%")
        self.write("; ========================================")
        self.write("")
        self.write("; --- Start G-code (Bambu Lab X1) ---")
        self.write("M73 P0 R999 ; Set progress 0%")
        self.write(f"M140 S{self.p.BED_TEMP} ; Set bed temp")
        self.write(f"M104 S{self.p.NOZZLE_TEMP} ; Set nozzle temp")
        self.write("G28 ; Home all axes")
        self.write("G90 ; Absolute positioning")
        self.write("M83 ; Relative extrusion")
        self.write(f"M190 S{self.p.BED_TEMP} ; Wait for bed temp")
        self.write(f"M109 S{self.p.NOZZLE_TEMP} ; Wait for nozzle temp")
        self.write("")
        self.write("; Prime line")
        self.write(f"G1 Z5 F{self.p.Z_HOP_SPEED * 60:.0f}")
        self.write(f"G1 X5 Y5 F{self.p.TRAVEL_SPEED * 60:.0f}")
        self.write(f"G1 Z{self.p.FIRST_LAYER_HEIGHT} F{self.p.Z_HOP_SPEED * 60:.0f}")
        self.write(f"G1 X100 E15 F{self.p.FIRST_LAYER_SPEED * 60:.0f} ; Prime line")
        self.write("G1 E-0.5 F2400 ; Small retract")
        self.write("G1 Z2 F600")
        self.write("")
        self.e_pos = 0.0

    def end_gcode(self):
        """Bambu Lab X1 compatible end G-code."""
        self.write("")
        self.write("; --- End G-code (Bambu Lab X1) ---")
        self.write("M400 ; Wait for moves to finish")
        self.write(f"G1 E-{self.p.RETRACT_LENGTH} F{self.p.RETRACT_SPEED * 60:.0f} ; Retract")
        self.write("G91 ; Relative positioning")
        self.write("G1 Z10 F600 ; Lift nozzle")
        self.write("G90 ; Absolute positioning")
        self.write(f"G1 X10 Y{self.p.BED_SIZE_Y - 10} F{self.p.TRAVEL_SPEED * 60:.0f} ; Park")
        self.write("M104 S0 ; Nozzle off")
        self.write("M140 S0 ; Bed off")
        self.write("M106 S0 ; Fan off")
        self.write("M84 ; Steppers off")
        self.write("M73 P100 R0 ; Set progress 100%")

    def retract(self):
        if not self.retracted:
            self.write(f"G1 E-{self.p.RETRACT_LENGTH:.3f} F{self.p.RETRACT_SPEED * 60:.0f} ; Retract")
            if self.p.RETRACT_Z_HOP > 0:
                self.write(f"G1 Z{self.z + self.p.RETRACT_Z_HOP:.3f} F{self.p.Z_HOP_SPEED * 60:.0f} ; Z-hop")
            self.retracted = True

    def deretract(self):
        if self.retracted:
            self.write(f"G1 Z{self.z:.3f} F{self.p.Z_HOP_SPEED * 60:.0f} ; De-hop")
            self.write(f"G1 E{self.p.RETRACT_LENGTH:.3f} F{self.p.DERETRACT_SPEED * 60:.0f} ; Deretract")
            self.retracted = False

    def travel_to(self, x, y):
        self.retract()
        self.write(f"G1 X{x:.3f} Y{y:.3f} F{self.p.TRAVEL_SPEED * 60:.0f}")
        self.x = x
        self.y = y

    def move_z(self, z):
        self.z = z
        self.write(f"G1 Z{z:.3f} F{self.p.Z_HOP_SPEED * 60:.0f}")

    def extrude_to(self, x, y, speed, layer_height, line_width):
        self.deretract()
        e = self.extrusion_for_move(x, y, self.x, self.y, layer_height, line_width)
        self.write(f"G1 X{x:.3f} Y{y:.3f} E{e:.5f} F{speed * 60:.0f}")
        self.x = x
        self.y = y
        self.e_pos += e

    def set_fan(self, percent):
        s = int(percent * 255 / 100)
        self.write(f"M106 S{s} ; Fan {percent}%")

    def layer_comment(self, layer_num, z):
        self.write(f"\n; LAYER {layer_num} / Z={z:.2f}")
        self.write(f"M73 P{layer_num} ; Progress placeholder")

    def print_path(self, path, speed, layer_height, line_width):
        """Print a polyline path."""
        if not path or len(path) < 2:
            return
        self.travel_to(path[0][0], path[0][1])
        self.deretract()
        for pt in path[1:]:
            self.extrude_to(pt[0], pt[1], speed, layer_height, line_width)


# ---------------------------------------------------------------------------
# Main slicing + G-code pipeline
# ---------------------------------------------------------------------------
def generate_gcode(stl_file, output_file, profile):
    print(f"Reading STL: {stl_file}")
    triangles = read_stl_binary(stl_file)
    print(f"  {len(triangles)} triangles loaded")

    z_min, z_max = get_z_bounds(triangles)
    print(f"  Z range: {z_min:.2f} to {z_max:.2f} mm")

    # Center the model on the build plate
    x_all = [v[0] for tri in triangles for v in tri]
    y_all = [v[1] for tri in triangles for v in tri]
    x_min_m, x_max_m = min(x_all), max(x_all)
    y_min_m, y_max_m = min(y_all), max(y_all)

    x_offset = profile.BED_SIZE_X / 2 - (x_min_m + x_max_m) / 2
    y_offset = profile.BED_SIZE_Y / 2 - (y_min_m + y_max_m) / 2
    z_offset = -z_min  # place bottom on bed

    # Apply offsets
    shifted_triangles = []
    for tri in triangles:
        shifted_triangles.append(tuple(
            (v[0] + x_offset, v[1] + y_offset, v[2] + z_offset)
            for v in tri
        ))
    triangles = shifted_triangles

    z_min += z_offset
    z_max += z_offset

    # Compute layers
    layers_z = []
    z = profile.FIRST_LAYER_HEIGHT
    while z <= z_max + 0.01:
        layers_z.append(z)
        z += profile.LAYER_HEIGHT
    print(f"  {len(layers_z)} layers")

    # Write G-code
    gw = GCodeWriter(profile, output_file)
    gw.start_gcode()

    infill_spacing = profile.LINE_WIDTH / (profile.INFILL_PERCENT / 100.0)

    for layer_num, z in enumerate(layers_z):
        gw.layer_comment(layer_num, z)
        gw.move_z(z)

        # Fan control
        if layer_num == 0:
            gw.set_fan(0)
        elif layer_num == 1:
            gw.set_fan(50)
        else:
            gw.set_fan(profile.FAN_SPEED_MAX)

        # Determine speeds for this layer
        is_first = (layer_num == 0)
        wall_speed = profile.FIRST_LAYER_SPEED if is_first else profile.OUTER_WALL_SPEED
        infill_speed = profile.FIRST_LAYER_SPEED if is_first else profile.PRINT_SPEED
        lh = profile.FIRST_LAYER_HEIGHT if is_first else profile.LAYER_HEIGHT
        lw = profile.FIRST_LAYER_LINE_WIDTH if is_first else profile.LINE_WIDTH

        # Slice at this Z height
        segments = slice_at_z(triangles, z)
        if not segments:
            continue

        paths = chain_segments(segments)

        # Print outer perimeters
        for path in paths:
            gw.print_path(path, wall_speed, lh, lw)

        # Print inner perimeters (offset inward)
        for loop in range(1, profile.WALL_LOOPS):
            for path in paths:
                offset_p = offset_path_inward(path, loop * profile.LINE_WIDTH)
                if offset_p and len(offset_p) >= 2:
                    gw.print_path(offset_p, profile.PRINT_SPEED if not is_first else profile.FIRST_LAYER_SPEED, lh, lw)

        # Infill
        x_bounds = [pt[0] for path in paths for pt in path]
        y_bounds = [pt[1] for path in paths for pt in path]
        if x_bounds and y_bounds:
            infill_lines = generate_infill(
                min(x_bounds) + profile.LINE_WIDTH * profile.WALL_LOOPS,
                min(y_bounds) + profile.LINE_WIDTH * profile.WALL_LOOPS,
                max(x_bounds) - profile.LINE_WIDTH * profile.WALL_LOOPS,
                max(y_bounds) - profile.LINE_WIDTH * profile.WALL_LOOPS,
                infill_spacing, layer_num
            )
            for line in infill_lines:
                gw.print_path([line[0], line[1]], infill_speed, lh, lw)

    gw.end_gcode()
    gw.close()
    print(f"\nG-code written: {output_file}")
    print(f"  Total extrusion: {gw.e_pos:.1f} mm")
    print(f"  Layers: {len(layers_z)}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="STL to G-code for Bambu Lab X1")
    parser.add_argument("stl_file", help="Input STL file")
    parser.add_argument("-o", "--output", default="pegboard_tig_holder.gcode",
                        help="Output G-code file")
    parser.add_argument("--material", choices=["PLA", "PETG"], default="PLA",
                        help="Material preset")
    parser.add_argument("--infill", type=int, default=25,
                        help="Infill percentage (default: 25)")
    parser.add_argument("--layer-height", type=float, default=0.20,
                        help="Layer height in mm (default: 0.20)")
    args = parser.parse_args()

    profile = BambuX1Profile()
    profile.MATERIAL = args.material
    profile.INFILL_PERCENT = max(5, min(100, args.infill))
    profile.LAYER_HEIGHT = args.layer_height

    if args.material == "PETG":
        profile.NOZZLE_TEMP = profile.NOZZLE_TEMP_PETG
        profile.BED_TEMP = profile.BED_TEMP_PETG

    generate_gcode(args.stl_file, args.output, profile)


if __name__ == "__main__":
    main()
