"""Tuile de terrain modulaire prêt pour Roblox : 4 studs × 4 studs, relief léger.

Usage :
    blender --background --python src/blender/templates/tile_ground.py -- --name Sol --output build/models --render build/preview/sol.png

Les dimensions collent à la grille Roblox (4 studs) pour que les tuiles se juxtaposent
sans trou. Modifie --scale pour agrandir la tuile par multiples entiers uniquement.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import blender_common as bc  # noqa: E402


def main():
    args = bc.parse_args("Tuile de terrain Roblox")
    bc.reset_scene()

    unit = bc.studs(1.0) * args.scale
    tile = bc.box(f"{args.name}_Base", unit * 4.0, unit * 4.0, unit * 0.4, (0, 0, 0))
    bump_a = bc.box(f"{args.name}_ReliefA", unit * 1.2, unit * 1.2, unit * 0.25, (-unit * 0.8, -unit * 0.6, unit * 0.4))
    bump_b = bc.box(f"{args.name}_ReliefB", unit * 0.9, unit * 0.9, unit * 0.18, (unit * 1.0, unit * 0.9, unit * 0.4))

    ground = bc.join([tile, bump_a, bump_b], args.name)
    bc.finish(ground, args, material_color=(0.30, 0.42, 0.24, 1.0))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(f"ERREUR: {error}", file=sys.stderr)
        sys.exit(1)
