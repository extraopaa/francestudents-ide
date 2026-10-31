"""Rendu de contrôle d'un fichier .blend ou .glb, pour vérification visuelle de l'agent.

Usage :
    blender --background --python src/blender/templates/render_preview.py -- --input build/models/Coffre.glb --render build/preview/coffre.png

Le PNG produit se consulte ensuite avec l'outil view_image : l'agent voit réellement le modèle
au lieu de supposer son apparence.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import blender_common as bc  # noqa: E402


def main():
    import bpy
    # bc.parse_args refuse --input (argument inconnu) : on lit nos deux options directement.
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    source = ""
    target = ""
    for index, item in enumerate(argv):
        if item == "--input" and index + 1 < len(argv):
            source = argv[index + 1]
        if item == "--render" and index + 1 < len(argv):
            target = argv[index + 1]
    target = target or "build/preview/preview.png"

    if source.lower().endswith(".blend"):
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(source))
    elif source:
        bc.reset_scene()
        bpy.ops.import_scene.gltf(filepath=os.path.abspath(source))
    else:
        raise SystemExit("ERREUR: --input <fichier .blend|.glb> est obligatoire.")

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise SystemExit("ERREUR: aucun mesh à rendre.")
    triangles = sum(bc.triangle_count(obj) for obj in meshes)
    print(f"STATS {{'meshes': {len(meshes)}, 'triangles': {triangles}}}")

    path = bc.render_preview(target, resolution=512)
    print(f"PREVIEW {path}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:  # noqa: BLE001
        print(f"ERREUR: {error}", file=sys.stderr)
        sys.exit(1)
