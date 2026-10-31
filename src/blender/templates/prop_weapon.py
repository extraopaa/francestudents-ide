"""Arme simple prêt pour Roblox : manche, garde et lame, proportions paramétrables.

Usage :
    blender --background --python src/blender/templates/prop_weapon.py -- --name Epée --output build/models --render build/preview/epee.png

Budget : ~150 triangles. Origine au pommeau, lame vers +Z (axe Y de Roblox après export).
Décale --scale pour la longueur totale en studs (1 = épée courte, 1.5 = grande épée).
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import blender_common as bc  # noqa: E402


def main():
    args = bc.parse_args("Arme simple Roblox")
    bc.reset_scene()

    unit = bc.studs(1.0) * args.scale
    handle = bc.box(f"{args.name}_Manche", unit * 0.12, unit * 0.12, unit * 0.7, (0, 0, 0))
    guard = bc.box(f"{args.name}_Garde", unit * 0.62, unit * 0.14, unit * 0.10, (0, 0, unit * 0.7))
    blade = bc.box(f"{args.name}_Lame", unit * 0.16, unit * 0.05, unit * 2.2, (0, 0, unit * 0.8))
    tip = bc.box(f"{args.name}_Pointe", unit * 0.16, unit * 0.05, unit * 0.22, (0, 0, unit * 3.0))

    weapon = bc.join([handle, guard, blade, tip], args.name)
    bc.finish(weapon, args, material_color=(0.62, 0.64, 0.68, 1.0))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(f"ERREUR: {error}", file=sys.stderr)
        sys.exit(1)
