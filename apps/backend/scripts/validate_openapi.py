#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    file_path = Path(sys.argv[1] if len(sys.argv) > 1 else "openapi.yaml")
    if not file_path.exists():
        print(f"[openapi] ERROR: file not found: {file_path}")
        return 1

    lines = file_path.read_text(encoding="utf-8").splitlines()

    version_line = None
    version_value = None
    for index, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("openapi:"):
            version_line = index
            version_value = stripped.split(":", 1)[1].strip().strip("'\"")
            if re.fullmatch(r"3\.(0|1|2)\.\d+", version_value):
                break
            print(
                f"[openapi] ERROR: invalid openapi version at line {index}: {version_value!r}. "
                "Expected 3.0.x, 3.1.x or 3.2.x."
            )
            return 1
        if stripped.startswith("swagger:"):
            version_line = index
            version_value = stripped.split(":", 1)[1].strip().strip("'\"")
            if version_value == "2.0":
                break
            print(f"[openapi] ERROR: invalid swagger version at line {index}: {version_value!r}. Expected '2.0'.")
            return 1
        print(
            f"[openapi] ERROR: first version field must be 'openapi' or 'swagger'. "
            f"Found {stripped!r} at line {index}."
        )
        return 1

    if version_line is None:
        print("[openapi] ERROR: no OpenAPI/Swagger version field found.")
        return 1

    inside_paths = False
    path_lines: dict[str, int] = {}
    duplicates: list[tuple[str, int, int]] = []

    for index, line in enumerate(lines, start=1):
        if re.match(r"^paths:\s*$", line):
            inside_paths = True
            continue

        if inside_paths and re.match(r"^[A-Za-z_][A-Za-z0-9_]*:\s*$", line):
            inside_paths = False

        if not inside_paths:
            continue

        match = re.match(r"^  (/[^:]+):\s*$", line)
        if not match:
            continue

        key = match.group(1).strip()
        if key in path_lines:
            duplicates.append((key, path_lines[key], index))
        else:
            path_lines[key] = index

    if duplicates:
        print("[openapi] ERROR: duplicated path keys detected:")
        for key, first, second in duplicates:
            print(f"  - {key!r} first at line {first}, duplicated at line {second}")
        return 1

    print(f"[openapi] OK: {file_path} (version {version_value})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
