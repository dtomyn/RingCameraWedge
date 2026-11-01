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

Use this when the camera angle isn't known yet. It has two printed parts, and the camera can be set from 0° to 20° in 4° steps: 0°, 4°, 8°, 12°, 16° or 20°.

![The adjustable version at three angles](ring_camera_wedge_adjustable_preview.png)

- **Base:** fixes to the mounting surface, with the same mounting screw pattern and cable hole position as the fixed wedge.
- **Head:** carries the camera, with the same 55 × 110 mm face, camera holes and pocket. It swivels on a vertical axis between two cheeks on the base.

### How it locks

The angle is held by interlocking teeth, not just by tightness:

- **Teeth:** matching teeth on the underside of the head's drum and on the base's lower cheek mesh together. While they're meshed, the head can't turn, even if the plastic relaxes over time.
- **Clamp screw (bottom):** this pulls the head down into the teeth and keeps them meshed. Loosen it to change the angle. You can reach it with the camera fitted, so you can watch the live view as you adjust.
- **Pivot screw (top):** this is only the hinge pin. It's fixed into the upper cheek and passes loosely into the head, which is free to slide up it. There's no need to touch it when adjusting.

The head has to lift about 0.7 mm for the teeth to clear each other. There's 1.2 mm of room for this above the head.

### Parts to buy

| Quantity | Part | Used for |
|---|---|---|
| 2 | M4 × 30 mm machine screw | One clamp screw, one pivot screw |
| 1 | M4 hex nut | Clamp screw |
| 2 | M4 washer | One under each screw head |
| 2 | 4 mm countersunk screw, about 60 mm or longer | Fixing the base to the surface |

### Print

The STLs are already laid out for printing. Leave them as they are in your slicer.

- **Base:** back face on the bed, no supports needed.
- **Head:** camera face on the bed, with supports inside the pocket.

The teeth are the finest detail, at about 1–1.6 mm from tip to tip, so use a 0.4 mm nozzle or smaller and a layer height of 0.2 mm or less. PETG or ASA will last better than PLA outdoors.

Print one test set before relying on it. Check that the head swings freely when lifted and that the teeth drop fully into mesh at each step. If the fit is wrong for your printer, adjust `TOOTH_CLEARANCE` and `FIT_CLEARANCE` in the script.

### Assemble

1. Slide the nut into the slot on the side of the head's drum.
2. Fit the head between the cheeks of the base, and pass the cable through the hole in the base into the pocket.
3. Put a washer on the pivot screw and drive it down through the upper cheek into the head. It cuts its own thread in the cheek, so turn it slowly and tighten it until it's snug.
4. Put a washer on the clamp screw and insert it up through the lower cheek into the nut. Tighten it lightly.
5. Fix the base to the surface, then fit the camera to the head.

### Change the angle

1. From below, loosen the clamp screw by about two turns. The screwdriver shaft must be 7 mm or narrower.
2. Lift the head slightly and turn it to the next step. Each step is 4°.
3. Lower the head so the teeth drop into mesh. You should feel it settle, and it shouldn't turn when you nudge it.
4. Tighten the clamp screw firmly by hand. It doesn't need heavy force, because the teeth stop the head turning, and overtightening can damage the printed nut slot.

### Limits

- **Steps:** the angle can't be set between the 4° steps. The fixed wedge can be generated at any exact angle if you need one.
- **Direction:** the head turns only away from the surface the base is screwed to, as on the fixed wedge. It can't go below 0°.
- **Space needed:** the head needs room to swing. At 8° it stands 50.2 mm off the back face and extends 2.0 mm past the thin side. At 20° those become 54.9 mm and 3.8 mm. The fixed wedge is 46 mm deep.
- **Camera holes:** these are 12 mm deep rather than the fixed wedge's 17 mm, so that a screwdriver can reach the clamp screws. Check that your camera's screws fit.
- **Pocket:** this is 11 mm deep at every angle.
- **Strength:** the printed teeth hold against knocks, but they're small and have not been load tested. A hard enough blow could shear them.

### Switching to the fixed wedge

Once you've found the right angle, you can print the stronger one-piece wedge for it. With calipers, measure from the back face to each edge of the camera face. The angle is `asin((larger - smaller) / 55)`. Then generate that wedge as described under [Script options](#script-options).

To generate the adjustable parts with the assembly shown at a different step, run:

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
