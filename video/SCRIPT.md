# Video script

Generated from `narration.json` by `make_audio.py`. Running time 204 s.

## 0:00 Title

**Picture:** Dark studio. The finished wedge turns under rim light as the title resolves.

## 0:04 The sketch

**Picture:** The real scan lies on a dark desk. Written dimensions light up, then the two question marks. The camera descends to the plan view, an amber outline traces it, and the real block rises straight out of the paper.

> This is where it started. One sheet of paper, one pencil, and a Ring camera that needs aiming.

> Most of the sizes are written down. But two of them are just question marks: the angle, and the depth of the pocket.

> Those gaps were filled with estimates, scaled from the drawing itself: 8°, and a pocket about 11–15 mm deep.

> And this outline on the page is the exact footprint of the part.

## 0:30 The code

**Picture:** The actual source scrolls beside the block. Constants light up as their dimensions appear on the model.

> There's no CAD file here. The whole model is under two hundred lines of Python.

> Every dimension is a constant at the top, so the design reads like a spec sheet.

> The build starts with one solid block, then cuts features out of it, one at a time.

## 0:45 Carving the block

**Picture:** The script's real cutters, captured from its real boolean call, slide into the block one at a time while the matching source line highlights and the face count climbs.

> First, the electrical pocket behind the camera.

> A groove around it holds a gasket.

> A weep hole lets trapped water out of the bottom.

> The cable hole climbs five degrees toward the pocket, so water runs back out.

> Two small holes take the camera screws.

> And two countersunk holes fix the block to its mounting surface.

> This isn't a mock-up. These are the script's own cutters, taken from its own boolean operation.

## 1:10 One number

**Picture:** A terminal types the real command and prints the real output. The wedge snaps to each new angle, then sweeps 0 to 20 degrees through 21 meshes the script generated, with a stand-in camera's view swinging as it goes.

> Here's where code really pays off. The angle is just an argument.

> Run it with a different number, and you get a different part, in under a second.

> Zero degrees to twenty. Every step of this sweep is a mesh the script really generated.

## 1:23 The STL

**Picture:** Solid dissolves to wireframe, then shatters into its real triangles and reassembles. A hex dump of the committed file decodes the first triangle, and that exact triangle lights up on the model.

> The output is an STL file: a simple list of triangles, in millimeters.

> This one holds 8,682 of them.

> Each triangle takes fifty bytes: a direction, three corners, and two spare bytes. Those are the real first bytes of the file, and that's the triangle they describe.

> Tinkercad and your slicer can both read it directly.

## 1:45 Weather sealing

**Picture:** The block turns to glass in the rain. Seals fly into their real grooves. Water runs back out of the rising cable hole and drips through the weep hole.

> Outdoors, the hard part is water.

> So the design adds a gasket at the camera, and O-rings at the cable and the screws.

> Water that still gets in has a way out, down through the weep hole.

> To be clear, none of this has been tested, so it has no waterproof rating. And it only works if you print and assemble it as the README describes.

## 2:05 The adjustable version

**Picture:** The wedge splits into base and head. Close-up of the real teeth with a schematic of the mesh. X-ray shows the clamp and pivot screws. The head lifts, turns and drops through all six positions, then the one-piece wedge returns.

> But what if you don't know the angle yet?

> The adjustable version splits the wedge in two: a base that stays put, and a head that swivels between two cheeks.

> Teeth on the head and the lower cheek lock the angle, so it holds even if the plastic relaxes over time.

> A clamp screw underneath holds those teeth together, and you can reach it with the camera fitted, so you can watch the live view as you adjust.

> Loosen it, lift the head about 0.7 mm, turn it, and let the teeth drop back in.

> That gives six positions, from 0° to 20°, in 4° steps.

> Once you've found the right angle, generate the stronger one-piece wedge at that exact number.

## 2:44 Print it

**Picture:** Base and head build up layer by layer on a print bed, in the orientation the STLs are saved in, with a glowing layer line and a moving nozzle.

> Both adjustable parts are already laid out for printing. The base on its back, and the head on its camera face, with supports inside the pocket.

> For outdoor use, ASA is the best choice, with at least five walls, because extra walls do more to stop leaks than extra infill.

> Print a test set first, and check that the teeth mesh at every step.

## 3:04 The whole repo

**Picture:** The real file list and commit history beside both parts on a turntable, resolving to the end card with the repo address.

> So that's the whole repo. One scanned sketch, two Python scripts, and four STL files, all generated from code.

> Change a number. Run the script. Print the part.

> From a pencil line to a printable part. That's the Ring camera wedge.
