# Pegboard TIG Welding Nozzle Holder

A modular, parametric pegboard-mount holder for storing TIG welding nozzles (cups).
Designed for standard 1-inch (25.4 mm) pegboard hole spacing.

## Features

- **Modular**: 1–6 nozzle slots configurable via CLI
- **Parametric**: All dimensions adjustable in `Config` class
- **Standard pegboard**: Fits 1/4" pegboard with 1" hole spacing
- **TIG cup sizes**: Slots for #4, #5, #6-7, #8, #10, #12 nozzles
- **Bambu Lab X1 optimized**: G-code generator with proper start/end sequences, retraction, and speed profiles

## Slot Sizes

| Slot  | Cup Size | Holder Diameter |
|-------|----------|-----------------|
| 1     | #4       | 8.0 mm          |
| 2     | #5       | 10.0 mm         |
| 3     | #6-7     | 13.0 mm         |
| 4     | #8       | 16.0 mm         |
| 5     | #10      | 19.0 mm         |
| 6     | #12      | 22.0 mm         |

## Quick Start

```bash
# Generate STL (default 4 slots)
python3 pegboard_tig_holder.py

# Generate STL with 6 slots
python3 pegboard_tig_holder.py --slots 6

# Generate G-code for Bambu Lab X1
python3 gcode_generator.py pegboard_tig_holder.stl -o holder.gcode

# Use PETG instead of PLA
python3 gcode_generator.py pegboard_tig_holder.stl -o holder.gcode --material PETG

# Custom infill and layer height
python3 gcode_generator.py pegboard_tig_holder.stl -o holder.gcode --infill 30 --layer-height 0.16
```

## Print Settings (Bambu Lab X1 defaults)

| Setting          | Value     |
|------------------|-----------|
| Layer height     | 0.20 mm   |
| Nozzle           | 0.4 mm    |
| Infill           | 25% grid  |
| Walls            | 3 loops   |
| PLA temp         | 220°C     |
| Bed temp         | 60°C      |
| Print speed      | 80 mm/s   |
| Outer wall speed | 50 mm/s   |

## Requirements

- Python 3.8+
- `numpy` and `numpy-stl` (`pip install numpy numpy-stl`)

## File Structure

```
pegboard-tig-holder/
├── pegboard_tig_holder.py   # Parametric STL generator
├── gcode_generator.py       # STL → G-code slicer (Bambu X1)
├── pegboard_tig_holder.stl  # Generated STL model
├── pegboard_tig_holder.gcode # Generated G-code
└── README.md
```
