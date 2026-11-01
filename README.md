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
