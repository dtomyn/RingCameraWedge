"""Exports the meshes and facts the explainer video shows, all from the repo's real code.

Nothing here redefines the geometry. The fixed wedge's cutters are captured by
watching the boolean call that build() makes, the angle sweep runs the script
from the command line, and every result is checked against the committed STLs.

Usage:    python video/build_assets.py   (from the virtual environment)
"""
import json
import struct
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import trimesh

VIDEO = Path(__file__).resolve().parent
REPO = VIDEO.parent
OUT = VIDEO / "build" / "assets"
sys.path.insert(0, str(REPO))

import ring_camera_wedge as fixed  # noqa: E402
import ring_camera_wedge_adjustable as adjustable  # noqa: E402

# Cutter groups in the order build() appends them, with the source line that makes each one
FIXED_STAGES = [
    ("Electrical pocket", 1, "cutters.append(prism([tuple(p) for p in pocket], *POCKET_Z))"),
    ("Gasket groove", 1, "cutters.append(pocket_seal_groove("),
    ("Weep hole", 1, "weep = on_face(centre - WEEP_OFFSET)"),
    ("Cableway, recess, O-ring groove", 3, "rise = np.tan(np.radians(CABLE_RISE_DEG))"),
    ("Camera holes", 2, "for z in (HEIGHT - CAMERA_HOLE_SPACING) / 2"),
    ("Mounting screw holes", 4, "cutters.append(screw_cutter(y_extent, SCREW_X, z))"),
]


def capture_cutters():
    """Run the real build() and keep the arguments of its final boolean."""
    real_difference = trimesh.boolean.difference
    calls = []

    def recording(meshes, **kwargs):
        calls.append(list(meshes))
        return real_difference(meshes, **kwargs)

    trimesh.boolean.difference = recording
    try:
        result = fixed.build(fixed.ANGLE_DEG)
    finally:
        trimesh.boolean.difference = real_difference
    block, *cutters = calls[-1]
    return block, cutters, result


def same_mesh(a, b):
    """Same solid; triangulation and the STL format's float32 rounding may differ."""
    return bool(abs(a.volume - b.volume) < 1e-5 * abs(b.volume)
                and np.allclose(a.bounds, b.bounds, atol=1e-3))


def line_of(lines, text):
    for number, line in enumerate(lines, 1):
        if text in line:
            return number
    raise ValueError(f"source line not found: {text}")


def export_fixed_stages(facts):
    block, cutters, final = capture_cutters()
    committed = trimesh.load_mesh(REPO / "ring_camera_wedge.stl")
    facts["checks"]["fixed_build_matches_committed_stl"] = same_mesh(final, committed)

    source = (REPO / "ring_camera_wedge.py").read_text().splitlines()
    block.export(OUT / "stage_0.stl")
    current, index, stages = block, 0, []
    for number, (label, count, marker) in enumerate(FIXED_STAGES, 1):
        group = cutters[index:index + count]
        index += count
        current = trimesh.boolean.difference([current, *group], engine="manifold")
        current.export(OUT / f"stage_{number}.stl")
        trimesh.util.concatenate(group).export(OUT / f"cutter_{number}.stl")
        stages.append({"label": label, "line": line_of(source, marker), "faces": len(current.faces)})
    if index != len(cutters):
        raise ValueError(f"grouped {index} cutters, build() made {len(cutters)}")
    facts["checks"]["fixed_stages_match_final"] = same_mesh(current, final)
    facts["stages"] = stages


def export_angle_sweep(facts):
    """Each angle is a separate run of the script, exactly as a reader would run it."""
    sweep = []
    for angle in range(0, 21):
        path = OUT / f"angle_{angle}.stl"
        started = time.perf_counter()
        run = subprocess.run(
            [sys.executable, str(REPO / "ring_camera_wedge.py"), "--angle", str(angle), "--output", str(path)],
            capture_output=True, text=True, check=True)
        seconds = time.perf_counter() - started
        printed = run.stdout.strip().replace(str(path), f"ring_camera_wedge_{angle}deg.stl")
        sweep.append({"angle": angle, "seconds": round(seconds, 2), "output": printed})
    facts["sweep"] = sweep


def export_adjustable(facts):
    base, head = adjustable.build_base(), adjustable.build_head()
    base.export(OUT / "base.stl")
    head.export(OUT / "head.stl")

    committed = {name: trimesh.load_mesh(REPO / f"ring_camera_wedge_adjustable_{name}.stl")
                 for name in ("base", "head", "assembly")}
    built = {
        "base": adjustable.lay_flat(base, (0, 1, 0), -np.pi / 2),
        "head": adjustable.lay_flat(head, (0, 1, 0), np.pi / 2),
        "assembly": trimesh.util.concatenate([base, adjustable.place_head(head, 8.0)]),
    }
    for name, mesh in built.items():
        facts["checks"][f"adjustable_{name}_matches_committed_stl"] = same_mesh(mesh, committed[name])
        mesh.export(OUT / f"print_{name}.stl")


def constants(module, names):
    return {name: getattr(module, name) for name in names}


def stl_facts():
    """The real bytes of the committed STL, for the file format scene."""
    data = (REPO / "ring_camera_wedge.stl").read_bytes()
    count = struct.unpack_from("<I", data, 80)[0]
    triangles = []
    for i in range(3):
        values = struct.unpack_from("<12f", data, 84 + 50 * i)
        triangles.append({"normal": values[:3], "vertices": [values[3:6], values[6:9], values[9:12]]})
    return {"bytes": len(data), "triangles": count, "header": data[:80].hex(),
            "first_bytes": data[80:84 + 50 * 8].hex(), "first_triangles": triangles}


def repo_facts():
    tracked = subprocess.run(["git", "ls-files"], cwd=REPO, capture_output=True, text=True, check=True).stdout.split()
    files = [{"name": name, "bytes": (REPO / name).stat().st_size} for name in tracked
             if not name.startswith("video/")]
    log = subprocess.run(["git", "log", "--no-merges", "--reverse", "--format=%h|%s"],
                         cwd=REPO, capture_output=True, text=True, check=True).stdout.splitlines()
    source = {}
    for name in "ring_camera_wedge.py", "ring_camera_wedge_adjustable.py":
        source[name] = (REPO / name).read_text()
    stls = {name: (REPO / name).stat().st_size for name in tracked if name.endswith(".stl")}
    return {"files": files, "commits": [dict(zip(("hash", "subject"), row.split("|", 1))) for row in log],
            "source": source, "stl_triangles": {name: (size - 84) // 50 for name, size in stls.items()}}


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    facts = {"checks": {}}
    export_fixed_stages(facts)
    export_angle_sweep(facts)
    export_adjustable(facts)
    facts["fixed"] = constants(fixed, [
        "HEIGHT", "FACE_WIDTH", "ANGLE_DEG", "THICK_SIDE", "POCKET_WIDTH", "POCKET_Z", "POCKET_BACK_X",
        "CABLE_OFFSET", "CABLE_Z", "CABLE_RISE_DEG", "WEEP_OFFSET", "WEEP_BEHIND_FACE", "POCKET_SEAL_MARGIN",
        "POCKET_SEAL_CORNER_R", "CABLE_SEAL_R", "SCREW_SEAL_R", "SCREW_X", "SCREW_SPACING", "CAMERA_HOLE_SPACING",
        "SEAL_GROOVE_DEPTH", "SEAL_GROOVE_WIDTH", "SECTIONS",
    ])
    facts["adjustable"] = constants(adjustable, [
        "AXIS_X", "AXIS_Y", "DRUM_R", "DRUM_Z", "TOOTH_STEP_DEG", "TOOTH_HEIGHT", "TOOTH_RADII", "UPPER_FACE_GAP",
        "MAX_ANGLE_DEG", "CHEEK_Z", "CLAMP_SCREW_LENGTH", "NUT_SEAT_FROM_HEAD", "NUT_SLOT_THICKNESS",
        "NUT_ACROSS_FLATS", "PLATE_FRONT", "DRAIN_DEG", "DRAIN_R",
    ])
    facts["stl"] = stl_facts()
    facts["repo"] = repo_facts()
    (OUT / "facts.json").write_text(json.dumps(facts, indent=1))

    for name, passed in facts["checks"].items():
        print(f"{'ok  ' if passed else 'FAIL'} {name}")
    print("stages:", [(s["label"], s["line"], s["faces"]) for s in facts["stages"]])
    print("sweep seconds:", [s["seconds"] for s in facts["sweep"]])
    print(facts["sweep"][12]["output"])
    print("triangles:", facts["repo"]["stl_triangles"])
    print("commits:", facts["repo"]["commits"])
    if not all(facts["checks"].values()):
        sys.exit(1)
