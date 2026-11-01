"""Joins the rendered frames into the finished MP4.

By default this makes the silent version for uploading to GitHub, which allows 10 MB
per video on a free plan. The narration is still shown, because the captions are part
of the picture. Add --voiced for the full-quality version with voice, music and effects.

Usage:    python video/encode.py [--voiced]   (from the virtual environment)
"""
import argparse
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg

VIDEO = Path(__file__).resolve().parent
BUILD = VIDEO / "build"
GITHUB_OUTPUT = VIDEO / "ring_camera_wedge_explainer.mp4"
VOICED_OUTPUT = BUILD / "ring_camera_wedge_explainer_voiced.mp4"
GITHUB_TARGET_BYTES = 9_400_000  # leaves room for the container, under the 10 MB limit
GITHUB_FPS = 24

# The source frames are full-range JPEGs; players expect limited-range BT.709
COLOUR = "scale={size}in_range=pc:out_range=tv:out_color_matrix=bt709:flags=lanczos,format=yuv420p"
TAGS = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]


def run(*args):
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-stats", *args], check=True)


def encode_voiced(frames, fps):
    run("-framerate", str(fps), "-i", frames, "-i", str(BUILD / "audio.wav"),
        "-vf", COLOUR.format(size=""), *TAGS,
        "-c:v", "libx264", "-preset", "veryslow", "-crf", "28", "-tune", "animation",
        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(VOICED_OUTPUT))
    return VOICED_OUTPUT


def encode_for_github(frames, fps, duration):
    """Two passes, because this version has to hit a size rather than a quality."""
    bitrate = f"{int(GITHUB_TARGET_BYTES * 8 / duration / 1000)}k"
    log = str(BUILD / "pass")
    common = ["-framerate", str(fps), "-i", frames, "-an",
              "-vf", f"fps={GITHUB_FPS}," + COLOUR.format(size="w=1280:h=720:"), *TAGS,
              "-c:v", "libx264", "-preset", "veryslow", "-tune", "animation", "-b:v", bitrate,
              "-maxrate", "1500k", "-bufsize", "3000k", "-passlogfile", log]
    run(*common, "-pass", "1", "-f", "null", "-")
    run(*common, "-pass", "2", "-movflags", "+faststart", str(GITHUB_OUTPUT))
    return GITHUB_OUTPUT


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--voiced", action="store_true")
    args = parser.parse_args()
    timeline = json.loads((BUILD / "timeline.json").read_text(encoding="utf-8"))
    expected = int(timeline["duration"] * timeline["fps"] + 0.999)
    found = len(list((BUILD / "frames").glob("*.jpg")))
    if found != expected:
        raise SystemExit(f"found {found} frames, expected {expected}: finish the render first")
    frames = str(BUILD / "frames" / "%06d.jpg")
    if args.voiced:
        output = encode_voiced(frames, timeline["fps"])
    else:
        output = encode_for_github(frames, timeline["fps"], timeline["duration"])
    print(f"{output}: {output.stat().st_size / 1e6:.2f} MB")
