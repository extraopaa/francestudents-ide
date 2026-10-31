"""Prop low-poly multi-couleurs : démontre la palette et les outils de géométrie.

Usage :
    blender --background --python src/blender/templates/prop_palette.py -- --name Caisse --output build/models --render build/preview/caisse.png

Contenu : biseau sur chaque arête, deux couleurs (bois et métal), un creux booléen et un
rocher bruité en accent. Copie ce fichier pour un autre prop et remplace la section
« Recette » : la chaîne finish(), l'export et le rendu quatre angles restent les mêmes.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import blender_common as bc  # noqa: E402


def recette_caisse(args, unit, colors):
    """Caisse avec biseaux, renforts métalliques et un rocher d'accent."""
    body = bc.box(f"{args.name}_Corps", unit * 1.4, unit * 1.0, unit * 0.9, (0, 0, 0))
    bc.bevel(body, width=unit * 0.05, segments=1)
    bc.assign_material(body, colors["bois"])

    # Renforts : plus fins, en métal, sur les deux grands côtés.
    bands = []
    for side in (-1, 1):
        band = bc.box(f"{args.name}_Renfort{side}", unit * 0.1, unit * 1.06, unit * 0.94,
                      (unit * 0.5 * side, 0, 0))
        bc.bevel(band, width=unit * 0.02, segments=1)
        bands.append(band)
    couvercle = bc.box(f"{args.name}_Couvercle", unit * 1.46, unit * 1.06, unit * 0.12,
                       (0, 0, unit * 0.9))
    bc.bevel(couvercle, width=unit * 0.03, segments=1)
    bands.append(couvercle)
    bc.assign_palette({"metal": bands}, colors)

    # Rocher d'accent : sphère aplatie bruitée, posée à côté de la caisse.
    rock = bc.sphere(f"{args.name}_Rocher", unit * 0.35, segments=8, rings=5,
                     location=(unit * 1.05, unit * 0.15, 0), squash=(1.0, 0.85, 0.65))
    bc.noise(rock, strength=unit * 0.03, scale=1.0, seed=7)
    bc.assign_material(rock, colors["pierre"])

    prop = bc.join([body, *bands, rock], args.name)
    return prop, list(colors.values())


def main():
    args = bc.parse_args("Prop low-poly multi-couleurs, FranceStudent Code Roblox")
    bc.reset_scene()
    unit = bc.studs(1.0) * args.scale
    colors = bc.palette(["bois", "metal", "pierre"], prefix=f"{args.name}_")

    prop, materials = recette_caisse(args, unit, colors)
    bc.finish(prop, args, materials=materials)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 - un script Blender doit sortir en erreur explicite
        print(f"ERREUR: {error}", file=sys.stderr)
        sys.exit(1)
