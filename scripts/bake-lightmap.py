"""
Bake hybrid lightmap atlas from webroom.blend.
Run inside Blender: blender /path/to/webroom.blend --background --python scripts/bake-lightmap.py
Or via Blender MCP execute_blender_code (run sections sequentially).
"""
import json
import os
import bpy

BLEND_DIR = os.path.dirname(bpy.data.filepath) if bpy.data.filepath else os.getcwd()
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, 'public', 'lightmaps')
ATLAS_PNG = os.path.join(OUTPUT_DIR, 'room-atlas.png')
MANIFEST_PATH = os.path.join(OUTPUT_DIR, 'manifest.json')
IMAGE_SIZE = 1024
SAMPLES = 128

# Blender object name -> glTF node name (as used in Raum.jsx)
MESH_NAME_MAP = {
    'alien chair': 'alien_chair',
    'Cube.001': 'Cube001',
    'Cube.006': 'Cube006',
    'Cube.007': 'Cube007',
    'grillz poster': 'grillz_poster',
    'middleman': 'middleman',
    'mm-bretter': 'mm-bretter',
    'Raum': 'Raum',
    'Regalbretter.001': 'Regalbretter001',
    'Regalbretter.002': 'Regalbretter002',
    'speaker module': 'speaker_module',
    'weblampe': 'weblampe',
    'x-bock couch': 'x-bock_couch',
}

EMISSIVE_MESHES = {'glowing puppe', 'ls-candle', 'Mesh_0.001', 'regal (bild)'}

_BAKE_MAT_NAME = 'LightmapBakeMat'


def _ensure_bake_material(obj):
    """Meshes without materials (e.g. Cube.001) need a temp material for baking."""
    has_mat = any(slot.material for slot in obj.material_slots)
    if has_mat:
        return
    mat = bpy.data.materials.get(_BAKE_MAT_NAME)
    if not mat:
        mat = bpy.data.materials.new(_BAKE_MAT_NAME)
        mat.use_nodes = True
    if not obj.material_slots:
        obj.data.materials.append(mat)
    else:
        obj.material_slots[0].material = mat


def ensure_lightmap_uvs(static_meshes):
    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for name in static_meshes:
        obj = bpy.data.objects[name]
        if 'Lightmap' not in obj.data.uv_layers:
            obj.data.uv_layers.new(name='Lightmap')
        obj.data.uv_layers.active = obj.data.uv_layers['Lightmap']
    for obj in bpy.data.objects:
        obj.select_set(False)
    for name in static_meshes:
        bpy.data.objects[name].select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects[static_meshes[0]]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.lightmap_pack()
    bpy.ops.object.mode_set(mode='OBJECT')


def setup_bake_image(static_meshes):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    img_name = 'room_lightmap_atlas'
    if img_name in bpy.data.images:
        bpy.data.images.remove(bpy.data.images[img_name])
    img = bpy.data.images.new(img_name, IMAGE_SIZE, IMAGE_SIZE, alpha=False)
    img.colorspace_settings.name = 'sRGB'

    for name in EMISSIVE_MESHES:
        if name in bpy.data.objects:
            bpy.data.objects[name].hide_render = True

    active_tex = None
    for name in static_meshes:
        obj = bpy.data.objects[name]
        _ensure_bake_material(obj)
        for slot in obj.material_slots:
            mat = slot.material
            if not mat:
                continue
            if not mat.node_tree:
                mat.use_nodes = True
            nodes = mat.node_tree.nodes
            for n in list(nodes):
                if n.name == 'LightmapBake':
                    nodes.remove(n)
            tex = nodes.new('ShaderNodeTexImage')
            tex.image = img
            tex.name = 'LightmapBake'
            tex.select = True
            nodes.active = tex
            active_tex = tex
            uv = nodes.new('ShaderNodeUVMap')
            uv.uv_map = 'Lightmap'
            mat.node_tree.links.new(uv.outputs['UV'], tex.inputs['Vector'])
    if active_tex:
        active_tex.select = True
    return img


def run_bake(static_meshes):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.render.bake.use_clear = True
    scene.render.bake.margin = 8
    scene.render.bake.margin_type = 'EXTEND'

    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for obj in bpy.data.objects:
        obj.select_set(False)
    for name in static_meshes:
        bpy.data.objects[name].select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects[static_meshes[0]]

    # Bake each mesh separately into the shared atlas (avoids missing active-image errors).
    for i, name in enumerate(static_meshes):
        for obj in bpy.data.objects:
            obj.select_set(False)
        obj = bpy.data.objects[name]
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for slot in obj.material_slots:
            mat = slot.material
            if mat and mat.node_tree:
                for node in mat.node_tree.nodes:
                    if node.type == 'TEX_IMAGE' and node.image == bpy.data.images.get('room_lightmap_atlas'):
                        mat.node_tree.nodes.active = node
                        node.select = True
                        break
        # Diffuse direct+indirect without albedo — correct input for Three.js lightMap.
        bpy.ops.object.bake(
            type='DIFFUSE',
            pass_filter={'DIRECT', 'INDIRECT'},
            use_clear=(i == 0),
        )


def save_outputs(img, static_meshes):
    img.filepath_raw = ATLAS_PNG
    img.file_format = 'PNG'
    img.save()

    manifest = {
        'atlas': '/lightmaps/room-atlas.png',
        'intensity': 1.5,
        'meshes': [MESH_NAME_MAP.get(n, n.replace(' ', '_')) for n in static_meshes],
    }
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    print('Wrote', ATLAS_PNG)
    print('Wrote', MANIFEST_PATH)


def main():
    static_meshes = [
        obj.name for obj in bpy.data.objects
        if obj.type == 'MESH' and obj.name not in EMISSIVE_MESHES
    ]
    ensure_lightmap_uvs(static_meshes)
    img = setup_bake_image(static_meshes)
    run_bake(static_meshes)
    save_outputs(img, static_meshes)


if __name__ == '__main__':
    main()
