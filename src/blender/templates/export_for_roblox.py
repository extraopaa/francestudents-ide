"""Export d'un fichier .blend existant vers un GLB prêt pour Roblox.

Usage :
    blender --background --python src/blender/templates/export_for_roblox.py -- --input assets/coffre.blend --output build/models --name Coffre

Nettoie la scène (transformations, normales, triangulation), retire caméras et lumières,
exporte le GLB puis écrit un manifeste JSON avec la taille en studs.
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import blender_common as bc  # noqa: E402


def argv_after_separator():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def option(argv, name, default=None):
    for index, item in enumerate(argv):
        if item == name and index + 1 < len(argv):
            return argv[index + 1]
    return default


def main():
    import bpy

    argv = argv_after_separator()
    source = option(argv, "--input")
    if not source or not os.path.isfile(source):
        raise SystemExit(f"ERREUR: --input .blend introuvable : {source}")

    output_dir = option(argv, "--output", "build/models")
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(source))

    # Caméras et lumières ne doivent pas partir dans Roblox.
    for obj in list(bpy.context.scene.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise SystemExit("ERREUR: aucun mesh dans le fichier .blend.")

    for obj in meshes:
        bc.clean(obj)
        bc.triangulate(obj)

    name = option(argv, "--name") or os.path.splitext(os.path.basename(source))[0]
    target = bc.export_glb(output_dir, name)

    low, high, _, _ = bc.scene_bounds()
    size = high - low
    manifest = {
        "name": name,
        "glb": os.path.relpath(target, os.getcwd()).replace("\\", "/"),
        "source": source.replace("\\", "/"),
        "meshes": len(meshes),
        "triangles": sum(bc.triangle_count(obj) for obj in meshes),
        "size_studs": {
            "x": round(size.x / bc.STUDS_TO_METERS, 2),
            "y": round(size.y / bc.STUDS_TO_METERS, 2),
            "z": round(size.z / bc.STUDS_TO_METERS, 2),
        },
    }
    print("EXPORT " + json.dumps(manifest))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:  # noqa: BLE001
        print(f"ERREUR: {error}", file=sys.stderr)
        sys.exit(1)
