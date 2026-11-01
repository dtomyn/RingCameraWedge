"""Turns narration.json into timed voice lines, music, sound effects and the final mix.

Writes build/timeline.json (which the renderer follows), build/audio.wav and SCRIPT.md.

Usage:    python video/make_audio.py   (from the virtual environment)
"""
import hashlib
import json
import wave
from pathlib import Path

import numpy as np
from piper import PiperVoice, SynthesisConfig

VIDEO = Path(__file__).resolve().parent
BUILD = VIDEO / "build"
RATE = 48000
LINE_GAP = 0.45
VOICE_LENGTH_SCALE = 1.04  # slightly slower than the model's default


def read_wav(path):
    with wave.open(str(path)) as f:
        data = np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        source_rate = f.getframerate()
    n = int(len(data) * RATE / source_rate)
    return np.interp(np.linspace(0, len(data) - 1, n), np.arange(len(data)), data)


def voice_line(voice, text):
    """Synthesised once, so that editing one line doesn't redo the others."""
    key = hashlib.sha1(f"{text}|{VOICE_LENGTH_SCALE}".encode()).hexdigest()[:16]
    path = BUILD / "lines" / f"{key}.wav"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(path), "wb") as f:
            voice.synthesize_wav(text, f, syn_config=SynthesisConfig(length_scale=VOICE_LENGTH_SCALE))
    audio = read_wav(path)
    # Trim the model's silence so that gaps come only from the timeline
    loud = np.flatnonzero(np.abs(audio) > 0.01)
    audio = audio[max(0, loud[0] - 1200):loud[-1] + 2400]
    return audio * (0.8 / np.abs(audio).max())


def tone(freq, seconds, partials=(1, 0.5, 0.25, 0.12), detune=0.0):
    t = np.arange(int(seconds * RATE)) / RATE
    out = np.zeros_like(t)
    for i, amp in enumerate(partials, 1):
        out += amp * np.sin(2 * np.pi * freq * i * t * (1 + detune))
    return out


def lowpass(signal, cutoff):
    alpha = 1 - np.exp(-2 * np.pi * cutoff / RATE)
    out = np.zeros_like(signal)
    state = 0.0
    for i, x in enumerate(signal):
        state += alpha * (x - state)
        out[i] = state
    return out


def smooth(signal, width):
    """Centred moving average."""
    total = np.concatenate(((0.0,), np.cumsum(signal)))
    low = np.clip(np.arange(len(signal)) - width // 2, 0, len(signal))
    high = np.clip(low + width, 0, len(signal))
    return (total[high] - total[low]) / width


def music(duration):
    """A slow ambient pad with sparse plucks and a soft pulse, all synthesised."""
    chords = [(146.83, 220.0, 293.66, 349.23), (116.54, 233.08, 293.66, 349.23),
              (130.81, 196.0, 261.63, 329.63), (110.0, 220.0, 277.18, 329.63)]
    bar = 5.0
    length = int(duration * RATE) + RATE * 4
    out = np.zeros(length)
    rng = np.random.default_rng(7)

    def place(signal, at):
        end = min(at + len(signal), length)
        if at < length:
            out[at:end] += signal[:end - at]

    for index in range(int(duration / bar) + 1):
        start = int(index * bar * RATE)
        chord = chords[index % len(chords)]
        seconds = bar + 2.5
        n = int(seconds * RATE)
        env = np.minimum(np.linspace(0, 1, n) * 3, 1) * np.minimum(np.linspace(1, 0, n) * 3, 1)
        pad = sum(tone(f, seconds, (1, 0.35, 0.12), d) for f in chord for d in (-0.0015, 0.0015))
        place(pad * env * 0.05, start)
        for step in range(8):
            if rng.random() < 0.45:
                f = chord[rng.integers(1, 4)] * 2
                pluck = tone(f, 1.6, (1, 0.2)) * np.exp(-np.arange(int(1.6 * RATE)) / RATE * 3.2)
                place(pluck * 0.035, start + int(step * bar / 8 * RATE))
        for beat in 0, 2.5:
            pulse = tone(chord[0] / 2, 0.9, (1,)) * np.exp(-np.arange(int(0.9 * RATE)) / RATE * 5)
            place(pulse * 0.08, start + int(beat * RATE))
    delay = int(0.46 * RATE)
    for _ in range(3):
        out[delay:] += out[:-delay] * 0.28
    return out[:int(duration * RATE)]


def sfx_whoosh(seconds=1.3):
    n = int(seconds * RATE)
    noise = lowpass(np.random.default_rng(3).normal(size=n), 1800)
    return noise * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.5


def sfx_cut():
    n = int(0.45 * RATE)
    t = np.arange(n) / RATE
    thud = np.sin(2 * np.pi * (70 + 90 * np.exp(-t * 30)) * t) * np.exp(-t * 11)
    hiss = lowpass(np.random.default_rng(5).normal(size=n), 5000) * np.exp(-t * 24) * 0.3
    return (thud + hiss) * 0.42


def sfx_tick():
    t = np.arange(int(0.12 * RATE)) / RATE
    return (np.sin(2 * np.pi * 1900 * t) * 0.5 + np.sin(2 * np.pi * 620 * t)) * np.exp(-t * 70) * 0.4


def add(track, signal, at):
    start = int(at * RATE)
    end = min(start + len(signal), len(track))
    if start < len(track):
        track[start:end] += signal[:end - start]


def build_timeline(voice, narration):
    clock, scenes, placed = 0.0, [], []
    for scene in narration["scenes"]:
        start = clock
        clock += scene["lead"]
        lines = []
        for index, line in enumerate(scene["lines"]):
            if index:
                clock += LINE_GAP
            audio = voice_line(voice, line["say"])
            seconds = len(audio) / RATE
            lines.append({"start": round(clock, 3), "end": round(clock + seconds, 3),
                          "caption": line.get("cap", line["say"]), "sfx": line.get("sfx", [])})
            placed.append((audio, clock, line.get("sfx", [])))
            clock += seconds
        clock += scene["tail"]
        scenes.append({"id": scene["id"], "title": scene["title"], "start": round(start, 3),
                       "end": round(clock, 3), "lines": lines})
    return {"fps": narration["fps"], "duration": round(clock, 3), "scenes": scenes}, placed


def mix(timeline, placed):
    n = int(timeline["duration"] * RATE)
    voice, effects = np.zeros(n), np.zeros(n)
    for audio, at, sfx in placed:
        add(voice, audio, at)
        for effect in sfx:
            when = at + effect["at"]
            if effect["type"] == "whoosh":
                add(effects, sfx_whoosh(), when)
            elif effect["type"] == "cut":
                add(effects, sfx_cut(), when)
            elif effect["type"] == "ticks":
                for i in range(effect["count"]):
                    add(effects, sfx_tick(), when + i * effect["spread"] / (effect["count"] - 1))

    backing = music(timeline["duration"])
    backing *= 0.55 / max(np.abs(backing).max(), 1e-6)
    # Duck the music under the voice, with a smooth envelope
    speaking = np.clip(smooth((np.abs(voice) > 0.01).astype(np.float64), RATE // 4) * 4, 0, 1)
    duck = 1 - 0.72 * np.clip(smooth(smooth(speaking, RATE // 4), RATE // 4), 0, 1)
    # Fade in, and out over the end card
    fade = np.minimum(np.linspace(0, 1, n) * timeline["duration"] / 1.5, 1)
    fade *= np.minimum(np.linspace(1, 0, n) * timeline["duration"] / 3.5, 1)
    out = voice + backing * duck * fade + effects
    peak = np.abs(out).max()
    if peak > 0.98:
        out *= 0.98 / peak

    def rms(signal, mask):
        return 20 * np.log10(np.sqrt(np.mean(signal[mask] ** 2)) + 1e-9)

    active = np.abs(voice) > 0.01
    print(f"peak {20 * np.log10(np.abs(out).max()):.1f} dB, voice {rms(voice, active):.1f} dB RMS, "
          f"music under voice {rms(backing * duck * fade, active):.1f} dB RMS, "
          f"music alone {rms(backing * fade, ~active):.1f} dB RMS")
    with wave.open(str(BUILD / "audio.wav"), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes((out * 32767).astype(np.int16).tobytes())


def write_script(narration, timeline):
    out = ["# Video script", "",
           f"Generated from `narration.json` by `make_audio.py`. Running time {timeline['duration']:.0f} s.", ""]
    for scene, timed in zip(narration["scenes"], timeline["scenes"]):
        minutes, seconds = divmod(int(timed["start"]), 60)
        out += [f"## {minutes}:{seconds:02d} {scene['title']}", "", f"**Picture:** {scene['visual']}", ""]
        for line in timed["lines"]:
            out += [f"> {line['caption']}", ""]
    (VIDEO / "SCRIPT.md").write_text("\n".join(out), encoding="utf-8")


if __name__ == "__main__":
    narration = json.loads((VIDEO / "narration.json").read_text(encoding="utf-8"))
    voice = PiperVoice.load(str(BUILD / "voice" / "en_US-ryan-high.onnx"))
    timeline, placed = build_timeline(voice, narration)
    (BUILD / "timeline.json").write_text(json.dumps(timeline, indent=1), encoding="utf-8")
    mix(timeline, placed)
    write_script(narration, timeline)
    print(f"duration {timeline['duration']:.1f} s")
    for scene in timeline["scenes"]:
        print(f"  {scene['start']:7.2f}  {scene['id']}")
