# Ring camera wedge

A 3D model of an angled mounting block for a Ring camera, built from the hand sketch in `Scan_20261101.png`. A Python script generates an STL file that you can import into Tinkercad.

![Three views of the wedge](ring_camera_wedge_preview.png)

## Files

| File | Purpose |
|---|---|
| `ring_camera_wedge.stl` | The model, in millimetres |
| `ring_camera_wedge.py` | Generates the STL; all dimensions are constants at the top |
| `ring_camera_wedge_preview.png` | Picture of the default 8° model; the script does not update it |
| `requirements.txt` | Python dependencies |
| `.devcontainer/` | VS Code dev container configuration |
| `Scan_20261101.png` | The original sketch |
| `ring_camera_wedge_adjustable.py` | Generates the adjustable version |
| `ring_camera_wedge_adjustable_base.stl` | Adjustable version: base, ready to print |
| `ring_camera_wedge_adjustable_head.stl` | Adjustable version: head, ready to print |
| `ring_camera_wedge_adjustable_assembly.stl` | Adjustable version: both parts together at 8°, for viewing only |
| `ring_camera_wedge_adjustable_preview.png` | Picture of the adjustable version at 0°, 8° and 20°, and from behind at 8°; the script does not update it |

## Adjustable version

Use this when the camera angle isn't known yet. It has two printed parts, and the camera can be set anywhere from 0° to 20°.

![The adjustable version at three angles](ring_camera_wedge_adjustable_preview.png)

- **Base:** fixes to the mounting surface, with the same mounting screw pattern and cable hole position as the fixed wedge.
- **Head:** carries the camera, with the same 55 × 110 mm face, camera holes and pocket. It swivels on a vertical axis between two cheeks on the base.
- **Clamp:** two screws hold the angle by friction. They're reached from the top and bottom, so you can adjust the angle with the camera fitted and watch its live view.

### Parts to buy

| Quantity | Part | Used for |
|---|---|---|
| 2 | M4 × 30 mm machine screw | Clamp |
| 2 | M4 hex nut | Clamp |
| 2 | M4 washer | Clamp |
| 2 | 4 mm countersunk screw, about 60 mm or longer | Fixing the base to the surface |

### Print

The STLs are already laid out for printing. Leave them as they are in your slicer.

- **Base:** back face on the bed, no supports needed.
- **Head:** camera face on the bed, with supports inside the pocket.

Print one test set before relying on it. The parts are designed with 0.3 mm of clearance, which may need adjusting for your printer through `FIT_CLEARANCE` in the script.

### Assemble and adjust

1. Slide a nut into each of the two slots on the side of the head's drum.
2. Fit the head between the cheeks of the base, and pass the cable through the hole in the base into the pocket.
3. Put a washer on each clamp screw. Insert the screws through the top and bottom cheeks into the nuts, and tighten them lightly.
4. Fix the base to the surface, then fit the camera to the head.
5. Loosen the clamp screws, turn the head until the view is right, and tighten them. The screwdriver shaft must be 7 mm or narrower.

### Limits

- **Direction:** the head turns only away from the surface the base is screwed to, as on the fixed wedge. It can't go below 0°.
- **Space needed:** the head needs room to swing. At 8° it stands 50.2 mm off the back face and extends 2.0 mm past the thin side. At 20° those become 54.9 mm and 3.8 mm. The fixed wedge is 46 mm deep.
- **Camera holes:** these are 12 mm deep rather than the fixed wedge's 17 mm, so that a screwdriver can reach the clamp screws. Check that your camera's screws fit.
- **Pocket:** this is 11 mm deep at every angle.
- **Holding force:** the angle is held by friction only. Gravity doesn't turn a vertical axis, but a firm knock could shift it.

### Switching to the fixed wedge

Once you've found the right angle, you can print the stronger one-piece wedge for it. With calipers, measure from the back face to each edge of the camera face. The angle is `asin((larger - smaller) / 55)`. Then generate that wedge as described under [Script options](#script-options).

To generate the adjustable parts with the assembly at a different angle, run:

```bash
python ring_camera_wedge_adjustable.py --assembly-angle 12
```

## Import into Tinkercad

1. Open a design in Tinkercad and choose **Import**.
2. Select `ring_camera_wedge.stl`.
3. Keep the units as millimetres.

The model arrives as a single shape, so its holes can't be edited individually in Tinkercad. To change a dimension, regenerate the STL and import it again.

## Regenerate the STL

Use either a virtual environment or the dev container. Both need to be set up only once.

### Option 1: Python virtual environment

Requires Python 3.12.

**Windows (PowerShell)**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If PowerShell blocks the activation script, run this and then activate again:

```powershell
Set-ExecutionPolicy -Scope Process RemoteSigned
```

**macOS or Linux**

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Then, with the environment active, run the script:

```bash
python ring_camera_wedge.py
```

Run `deactivate` when you're finished. Next time, you only need to activate the environment again.

### Option 2: VS Code dev container

Requires Docker and the VS Code **Dev Containers** extension.

1. Start Docker.
2. Open this folder in VS Code.
3. Run **Dev Containers: Reopen in Container** from the Command Palette. The first build downloads the image and installs the dependencies.
4. Open a terminal in VS Code and run:

```bash
python ring_camera_wedge.py
```

The folder is shared with the container, so the STL appears in this folder on your computer too. The container installs the dependencies directly because it is already isolated, so it doesn't use `.venv`.

## Script options

| Option | Default | Description |
|---|---|---|
| `--angle` | `8` | Angle of the camera face, in degrees |
| `--output` | `ring_camera_wedge.stl` next to the script | Where to write the STL |

For example, to generate a 12° version under a separate name:

```bash
python ring_camera_wedge.py --angle 12 --output ring_camera_wedge_12deg.stl
```

For any other change, edit the constants at the top of `ring_camera_wedge.py`.

## Dimensions

Taken from the sketch's written dimensions:

| Feature | Size |
|---|---|
| Camera face | 55 × 110 mm |
| Camera holes | 2.25 mm, 91.5 mm apart, centred on the face |
| Electrical pocket | From 30 to 60 mm above the bottom |
| Cable hole | 8 mm |
| Block screw holes | 4 mm, with an 8 mm countersink |

Not written on the sketch, so estimated from its scale:

| Feature | Value used |
|---|---|
| Face angle (marked "?°") | 8° |
| Pocket depth (marked "Depth ?") | Back wall 29 mm from the back face, about 11–15 mm deep |
| Block thickness | 46 mm at the thick side, 38.35 mm at the thin side |
| Pocket width | 34 mm, centred on the face |
| Camera hole depth | 17 mm |
| Cable hole position | 35 mm above the bottom, about 10 mm from the centreline towards the thick side |
| Block screw holes | 65 mm apart, centred on the height, 20 mm from the back face |

The block is about 54 mm across at the screw holes, so the screws need to be about 60 mm or longer to reach the surface behind it.
