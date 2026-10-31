"""Arbre low-poly prêt pour Roblox : tronc, feuillage en plusieurs blocs.

Usage :
    blender --background --python src/blender/templates/prop_tree.py -- --name Arbre --output build/models --render build/preview/arbre.png

Budget : ~300 triangles, une seule couleur de feuillage, origine à la base du tronc.
Idéal pour un décor de map Roblox ; utilise --scale pour la hauteur en studs.
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import blender_common as bc  # noqa: E402


def main():
    args = bc.parse_args("Arbre low-poly Roblox")
    bc.reset_scene()

    unit = bc.studs(1.0) * args.scale
    height = unit * 6.0
    trunk = bc.cylinder(f"{args.name}_Tronc", unit * 0.22, height, vertices=8, location=(0, 0, 0))

    # Trois étages de feuillage : chaque bloc est plus petit et tourné pour casser la répétition.
    layers = []
    for index, (radius, depth, offset) in enumerate(((1.4, 1.6, 3.4), (1.05, 1.4, 4.6), (0.7, 1.2, 5.8))):
        layer = bc.cylinder(f"{args.name}_Feuillage{index + 1}", unit * radius, unit * depth, vertices=7,
                            location=(0, 0, unit * offset))
        layer.rotation_euler = (0, 0, math.radians(24 * index))
        layers.append(layer)

    tree = bc.join([trunk, *layers], args.name)
    bc.finish(tree, args, material_color=(0.20, 0.45, 0.20, 1.0))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(f"ERREUR: {error}", file=sys.stderr)
        sys.exit(1)
