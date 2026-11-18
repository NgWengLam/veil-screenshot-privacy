"""Package source and installable output; deliberately excludes user/test artifacts."""
import json
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
version = json.loads((root / "manifest.json").read_text())["version"]
destination = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root.parent
destination.mkdir(parents=True, exist_ok=True)
archive = destination / f"veil-screenshot-privacy-v{version}.zip"
allowed = ["README.md", "package.json", "package-lock.json", "THIRD_PARTY_NOTICES.md", "manifest.json", ".gitignore", ".github",
           "docs", "src", "public", "scripts", "tests", "dist", "dist-firefox"]
if not (root / "dist" / "manifest.json").exists():
    raise SystemExit("Run npm run verify before packaging.")

with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as output:
    for name in allowed:
        entry = root / name
        files = sorted(entry.rglob("*")) if entry.is_dir() else [entry]
        for file in files:
            if file.is_symlink():
                raise SystemExit(f"Refusing symbolic link: {file}")
            if not file.is_file() or "__pycache__" in file.parts:
                continue
            relative = Path("screenshot-privacy") / file.relative_to(root)
            info = zipfile.ZipInfo(relative.as_posix(), date_time=(2026, 10, 15, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            output.writestr(info, file.read_bytes())
with zipfile.ZipFile(archive) as output:
    if output.testzip() is not None:
        raise SystemExit("Archive integrity check failed.")
print(f"Created {archive.name}: {archive.stat().st_size:,} bytes")
