"""Prop simple prêt pour Roblox : coffre, caisse, panneau, généré en mode --background.

Usage :
    blender --background --python src/blender/templates/prop_box.py -- --name Coffre --output build/models --render build/preview/coffre.png

Modèle : un volume principal, un couvercle, deux renforts. Origine à la base, triangles
contrôlés. Copie ce fichier et adapte les dimensions pour un autre prop.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import blender_common as bc  # noqa: E402


def main():
    args = bc.parse_args("Prop Roblox généré par FranceStudent Code Roblox")
    bc.reset_scene()

    unit = bc.studs(1.0) * args.scale
    body = bc.box(f"{args.name}_Corps", unit * 1.2, unit * 0.8, unit * 0.6, (0, 0, 0))
    lid = bc.box(f"{args.name}_Couvercle", unit * 1.26, unit * 0.86, unit * 0.14, (0, 0, unit * 0.6))
    band_left = bc.box(f"{args.name}_RenfortG", unit * 0.08, unit * 0.84, unit * 0.62, (-unit * 0.42, 0, 0))
    band_right = bc.box(f"{args.name}_RenfortD", unit * 0.08, unit * 0.84, unit * 0.62, (unit * 0.42, 0, 0))

    prop = bc.join([body, lid, band_left, band_right], args.name)
    bc.finish(prop, args, material_color=(0.45, 0.29, 0.16, 1.0))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 - un script Blender doit sortir en erreur explicite
        print(f"ERREUR: {error}", file=sys.stderr)
        sys.exit(1)
