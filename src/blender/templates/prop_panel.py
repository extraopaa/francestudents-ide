"""Panneau UI 3D prêt pour Roblox : cadre, fond et zone de contenu.

Usage :
    blender --background --python src/blender/templates/prop_panel.py -- --name Panneau --output build/models --render build/preview/panneau.png

Budget : ~60 triangles. Le panneau est plat (épaisseur faible) et centré sur l'origine,
ce qui simplifie son placement sur un SurfaceGui ou un BillboardGui Roblox.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import blender_common as bc  # noqa: E402


def main():
    args = bc.parse_args("Panneau UI Roblox")
    bc.reset_scene()

    unit = bc.studs(1.0) * args.scale
    width = unit * 6.0
    height = unit * 3.0
    thickness = unit * 0.18

    frame = bc.box(f"{args.name}_Cadre", width, thickness, height, (0, 0, 0))
    inner = bc.box(f"{args.name}_Fond", width * 0.9, thickness * 1.1, height * 0.84, (0, 0, unit * 0.15))
    foot_left = bc.box(f"{args.name}_PiedG", unit * 0.3, unit * 0.6, unit * 0.4, (-width * 0.3, 0, -unit * 0.4))
    foot_right = bc.box(f"{args.name}_PiedD", unit * 0.3, unit * 0.6, unit * 0.4, (width * 0.3, 0, -unit * 0.4))

    panel = bc.join([frame, inner, foot_left, foot_right], args.name)
    bc.finish(panel, args, material_color=(0.15, 0.35, 0.75, 1.0))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(f"ERREUR: {error}", file=sys.stderr)
        sys.exit(1)
