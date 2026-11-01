"""Generates a two-part version of the wedge whose camera angle can be adjusted.

The base fixes to the mounting surface. The head carries the camera and swivels
on a vertical axis between the base's two cheeks, clamped by two M4 screws that
stay reachable from the top and bottom with the camera fitted.

Setup:    see README.md (virtual environment or VS Code dev container)
Usage:    python ring_camera_wedge_adjustable.py [--assembly-angle 8] [--output-dir dir]

Base and head STLs are exported lying in their print orientation. The assembly
STL is for viewing only. Axes match ring_camera_wedge.py.
"""
import argparse
from pathlib import Path

import numpy as np
import trimesh

from ring_camera_wedge import (
    CABLE_D, CABLE_OFFSET, CABLE_Z, CAMERA_HOLE_D, CAMERA_HOLE_SPACING, FACE_WIDTH,
    HEIGHT, OVERSHOOT, POCKET_WIDTH, POCKET_Z, SCREW_SPACING, SCREW_X, SECTIONS,
    SCREW_D, SCREW_HEAD_D, SCREW_SINK_DEPTH, prism,
)

MAX_ANGLE_DEG = 20.0  # the cable slot and clearances are designed for 0 to this

# Swivel position; head dimensions below are measured from this axis
AXIS_X = 30.5
AXIS_Y = FACE_WIDTH / 2
DRUM_R = 26.0
DRUM_Z = (29.0, 81.0)
FIT_CLEARANCE = 0.3  # between the head and the base, both radially and at the cheeks

# Base
BASE_FRONT_X = 27.5
BASE_MID_FRONT_X = 22.5  # lower between the cheeks, to avoid thin edges on the saddle
CHEEK_Z = (17.0, 93.0)  # outer faces of the cheeks, where the clamp screw heads sit
CHEEK_LOBE_R = 7.0
DRIVER_BORE_R = 6.0

# Head
PLATE_BACK = 11.0
PLATE_FRONT = 16.0
POCKET_BACK = 5.0
BOSS_R = 4.0
BOSS_BACK = 3.5  # leaves room for a screwdriver (up to 7 mm) to pass the bosses
CAMERA_HOLE_BACK = 4.0

# Clamp hardware: M4 x 30 screw, M4 hex nut, washer
CLAMP_HOLE_D = 4.5
CLAMP_SCREW_LENGTH = 30.0
NUT_ACROSS_FLATS = 7.2
NUT_SLOT_THICKNESS = 3.4
NUT_SEAT_FROM_HEAD = 24.0  # distance from the screw head to the near face of the nut


def box(x0, x1, y0, y1, z0, z1):
    return prism([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1)


def z_cylinder(radius, x, y, z0, z1):
    return trimesh.creation.cylinder(radius, segment=((x, y, z0), (x, y, z1)), sections=SECTIONS)


def mounting_screw_cutter(y_end, x, z):
    """Through hole along +Y, countersunk on the thin side, revolved as one solid."""
    r, head_r = SCREW_D / 2, SCREW_HEAD_D / 2
    profile = [(0, -OVERSHOOT), (head_r, -OVERSHOOT), (head_r, 0), (r, SCREW_SINK_DEPTH),
               (r, y_end + OVERSHOOT), (0, y_end + OVERSHOOT)]
    cutter = trimesh.creation.revolve(np.array(profile), sections=SECTIONS)
    if cutter.volume < 0:
        cutter.invert()
    # Map the revolve axis (+Z) onto +Y, then move into place
    cutter.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, (1, 0, 0)))
    cutter.apply_translation((x, 0, z))
    return cutter


def build_base():
    x, y = AXIS_X, AXIS_Y
    cheek_inner = (DRUM_Z[0] - FIT_CLEARANCE, DRUM_Z[1] + FIT_CLEARANCE)
    body = trimesh.boolean.difference([
        box(0, BASE_FRONT_X, 0, FACE_WIDTH, 0, HEIGHT),
        # Space between the cheeks, with a saddle the head's drum turns in
        box(BASE_MID_FRONT_X, BASE_FRONT_X + OVERSHOOT, -OVERSHOOT, FACE_WIDTH + OVERSHOOT, *cheek_inner),
        z_cylinder(DRUM_R + FIT_CLEARANCE, x, y, *cheek_inner),
        # Screwdriver access to the clamp screws from below and above
        z_cylinder(DRIVER_BORE_R, x, y, -OVERSHOOT, CHEEK_Z[0]),
        z_cylinder(DRIVER_BORE_R, x, y, CHEEK_Z[1], HEIGHT + OVERSHOOT),
    ], engine="manifold")

    # Added after the cuts above, which share their end planes with the lobes
    lobes = []
    for z0, z1 in (CHEEK_Z[0], cheek_inner[0]), (cheek_inner[1], CHEEK_Z[1]):
        lobes.append(z_cylinder(CHEEK_LOBE_R, x, y, z0, z1))
        lobes.append(box(BASE_FRONT_X - OVERSHOOT, x, y - CHEEK_LOBE_R, y + CHEEK_LOBE_R, z0, z1))
    body = trimesh.boolean.union([body, *lobes], engine="manifold")

    cutters = [
        # Clamp screw holes through the cheeks
        z_cylinder(CLAMP_HOLE_D / 2, x, y, CHEEK_Z[0] - OVERSHOOT, cheek_inner[0] + OVERSHOOT),
        z_cylinder(CLAMP_HOLE_D / 2, x, y, cheek_inner[1] - OVERSHOOT, CHEEK_Z[1] + OVERSHOOT),
    ]

    # Electrical connection cableway: from the back face into the saddle
    y_cable = y + CABLE_OFFSET
    cutters.append(trimesh.creation.cylinder(
        CABLE_D / 2,
        segment=((-OVERSHOOT, y_cable, CABLE_Z), (BASE_MID_FRONT_X, y_cable, CABLE_Z)),
        sections=SECTIONS))

    # Block mounting screw holes: same pattern as the fixed wedge
    for z in (HEIGHT - SCREW_SPACING) / 2, (HEIGHT + SCREW_SPACING) / 2:
        cutters.append(mounting_screw_cutter(FACE_WIDTH, SCREW_X, z))

    return trimesh.boolean.difference([body, *cutters], engine="manifold")


def build_head():
    """Built with the swivel axis at the origin and the camera face towards +X."""
    half_width = FACE_WIDTH / 2
    drum = trimesh.boolean.intersection([
        z_cylinder(DRUM_R, 0, 0, *DRUM_Z),
        box(-DRUM_R - OVERSHOOT, PLATE_BACK + OVERSHOOT, -DRUM_R - OVERSHOOT, DRUM_R + OVERSHOOT, *DRUM_Z),
    ], engine="manifold")

    camera_z = (HEIGHT - CAMERA_HOLE_SPACING) / 2, (HEIGHT + CAMERA_HOLE_SPACING) / 2
    bosses = [
        trimesh.creation.cylinder(BOSS_R, segment=((BOSS_BACK, 0, z), (PLATE_BACK + OVERSHOOT, 0, z)), sections=SECTIONS)
        for z in camera_z
    ]
    plate = box(PLATE_BACK, PLATE_FRONT, -half_width, half_width, 0, HEIGHT)
    body = trimesh.boolean.union([plate, drum, *bosses], engine="manifold")

    # The cable hole in the base moves across the back of the drum as the head turns
    slot_z = (CABLE_Z - CABLE_D / 2, CABLE_Z + CABLE_D / 2)
    a = np.radians(MAX_ANGLE_DEG)
    y_at_max = -(DRUM_R + FIT_CLEARANCE) * np.sin(a) + CABLE_OFFSET * np.cos(a)
    slot_y = (y_at_max - CABLE_D / 2 - 1, CABLE_OFFSET + CABLE_D / 2 + 0.4)

    cutters = [
        # Electrical connection allowance
        box(POCKET_BACK, PLATE_FRONT + OVERSHOOT, -POCKET_WIDTH / 2, POCKET_WIDTH / 2, *POCKET_Z),
        # Cable route from the back of the drum, past the clamp screw, into the pocket
        box(-DRUM_R - OVERSHOOT, -5, *slot_y, *slot_z),
        box(-5 - OVERSHOOT, POCKET_BACK + OVERSHOOT, 4.5, slot_y[1], *slot_z),
    ]

    # Clamp screws, each with a nut slid in from the thin side
    for head_z, direction in (CHEEK_Z[0], 1), (CHEEK_Z[1], -1):
        tip = head_z + direction * (CLAMP_SCREW_LENGTH + 2)
        entry = DRUM_Z[0] if direction > 0 else DRUM_Z[1]
        cutters.append(z_cylinder(CLAMP_HOLE_D / 2, 0, 0, *sorted((entry - direction * OVERSHOOT, tip))))
        nut_near = head_z + direction * NUT_SEAT_FROM_HEAD
        nut_z = sorted((nut_near, nut_near + direction * NUT_SLOT_THICKNESS))
        cutters.append(box(-NUT_ACROSS_FLATS / 2, NUT_ACROSS_FLATS / 2,
                           -DRUM_R - OVERSHOOT, NUT_ACROSS_FLATS / np.sqrt(3) + 0.05, *nut_z))

    # Ring camera mounting holes
    for z in camera_z:
        cutters.append(trimesh.creation.cylinder(
            CAMERA_HOLE_D / 2,
            segment=((CAMERA_HOLE_BACK, 0, z), (PLATE_FRONT + OVERSHOOT, 0, z)),
            sections=SECTIONS))

    return trimesh.boolean.difference([body, *cutters], engine="manifold")


def place_head(head, angle_deg):
    """Return the head in its assembled position; positive angles match the fixed wedge."""
    placed = head.copy()
    placed.apply_transform(trimesh.transformations.rotation_matrix(np.radians(-angle_deg), (0, 0, 1)))
    placed.apply_translation((AXIS_X, AXIS_Y, 0))
    return placed


def lay_flat(mesh, axis, angle):
    """Rotate into print orientation and rest on the bed at the origin."""
    flat = mesh.copy()
    flat.apply_transform(trimesh.transformations.rotation_matrix(angle, axis))
    flat.apply_translation(-flat.bounds[0])
    return flat


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assembly-angle", type=float, default=8.0)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).parent)
    args = parser.parse_args()

    base, head = build_base(), build_head()
    outputs = {
        # Back face on the bed
        "base": lay_flat(base, (0, 1, 0), -np.pi / 2),
        # Camera face on the bed
        "head": lay_flat(head, (0, 1, 0), np.pi / 2),
        "assembly": trimesh.util.concatenate([base, place_head(head, args.assembly_angle)]),
    }
    for name, mesh in outputs.items():
        path = args.output_dir / f"ring_camera_wedge_adjustable_{name}.stl"
        mesh.export(path)
        print(f"{path}: watertight={mesh.is_watertight} bounds={np.round(mesh.extents, 2).tolist()} mm")
