
import React, { useMemo, useRef, useEffect } from 'react'
import { useGLTF, useBounds } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export function Model({ onZoomChange, groupRef: externalGroupRef, ...props }) {
  console.log('[Model] render start')
  const { nodes, materials } = useGLTF('/raum-transformed.glb')
  const bounds = useBounds()
  const localGroupRef = useRef()
  const groupRef = externalGroupRef || localGroupRef

  const clickableMeshes = useMemo(
    () => [
      {
        geometry: nodes.middleman.geometry,
        material: materials['Material.001'],
        position: [-3.329, 0.03, -3.634],
      },
      {
        geometry: nodes.Regalbretter.geometry,
        material: materials['MDF Board'],
        position: [-3.179, 0.44, -2.884],
        rotation: [0, Math.PI / 2, 0],
      },
      {
        geometry: nodes['ls-candle'].geometry,
        material: materials['10.6.2024_0'],
        position: [-3.15, 0.945, -2.564],
        rotation: [Math.PI / 2, 0, -2.065],
        scale: 0.34,
      },
      {
        geometry: nodes.alien_chair.geometry,
        material: materials.Material_0,
        position: [2.802, 0.597, -1.92],
        rotation: [-Math.PI, 0.55, -Math.PI],
      },
      {
        geometry: nodes['x-bock_couch'].geometry,
        material: materials['Material_0.002'],
        position: [2.199, 0.17, -2.634],
        rotation: [0, 0.782, 0],
      },
      {
        geometry: nodes.weblampe.geometry,
        material: materials['Material_0.003'],
        position: [0, 2.863, -3.463],
        scale: 0.706,
      },
      {
        geometry: nodes.speaker_module.geometry,
        material: materials['Material_0.004'],
        position: [-2.357, -0.045, -4.3],
        rotation: [0, 1.168, 0],
        scale: 0.662,
      },
      {
        geometry: nodes.glowing_puppe.geometry,
        material: materials['Material_0.005'],
        position: [-3.25, 1.435, -3.206],
        rotation: [-Math.PI, 0.471, -Math.PI],
        scale: 0.65,
      },
      {
        geometry: nodes.grillz_poster.geometry,
        material: materials['Material.002'],
        position: [1.152, 1.609, -5],
        scale: [1, 1, 0.5],
      },
    ],
    [materials, nodes]
  )

  const meshRefs = useRef([])
  const { camera, gl, scene } = useThree()

  useEffect(() => {
    console.log('[Model] useEffect mount - setting up raycast listener on gl.domElement')
    const raycaster = new THREE.Raycaster()

    function onPointerDown(e) {
      const rect = gl.domElement.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera({ x, y }, camera)
      const objects = meshRefs.current.filter(Boolean).map((m) => m)
      console.log('[Model] raycast attempt, meshRefs count:', objects.length)
      // log names and positions
      objects.forEach((o, i) => {
        try {
          console.log(`[Model] meshRefs[${i}] name:`, o.name, 'position:', o.position && o.position.toArray())
        } catch (err) {}
      })
      const intersects = raycaster.intersectObjects(objects, true)
      console.log('[Model] intersects length:', intersects.length)
      if (intersects.length) {
        console.log('[Model] raycast hit', intersects[0].object.name || intersects[0].object)
        try {
          window.dispatchEvent(new CustomEvent('model-click', { detail: { name: intersects[0].object.name } }))
        } catch (err) {}
        bounds.refresh(intersects[0].object).fit({ padding: 1.2, duration: 0.8 })
        onZoomChange?.(true)
      }
    }

    gl.domElement.addEventListener('pointerdown', onPointerDown)
    return () => gl.domElement.removeEventListener('pointerdown', onPointerDown)
  }, [camera, gl, bounds, onZoomChange])

  const handlePointerOver = (e) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
  }

  const handlePointerOut = (e) => {
    e.stopPropagation()
    document.body.style.cursor = 'default'
  }

  const handleClick = (e) => {
    e.stopPropagation()
    console.log('[Model] handleClick, object:', e.object && e.object.name)
    try {
      window.dispatchEvent(new CustomEvent('model-click', { detail: { name: e.object && e.object.name } }))
    } catch (err) {
      console.warn('unable to dispatch model-click', err)
    }
    bounds.refresh(e.object).fit({ padding: 1.2, duration: 0.8 })
    onZoomChange?.(true)
  }

  const handleBack = () => {
    if (groupRef.current) bounds.refresh(groupRef.current).fit({ padding: 1.2, duration: 0.8 })
    onZoomChange?.(false)
    document.body.style.cursor = 'default'
  }

  return (
    <group ref={groupRef} {...props} dispose={null}>
      <mesh
        geometry={nodes.Raum.geometry}
        material={materials.Paper}
        position={[0, 1.75, 0]}
        scale={[0.401, 0.35, 0.513]}
        raycast={() => null}
      />
      {clickableMeshes.map((meshProps, index) => (
        <mesh
          key={index}
          ref={(el) => (meshRefs.current[index] = el)}
          {...meshProps}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ))}
      {/* back handler registered via useEffect */}
    </group>
  )
}

useGLTF.preload('/raum-transformed.glb')
