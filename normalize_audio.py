import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

TARGET_I = -16.0
TARGET_TP = -1.5
TARGET_LRA = 11.0
MP3_BITRATE = "96k"

AUDIO_EXTS = {".mp3", ".wav"}


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe_sample_rate(path):
    r = run(["ffprobe", "-v", "error", "-select_streams", "a:0",
             "-show_entries", "stream=sample_rate",
             "-of", "default=nk=1:nw=1", str(path)])
    rate = r.stdout.strip()
    return rate if rate.isdigit() else None


def measure(path):
    af = f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}:print_format=json"
    r = run(["ffmpeg", "-hide_banner", "-nostdin", "-i", str(path),
             "-af", af, "-f", "null", "-"])
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def apply_norm(path, stats, out_path):
    rate = probe_sample_rate(path)
    af = (
        f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}"
        f":measured_I={stats['input_i']}:measured_TP={stats['input_tp']}"
        f":measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}"
        f":offset={stats['target_offset']}:linear=true:print_format=summary"
    )
    cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-y", "-i", str(path), "-af", af]
    if rate:
        cmd += ["-ar", rate]
    if path.suffix.lower() == ".mp3":
        cmd += ["-ac", "1", "-c:a", "libmp3lame", "-b:a", MP3_BITRATE]
    else:
        cmd += ["-ac", "1", "-c:a", "pcm_s16le"]
    cmd.append(str(out_path))
    return run(cmd)


def collect(targets):
    files = []
    for t in targets:
        p = Path(t)
        if p.is_file() and p.suffix.lower() in AUDIO_EXTS:
            files.append(p)
        elif p.is_dir():
            files += [f for f in sorted(p.rglob("*")) if f.suffix.lower() in AUDIO_EXTS]
        else:
            print(f"  ! skipping (not found): {t}")
    return files


def main():
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    dry_run = "--dry-run" in sys.argv[1:]
    targets = args or ["audio"]

    files = collect(targets)
    if not files:
        print("No .mp3/.wav files found under:", ", ".join(targets))
        return

    print(f"Normalizing {len(files)} file(s) to {TARGET_I} LUFS "
          f"(true peak {TARGET_TP} dBTP){' — DRY RUN' if dry_run else ''}\n")

    ok = fail = 0
    for i, f in enumerate(files, 1):
        stats = measure(f)
        before = stats["input_i"] if stats else "?"
        print(f"[{i:>3}/{len(files)}] {f.as_posix():<55} {before:>7} LUFS -> {TARGET_I}", end="")
        if dry_run:
            print("  (dry run)")
            continue
        if not stats:
            print("  ! measure failed, skipped")
            fail += 1
            continue
        with tempfile.NamedTemporaryFile(suffix=f.suffix, delete=False,
                                         dir=str(f.parent)) as tmp:
            tmp_path = Path(tmp.name)
        res = apply_norm(f, stats, tmp_path)
        if res.returncode == 0 and tmp_path.exists() and tmp_path.stat().st_size > 0:
            shutil.move(str(tmp_path), str(f))
            print("  ok")
            ok += 1
        else:
            tmp_path.unlink(missing_ok=True)
            print("  ! encode failed, kept original")
            fail += 1

    print(f"\nDone. {ok} normalized, {fail} skipped/failed.")


if __name__ == "__main__":
    main()
