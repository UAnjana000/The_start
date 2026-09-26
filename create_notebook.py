"""Build mesh_simulation.ipynb from the percent-format cells in run_simulation.py."""
import json
from pathlib import Path

SOURCE = Path("run_simulation.py")
OUTPUT = Path("mesh_simulation.ipynb")


def cells_from_percent_script(text):
    lines = text.splitlines()
    cells = []
    kind = None
    buf = []

    def flush():
        if kind is None:
            return
        if kind == "markdown":
            md = []
            for line in buf:
                if line.startswith("# "):
                    md.append(line[2:])
                elif line == "#":
                    md.append("")
                else:
                    md.append(line)
            source = "\n".join(md).strip("\n")
            if source:
                cells.append({
                    "cell_type": "markdown",
                    "metadata": {},
                    "source": source.splitlines(keepends=True),
                })
        else:
            source = "\n".join(buf).strip("\n")
            if source:
                cells.append({
                    "cell_type": "code",
                    "execution_count": None,
                    "metadata": {},
                    "outputs": [],
                    "source": source.splitlines(keepends=True),
                })

    for line in lines:
        if line.startswith("# %%"):
            flush()
            buf = []
            kind = "markdown" if "markdown" in line else "code"
            continue
        buf.append(line)
    flush()
    return cells


def main():
    notebook = {
        "nbformat": 4,
        "nbformat_minor": 5,
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "pygments_lexer": "ipython3"},
        },
        "cells": cells_from_percent_script(SOURCE.read_text(encoding="utf-8")),
    }
    OUTPUT.write_text(json.dumps(notebook, indent=1), encoding="utf-8")
    print(f"Wrote {OUTPUT} with {len(notebook['cells'])} cells")


if __name__ == "__main__":
    main()
