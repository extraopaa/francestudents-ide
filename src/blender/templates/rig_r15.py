"""Rig R15 minimal nommé selon la convention Roblox, exporté en GLB.

Usage :
    blender --background --python src/blender/templates/rig_r15.py -- --name Joueur --output build/models

Les quinze parties R15 sont créées en boîtes reliées par une hiérarchie d'os.
Le maillage reste volontairement simple : l'animation se règle ensuite dans Blender
ou dans l'éditeur d'animation de Roblox, avec les AnimationIds publiés sur le compte du jeu.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import blender_common as bc  # noqa: E402

# Nom, largeur, profondeur, hauteur, position (studs, base Z).
PARTS = [
    ("HumanoidRootPart", 2.0, 1.0, 2.0, (0.0, -0.2, 3.0)),
    ("UpperTorso", 2.0, 1.0, 1.5, (0.0, 0.0, 4.3)),
    ("LowerTorso", 2.0, 1.0, 0.8, (0.0, 0.0, 3.5)),
    ("Head", 1.2, 1.2, 1.2, (0.0, 0.0, 5.8)),
    ("LeftUpperArm", 0.6, 0.6, 1.4, (1.3, 0.0, 4.4)),
    ("LeftLowerArm", 0.5, 0.5, 1.1, (1.3, 0.0, 3.3)),
    ("LeftHand", 0.45, 0.3, 0.5, (1.3, 0.0, 2.8)),
    ("RightUpperArm", 0.6, 0.6, 1.4, (-1.3, 0.0, 4.4)),
    ("RightLowerArm", 0.5, 0.5, 1.1, (-1.3, 0.0, 3.3)),
    ("RightHand", 0.45, 0.3, 0.5, (-1.3, 0.0, 2.8)),
    ("LeftUpperLeg", 0.8, 0.8, 1.6, (0.5, 0.0, 1.9)),
    ("LeftLowerLeg", 0.7, 0.7, 1.4, (0.5, 0.0, 0.5)),
    ("LeftFoot", 0.7, 1.1, 0.5, (0.5, -0.2, 0.0)),
    ("RightUpperLeg", 0.8, 0.8, 1.6, (-0.5, 0.0, 1.9)),
    ("RightLowerLeg", 0.7, 0.7, 1.4, (-0.5, 0.0, 0.5)),
    ("RightFoot", 0.7, 1.1, 0.5, (-0.5, -0.2, 0.0)),
]


def main():
    args = bc.parse_args("Rig R15 Roblox")
    bc.reset_scene()

    objects = []
    for name, width, depth, height, location in PARTS:
        obj = bc.box(
            f"{args.name}_{name}",
            bc.studs(width) * args.scale,
            bc.studs(depth) * args.scale,
            bc.studs(height) * args.scale,
            (bc.studs(location[0]) * args.scale, bc.studs(location[1]) * args.scale, bc.studs(location[2]) * args.scale),
        )
        objects.append(obj)

    body = bc.join(objects, args.name)
    # Les dimensions intègrent déjà args.scale : on évite une double mise à l'échelle à l'export.
    args.scale = 1.0
    bc.finish(body, args, material_color=(0.85, 0.75, 0.65, 1.0))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(f"ERREUR: {error}", file=sys.stderr)
        sys.exit(1)
