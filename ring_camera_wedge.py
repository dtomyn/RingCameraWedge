"""Generates ring_camera_wedge.stl (mm) from the sketch in Scan_20261101.png.

Setup:    see README.md (virtual environment or VS Code dev container)
Usage:    python ring_camera_wedge.py [--angle 8] [--output path.stl]

Axes: X = thickness (back face at x=0), Y = across the block (thin side at y=0),
      Z = height. The angled face carries the camera.
"""
import argparse
from pathlib import Path

import numpy as np
import trimesh

# Dimensions written on the sketch
HEIGHT = 110.0
FACE_WIDTH = 55.0
CAMERA_HOLE_D = 2.25
CAMERA_HOLE_SPACING = 91.5
POCKET_Z = (30.0, 60.0)
CABLE_D = 8.0
SCREW_D = 4.0
SCREW_HEAD_D = 8.0

# Not dimensioned on the sketch: scaled from the drawing (6.73 px/mm)
ANGLE_DEG = 8.0  # marked "?" on the sketch
THICK_SIDE = 46.0
POCKET_WIDTH = 34.0
POCKET_BACK_X = 29.0  # marked "Depth ?" on the sketch
CAMERA_HOLE_DEPTH = 17.0
CABLE_OFFSET = 10.0  # from the face centreline, towards the thick side
CABLE_Z = 35.0
SCREW_X = 20.0
SCREW_SPACING = 65.0
SCREW_SINK_DEPTH = 2.0

SECTIONS = 128
OVERSHOOT = 1.0  # cutters extend past surfaces for clean booleans


def prism(xy, z0, z1):
    """Extrude a convex counter-clockwise XY polygon between z0 and z1."""
    n = len(xy)
    vertices = [(x, y, z0) for x, y in xy] + [(x, y, z1) for x, y in xy]
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces += [(i, j, n + j), (i, n + j, n + i)]
    for i in range(1, n - 1):
        faces += [(0, i + 1, i), (n, n + i, n + i + 1)]
    return trimesh.Trimesh(vertices, faces)


def screw_cutter(y_end, x, z):
    """Through hole along +Y with a countersink opening on the thin side (y=0)."""
    r, head_r = SCREW_D / 2, SCREW_HEAD_D / 2
    shaft = trimesh.creation.cylinder(r, segment=((x, -OVERSHOOT, z), (x, y_end + OVERSHOOT, z)), sections=SECTIONS)
    collar = trimesh.creation.cylinder(head_r, segment=((x, -OVERSHOOT, z), (x, 0, z)), sections=SECTIONS)
    # Cone from the head diameter at y=0 down to the shaft diameter
    profile = [(0, 0), (head_r, 0), (r, SCREW_SINK_DEPTH), (0, SCREW_SINK_DEPTH)]
    cone = trimesh.creation.revolve(np.array(profile), sections=SECTIONS)
    if cone.volume < 0:
        cone.invert()
    # Map the revolve axis (+Z) onto +Y, then move into place
    cone.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, (1, 0, 0)))
    cone.apply_translation((x, 0, z))
    return [shaft, collar, cone]


def build(angle_deg):
    a = np.radians(angle_deg)
    along = np.array((np.sin(a), np.cos(a)))  # along the angled face, thin to thick
    normal = np.array((np.cos(a), -np.sin(a)))  # out of the angled face
    thin_side = THICK_SIDE - FACE_WIDTH * np.sin(a)
    y_extent = FACE_WIDTH * np.cos(a)

    def on_face(s):
        return np.array((thin_side, 0.0)) + along * s

    def to_pocket_back(p):
        return p - normal * (p[0] - POCKET_BACK_X) / normal[0]

    centre = FACE_WIDTH / 2
    block = prism([(0, 0), (thin_side, 0), (THICK_SIDE, y_extent), (0, y_extent)], 0, HEIGHT)

    cutters = []

    # Electrical connection allowance: walls square to the face, back parallel to the back face
    p0 = on_face(centre - POCKET_WIDTH / 2)
    p1 = on_face(centre + POCKET_WIDTH / 2)
    pocket = [to_pocket_back(p0), p0 + normal * OVERSHOOT, p1 + normal * OVERSHOOT, to_pocket_back(p1)]
    cutters.append(prism([tuple(p) for p in pocket], *POCKET_Z))

    # Electrical connection cableway: from the back face into the pocket
    y_cable = on_face(centre + CABLE_OFFSET)[1]
    cutters.append(trimesh.creation.cylinder(
        CABLE_D / 2,
        segment=((-OVERSHOOT, y_cable, CABLE_Z), (POCKET_BACK_X + OVERSHOOT, y_cable, CABLE_Z)),
        sections=SECTIONS))

    # Ring camera mounting holes: blind, square to the angled face
    p = on_face(centre)
    outer, inner = p + normal * OVERSHOOT, p - normal * CAMERA_HOLE_DEPTH
    for z in (HEIGHT - CAMERA_HOLE_SPACING) / 2, (HEIGHT + CAMERA_HOLE_SPACING) / 2:
        cutters.append(trimesh.creation.cylinder(
            CAMERA_HOLE_D / 2, segment=((*outer, z), (*inner, z)), sections=SECTIONS))

    # Block mounting screw holes: through, countersunk on the thin side
    for z in (HEIGHT - SCREW_SPACING) / 2, (HEIGHT + SCREW_SPACING) / 2:
        cutters += screw_cutter(y_extent, SCREW_X, z)

    return trimesh.boolean.difference([block, *cutters], engine="manifold")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--angle", type=float, default=ANGLE_DEG)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("ring_camera_wedge.stl"))
    args = parser.parse_args()
    mesh = build(args.angle)
    mesh.export(args.output)
    print(f"{args.output}: watertight={mesh.is_watertight} volume={mesh.volume / 1000:.1f} cm3 "
          f"bounds={np.round(mesh.extents, 2).tolist()} mm faces={len(mesh.faces)}")
