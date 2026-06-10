import * as THREE from 'three'

const MANIFEST_URL = '/lightmaps/manifest.json'

let manifestPromise = null
let atlasTexture = null

function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL).then((res) => {
      if (!res.ok) throw new Error(`Lightmap manifest not found: ${res.status}`)
      return res.json()
    })
  }
  return manifestPromise
}

function loadAtlas(url) {
  if (atlasTexture) return Promise.resolve(atlasTexture)
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        // Blender bakes with V-up; Three.js lightmaps expect flipY for non-glTF images.
        texture.flipY = true
        atlasTexture = texture
        resolve(texture)
      },
      undefined,
      reject
    )
  })
}

function ensureLightmapUV(geometry) {
  if (geometry.attributes.uv2) return true
  const source = geometry.attributes.uv1
  if (!source) return false
  geometry.setAttribute('uv2', source.clone())
  return true
}

function applyToMesh(mesh, atlas, intensity) {
  if (!mesh?.geometry || !mesh?.material) return false

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  let applied = false

  for (const material of materials) {
    if (!material?.isMeshStandardMaterial) continue
    if (!ensureLightmapUV(mesh.geometry) && !mesh.geometry.attributes.uv2) continue
    material.lightMap = atlas
    material.lightMapIntensity = intensity
    material.needsUpdate = true
    applied = true
  }

  return applied
}

/**
 * Apply baked lightmap atlas to static room meshes listed in manifest.json.
 * @param {Record<string, import('three').Object3D>} nodes - useGLTF nodes map
 */
export async function applyLightmaps(nodes) {
  if (!nodes) return

  let manifest
  try {
    manifest = await loadManifest()
  } catch {
    return
  }

  const atlas = await loadAtlas(manifest.atlas)
  const intensity = manifest.intensity ?? 1
  const meshSet = new Set(manifest.meshes ?? [])

  for (const name of meshSet) {
    const node = nodes[name]
    if (!node) continue
    if (node.isMesh) {
      applyToMesh(node, atlas, intensity)
      continue
    }
    node.traverse?.((child) => {
      if (child.isMesh) applyToMesh(child, atlas, intensity)
    })
  }
}

export function disposeLightmaps() {
  atlasTexture?.dispose()
  atlasTexture = null
  manifestPromise = null
}
