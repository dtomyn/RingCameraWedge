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

# Weather sealing: grooves are sized for 2 mm cord or O-rings
SEAL_GROOVE_WIDTH = 2.2
SEAL_GROOVE_DEPTH = 1.5
POCKET_SEAL_MARGIN = 3.5  # from the pocket edge to the groove centreline
POCKET_SEAL_CORNER_R = 5.0  # centreline
CABLE_SEAL_R = 10.0  # centreline: an 18 x 2 mm O-ring
SCREW_SEAL_R = 5.0  # centreline: an 8 x 2 mm O-ring
CABLE_RISE_DEG = 5.0  # the cableway climbs towards the pocket, so water runs back out
CABLE_RECESS_D = 12.0  # holds sealing putty around the cable at the back face
CABLE_RECESS_DEPTH = 6.0
WEEP_D = 3.0  # lets water that does get into the pocket out of the bottom
WEEP_OFFSET = 10.0  # from the face centreline, towards the thin side
WEEP_BEHIND_FACE = 6.0

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


def rounded_rect(half_u, half_v, corner_r):
    """Counter-clockwise outline; equal half sizes and corner radius give a circle."""
    points = []
    for quadrant, (su, sv) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        for a in np.linspace(0, np.pi / 2, SECTIONS // 4) + quadrant * np.pi / 2:
            points.append((su * (half_u - corner_r) + corner_r * np.cos(a),
                           sv * (half_v - corner_r) + corner_r * np.sin(a)))
    return [p for i, p in enumerate(points) if not np.allclose(p, points[i - 1])]


def seal_groove(origin, u, v, half_u, half_v, corner_r):
    """Cutter for a gasket groove around origin, sunk into the face whose outward normal is u x v.

    Half sizes and corner radius are measured to the groove's centreline.
    """
    w = SEAL_GROOVE_WIDTH / 2
    outer = prism(rounded_rect(half_u + w, half_v + w, corner_r + w), -SEAL_GROOVE_DEPTH, OVERSHOOT)
    inner = prism(rounded_rect(half_u - w, half_v - w, corner_r - w), -SEAL_GROOVE_DEPTH - OVERSHOOT, 2 * OVERSHOOT)
    groove = trimesh.boolean.difference([outer, inner], engine="manifold")
    transform = np.eye(4)
    transform[:3, 0], transform[:3, 1], transform[:3, 2] = u, v, np.cross(u, v)
    transform[:3, 3] = origin
    groove.apply_transform(transform)
    return groove


def pocket_seal_groove(origin, u):
    """Gasket groove around the pocket; origin is the pocket's centre on the camera face."""
    return seal_groove(origin, u, (0, 0, 1),
                       POCKET_WIDTH / 2 + POCKET_SEAL_MARGIN,
                       (POCKET_Z[1] - POCKET_Z[0]) / 2 + POCKET_SEAL_MARGIN,
                       POCKET_SEAL_CORNER_R)


def ring_seal_groove(origin, u, radius):
    return seal_groove(origin, u, (0, 0, 1), radius, radius, radius)


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

    # Gasket between the camera and the face, around the pocket
    cutters.append(pocket_seal_groove((*on_face(centre), sum(POCKET_Z) / 2), (*along, 0)))

    # Weep hole from the pocket floor out of the bottom of the block
    weep = on_face(centre - WEEP_OFFSET) - normal * WEEP_BEHIND_FACE
    cutters.append(trimesh.creation.cylinder(
        WEEP_D / 2, segment=((*weep, -OVERSHOOT), (*weep, POCKET_Z[0] + OVERSHOOT)), sections=SECTIONS))

    # Electrical connection cableway: from the back face, rising into the pocket
    y_cable = on_face(centre + CABLE_OFFSET)[1]
    rise = np.tan(np.radians(CABLE_RISE_DEG))
    x_end = POCKET_BACK_X + OVERSHOOT
    cutters.append(trimesh.creation.cylinder(
        CABLE_D / 2,
        segment=((-OVERSHOOT, y_cable, CABLE_Z - rise * OVERSHOOT), (x_end, y_cable, CABLE_Z + rise * x_end)),
        sections=SECTIONS))
    cutters.append(trimesh.creation.cylinder(
        CABLE_RECESS_D / 2,
        segment=((-OVERSHOOT, y_cable, CABLE_Z), (CABLE_RECESS_DEPTH, y_cable, CABLE_Z)),
        sections=SECTIONS))
    cutters.append(ring_seal_groove((0, y_cable, CABLE_Z), (0, -1, 0), CABLE_SEAL_R))

    # Ring camera mounting holes: blind, square to the angled face
    p = on_face(centre)
    outer, inner = p + normal * OVERSHOOT, p - normal * CAMERA_HOLE_DEPTH
    for z in (HEIGHT - CAMERA_HOLE_SPACING) / 2, (HEIGHT + CAMERA_HOLE_SPACING) / 2:
        cutters.append(trimesh.creation.cylinder(
            CAMERA_HOLE_D / 2, segment=((*outer, z), (*inner, z)), sections=SECTIONS))

    # Block mounting screw holes: through, countersunk on the thin side
    for z in (HEIGHT - SCREW_SPACING) / 2, (HEIGHT + SCREW_SPACING) / 2:
        cutters += screw_cutter(y_extent, SCREW_X, z)
        cutters.append(ring_seal_groove((SCREW_X, y_extent, z), (-1, 0, 0), SCREW_SEAL_R))

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
