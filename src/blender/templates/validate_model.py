"""Contrôles qualité Blender d'un modèle destiné à Roblox.

Usage :
    blender --background --python src/blender/templates/validate_model.py -- --input build/models/Coffre.glb --max-triangles 10000

Lit le fichier (.glb ou .blend), puis vérifie ce qu'un simple en-tête GLB ne peut pas voir :
triangles par mesh, UV, normales, mesh non-manifold, transformations non appliquées,
taille en studs et textures trop grandes. Écrit une ligne VALIDATE {...} lisible par l'outil blender.
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import blender_common as bc  # noqa: E402

MAX_TRIANGLES_PER_MESH = 10000
MAX_TEXTURE = 1024


def argv_after_separator():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def option(argv, name, default=None):
    for index, item in enumerate(argv):
        if item == name and index + 1 < len(argv):
            return argv[index + 1]
    return default


def load(path):
    import bpy
    if path.lower().endswith(".blend"):
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(path))
    else:
        bc.reset_scene()
        bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))


def check_mesh(obj, problems):
    import bmesh
    tris = bc.triangle_count(obj)
    if tris > MAX_TRIANGLES_PER_MESH:
        problems.append(f"{obj.name} : {tris} triangles (limite Roblox {MAX_TRIANGLES_PER_MESH} par mesh).")

    if not obj.data.uv_layers:
        problems.append(f"{obj.name} : aucune UV (texture impossible dans Roblox).")

    transform = obj.matrix_world
    scale = transform.to_scale()
    if any(abs(value - 1.0) > 0.01 for value in scale):
        problems.append(f"{obj.name} : transformations non appliquées (échelle {scale.x:.2f}, {scale.y:.2f}, {scale.z:.2f}).")

    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    # L'import glTF sépare les sommets aux coutures UV et normales : on les refusionne dans
    # cette copie bmesh (le mesh réel n'est pas modifié) pour éviter de faux non-manifold.
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    non_manifold = sum(1 for edge in bm.edges if not edge.is_manifold)
    degenerate = sum(1 for face in bm.faces if face.calc_area() < 1e-9)
    bm.free()
    if non_manifold:
        problems.append(f"{obj.name} : {non_manifold} arête(s) non-manifold.")
    if degenerate:
        problems.append(f"{obj.name} : {degenerate} face(s) dégénérée(s) à supprimer.")

    # Normales incohérentes : le volume signé négatif signale des faces retournées.
    try:
        mesh.calc_loop_triangles()
        volume = 0.0
        for tri in mesh.loop_triangles:
            a, b, c = (mesh.vertices[i].co for i in tri.vertices)
            volume += a.dot(b.cross(c)) / 6.0
        if volume < 0:
            problems.append(f"{obj.name} : normales orientées vers l'intérieur (faces retournées).")
    except Exception:  # noqa: BLE001
        pass

    return {"name": obj.name, "triangles": tris, "uv": bool(mesh.uv_layers), "materials": len(mesh.materials)}


def check_images(problems):
    import bpy
    for image in bpy.data.images:
        if image.source != "FILE" and image.packed_file is None:
            continue
        width, height = image.size[0], image.size[1]
        if max(width, height) > MAX_TEXTURE:
            problems.append(f"Texture {image.name} : {width}x{height} px (limite {MAX_TEXTURE} px).")


def main():
    argv = argv_after_separator()
    source = option(argv, "--input")
    if not source:
        raise SystemExit("ERREUR: --input <fichier .glb|.blend> est obligatoire.")
    if not os.path.isfile(source):
        raise SystemExit(f"ERREUR: fichier introuvable : {source}")

    load(source)

    problems = []
    meshes = []
    for obj in bpy_context_meshes():
        meshes.append(check_mesh(obj, problems))
    if not meshes:
        problems.append("Aucun mesh dans la scène : le modèle serait vide dans Roblox.")
    check_images(problems)

    try:
        low, high, _, _ = bc.scene_bounds()
        size = high - low
        size_studs = {
            "x": round(size.x / bc.STUDS_TO_METERS, 2),
            "y": round(size.y / bc.STUDS_TO_METERS, 2),
            "z": round(size.z / bc.STUDS_TO_METERS, 2),
        }
    except Exception:  # noqa: BLE001
        size_studs = None

    total = sum(item["triangles"] for item in meshes)
    report = {
        "input": os.path.basename(source),
        "meshes": meshes,
        "triangles": total,
        "size_studs": size_studs,
        "problems": problems,
        "ok": not problems,
    }
    print("VALIDATE " + json.dumps(report))
    if problems:
        sys.exit(2)


def bpy_context_meshes():
    import bpy
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:  # noqa: BLE001
        print(f"ERREUR: {error}", file=sys.stderr)
        sys.exit(1)
