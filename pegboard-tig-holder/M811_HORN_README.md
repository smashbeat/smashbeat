# M811 Multicell Horn - 3D Printable

## 8 Cells | 11" Wide | 550Hz | +10dB from 600Hz | 1" Throat | 1:3/8"-18 UNS Thread

A parametric, 3D-printable multicell horn for 1" compression drivers, compatible
with JBL and Altec Lansing drivers.

## Specifications

| Parameter | Value |
|-----------|-------|
| Configuration | 4 x 2 cells (8 total) |
| Mouth width | 11.22" (285mm) |
| Horn depth | 5.71" (145mm) |
| Total height | 10.26" (261mm) |
| Cutoff frequency | 550 Hz |
| Response | +10dB from 600Hz |
| Throat | 1" (25.4mm) |
| Thread | 1-3/8"-18 UNS |
| Cell throat | 8.0 x 8.0 mm per cell |
| Cell mouth | 65.6 x 58.2 mm per cell |
| Divider walls | 4.5mm (structural, matching reference) |
| Outer walls | 5.5mm |
| Internal diagonal | 3.94" (100.1mm) |
| Fan geometry | Focal-point projection (H: 34.3mm, V: 42.6mm) |
| Target weight | ~730g per horn |
| Material | Hyper PLA+ (Black) |

## Driver Compatibility

- JBL 1" compression drivers (3-bolt pattern, 2.625" BCD)
- Altec Lansing 1" compression drivers (2-bolt pattern)
- Any 1-3/8"-18 UNS threaded 1" driver

## Parts List (per horn)

| Part | File | Qty | Description |
|------|------|-----|-------------|
| Horn Right | `horn_right.stl` | 1 | Right half of horn body |
| Horn Left | `horn_left.stl` | 1 | Left half (mirror) |
| Throat Adapter | `throat_adapter.stl` | 1 | Rect-to-round transition + thread |
| JBL Flange | `flange_jbl.stl` | 1 | JBL 3-bolt adapter |
| Altec Flange | `flange_altec.stl` | 1 | Altec 2-bolt adapter |
| Joining Plate | `joining_plate.stl` | 2 | Plates to join horn halves |

**For a stereo pair: print all parts x2**

## Print Settings (Bambu Lab X1 Carbon)

| Setting | Value |
|---------|-------|
| Material | Hyper PLA+ (Black) |
| Layer height | 0.20mm |
| Line width | 0.42mm |
| Walls | 3-4 loops |
| Infill | 25-30% (gyroid recommended for acoustic damping) |
| Top/Bottom layers | 4 |
| Nozzle temp | 220°C |
| Bed temp | 60°C |
| Print speed | 80mm/s (50mm/s outer walls) |
| Support | Minimal (throat adapter transition only) |
| Orientation | Mouth facing up for horn halves |

## Assembly

1. **Join horn halves**: Align left + right halves at the center seam. Secure with 2x joining plates using M4 bolts. Apply cyanoacrylate or epoxy along the seam.

2. **Attach throat adapter**: The throat adapter's rectangular end mates with the horn body throat opening. Secure with adhesive.

3. **Mount driver flange**: Thread the appropriate flange (JBL or Altec) onto your compression driver.

4. **Final assembly**: Thread the driver+flange assembly into the throat adapter using the 1-3/8"-18 UNS thread.

## Hardware Needed

- 8x M4 x 16mm bolts + nuts (for joining plates)
- 4x 4mm x 8mm dowel pins (for alignment)
- Cyanoacrylate or epoxy adhesive
- PTFE tape (optional, for thread sealing)

## File Structure

```
m811_horn_stl/           # STL files (for import into Bambu Studio)
  horn_right.stl
  horn_left.stl
  throat_adapter.stl
  flange_jbl.stl
  flange_altec.stl
  joining_plate.stl

m811_horn_gcode/         # Pre-generated G-code (Bambu Lab X1)
  horn_right.gcode
  horn_left.gcode
  throat_adapter.gcode
  flange_jbl.gcode
  flange_altec.gcode
  joining_plate.gcode

multicell_horn.py        # Parametric generator (modify and regenerate)
gcode_generator.py       # STL to G-code slicer
```

## Customization

```bash
# Regenerate all STL parts
python3 multicell_horn.py --output-dir m811_horn_stl

# Re-slice for PETG
python3 gcode_generator.py m811_horn_stl/horn_right.stl -o horn_right.gcode --material PETG

# Finer layers for better surface finish
python3 gcode_generator.py m811_horn_stl/horn_right.stl -o horn_right.gcode --layer-height 0.12
```

## Notes

- For best acoustic results, recommend importing STL files into Bambu Studio
  for slicing with gyroid infill (provides better acoustic damping than grid)
- The horn halves are designed to fit within the 256mm x 256mm x 256mm build
  volume of the Bambu Lab X1 Carbon
- Consider printing with 0.16mm layers for smoother horn cell walls
- Post-processing: light sanding of internal cell walls can improve high-frequency response
