import { useLayoutEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { GLB_PATH } from './BlenderSceneSetup'
import { applyLightmaps } from './applyLightmaps'
import { patchGltfMaterials } from './gltfMaterialPatches'

/*
Auto-generated mesh layout from:
  npx gltfjsx public/home.glb --transform --keepnames
Source: public/home.glb > public/home-transformed.glb
*/

export function Model({ onObjectClick, ...props }) {
  const { nodes, materials } = useGLTF(GLB_PATH)
  const invalidate = useThree((state) => state.invalidate)

  useLayoutEffect(() => {
    patchGltfMaterials(materials, nodes)
    let cancelled = false
    applyLightmaps(nodes).then(() => {
      if (!cancelled) {
        patchGltfMaterials(materials, nodes)
        invalidate()
      }
    })
    return () => {
      cancelled = true
    }
  }, [materials, nodes, invalidate])

  const clickableMeshes = useMemo(
    () => [
      {
        name: 'middleman',
        geometry: nodes.middleman.geometry,
        material: materials['Material.001'],
        position: [-3.179, 0.873, -3],
      },
      {
        name: 'mm-bretter',
        geometry: nodes['mm-bretter'].geometry,
        material: materials['MDF Board'],
      },
      {
        name: 'ls-candle',
        geometry: nodes['ls-candle'].geometry,
        material: materials['10.6.2024_0'],
        position: [-3.15, 0.945, -2.661],
      },
      {
        name: 'alien_chair',
        geometry: nodes.alien_chair.geometry,
        material: materials.Material_0,
        position: [2.802, 0.611, -2.378],
        rotation: [-Math.PI, 0.55, -Math.PI],
      },
      {
        name: 'x-bock_couch',
        geometry: nodes['x-bock_couch'].geometry,
        material: materials['Material_0.002'],
        position: [2.199, 0.183, -3.092],
        rotation: [0, 0.782, 0],
      },
      {
        name: 'weblampe',
        geometry: nodes.weblampe.geometry,
        material: materials['Material_0.003'],
      },
      {
        name: 'speaker_module',
        geometry: nodes.speaker_module.geometry,
        material: materials['Material_0.004'],
        position: [-2.65, -0.038, -4.528],
      },
      {
        name: 'glowing_puppe',
        geometry: nodes.glowing_puppe.geometry,
        material: materials['Material_0.005'],
        position: [-3.25, 1.435, -3.303],
      },
      {
        name: 'grillz_poster',
        geometry: nodes.grillz_poster.geometry,
        material: materials['Material.002'],
        position: [2.046, 1.573, -13.532],
        scale: [1, 1, 0.5],
      },
      {
        name: 'Mesh_0001',
        geometry: nodes.Mesh_0001.geometry,
        material: materials['Material_0.007'],
        position: [-0.278, 0.613, -2.268],
        rotation: [0, -1.218, 0],
      },
      {
        name: 'Regalbretter001',
        geometry: nodes.Regalbretter001.geometry,
        material: materials['Polished Oak Wood'],
        position: [-1.444, 1.3, -4.925],
        rotation: [Math.PI, 0, Math.PI],
      },
      {
        name: 'regal_(bild)',
        geometry: nodes['regal_(bild)'].geometry,
        material: materials.Material,
        position: [-1.442, 1.798, -4.98],
      },
    ],
    [materials, nodes]
  )

  return (
    <group {...props} dispose={null}>
      <mesh
        name="Cube001"
        geometry={nodes.Cube001.geometry}
        material={nodes.Cube001.material}
        position={[-1.75, -0.014, 2.733]}
        scale={[450, 75, 75]}
        raycast={() => null}
      />
      <mesh
        name="Raum"
        geometry={nodes.Raum.geometry}
        material={materials.Paper}
        position={[0, 1.75, 0]}
        raycast={() => null}
      />
      {clickableMeshes.map((meshProps) => (
        <mesh
          key={meshProps.name}
          {...meshProps}
          onClick={(e) => {
            e.stopPropagation()
            onObjectClick?.(e.object)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'default'
          }}
        />
      ))}
    </group>
  )
}
