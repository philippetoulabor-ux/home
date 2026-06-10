"""Export home.glb with UVMap as TEXCOORD_0 and Lightmap as TEXCOORD_1."""
import bpy
import os

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
GLB_PATH = os.path.join(PROJECT_ROOT, 'public', 'home.glb')

EMISSIVE_MESHES = {'glowing puppe', 'ls-candle', 'Mesh_0.001', 'regal (bild)'}


def reorder_uv_maps(mesh):
    uv_layers = mesh.uv_layers
    if 'Lightmap' not in uv_layers:
        return False

    uvmap_data = None
    if 'UVMap' in uv_layers:
        uvmap_data = [(loop.uv.x, loop.uv.y) for loop in uv_layers['UVMap'].data]
    elif 'automap' in uv_layers:
        uvmap_data = [(loop.uv.x, loop.uv.y) for loop in uv_layers['automap'].data]

    lightmap_data = [(loop.uv.x, loop.uv.y) for loop in uv_layers['Lightmap'].data]

    while uv_layers:
        uv_layers.remove(uv_layers[0])

    if uvmap_data:
        layer0 = uv_layers.new(name='UVMap')
        for i, (u, v) in enumerate(uvmap_data):
            layer0.data[i].uv = (u, v)

    layer1 = uv_layers.new(name='Lightmap')
    for i, (u, v) in enumerate(lightmap_data):
        layer1.data[i].uv = (u, v)

    return True


def main():
    ordered = 0
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        if obj.name in EMISSIVE_MESHES:
            continue
        if reorder_uv_maps(obj.data):
            ordered += 1

    print(f'Ordered Lightmap UV on {ordered} meshes')

    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_texcoords=True,
        export_materials='EXPORT',
        export_lights=True,
        export_cameras=True,
    )
    print('Exported', GLB_PATH)


if __name__ == '__main__':
    main()
