import * as THREE from 'three'

// glTF-Blender-IO exports emissiveTexture but often leaves emissiveFactor at [0,0,0].
export function patchGltfMaterials(materials, nodes) {
  if (!materials) return

  const laptop =
    nodes?.Mesh_0001?.material ?? materials['Material_0.007']

  if (laptop?.isMeshStandardMaterial) {
    laptop.emissive.set(1, 1, 1)
    laptop.emissiveIntensity = 6
    laptop.toneMapped = false
    if (laptop.emissiveMap) {
      laptop.emissiveMap.colorSpace = THREE.SRGBColorSpace
    }
    laptop.needsUpdate = true
  }

  const windowMat = materials.Material
  if (windowMat?.isMeshStandardMaterial) {
    windowMat.emissive.set(0, 0, 0)
    windowMat.emissiveIntensity = 1
    windowMat.emissiveMap = null
    windowMat.needsUpdate = true
  }

  const puppe = materials['Material_0.005']
  if (puppe?.isMeshStandardMaterial && puppe.map) {
    puppe.emissiveMap = puppe.map
    puppe.emissive.set(1, 0.85, 0.7)
    puppe.emissiveIntensity = 1.8
    puppe.needsUpdate = true
  }

  const candle = materials['10.6.2024_0']
  if (candle?.isMeshStandardMaterial && candle.map) {
    candle.emissiveMap = candle.map
    candle.emissive.set(1, 0.7, 0.35)
    candle.emissiveIntensity = 0.6
    candle.needsUpdate = true
  }
}
