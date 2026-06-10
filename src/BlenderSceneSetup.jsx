import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { RoomCameraFit } from './RoomCameraFit'
import * as THREE from 'three'
import { ROOM_TARGET_DISTANCE, applyRoomMode } from './SceneControls'

export const GLB_PATH = '/home-transformed.glb'

// From public/home-transformed.glb → camera "Camera" (matches Blender render)
export const BLENDER_CAMERA_PERSPECTIVE = {
  yfov: 0.7784619769773174,
  near: 0.05000000074505806,
  far: 100,
  position: [0, 1.2013113498687744, 2.5928635597229004],
}
export const BLENDER_CAMERA_FOV_DEG =
  (BLENDER_CAMERA_PERSPECTIVE.yfov * 180) / Math.PI

// Dynamic punctual lights: candela (lm/sr) via KHR_lights_punctual — needs 683 lm/W compensation.
export const DYNAMIC_TONE_MAPPING_EXPOSURE = 1 / 683
// Baked lightmap: sRGB radiance already in texture — use near-neutral exposure.
export const BAKED_TONE_MAPPING_EXPOSURE = 1.0

// Hybrid lighting: baked atlas carries fill + GI; only accent lights stay dynamic.
export const USE_BAKED_LIGHTING = true
// Candela → scene units when exposure is 1.0 (inverse of the 683 lm/W glTF factor).
const CANDELA_TO_SCENE = DYNAMIC_TONE_MAPPING_EXPOSURE / BAKED_TONE_MAPPING_EXPOSURE
export const TONE_MAPPING_EXPOSURE = USE_BAKED_LIGHTING
  ? BAKED_TONE_MAPPING_EXPOSURE
  : DYNAMIC_TONE_MAPPING_EXPOSURE

// Light roles in the Blender scene (see reference render):
//   Point.002  – warm ceiling spot above the chandelier (main key light)
//   Point      – secondary point at the same fixture (inner glow)
//   Raum_Fill* – four ceiling fill point lights
//
// Spot uses raw candela scale; points need extra boost (Blender radius ≠ glTF point source).
const POINT_LIGHT_SCALE = 2.5

function cloneBlenderLight(light) {
  const clone = light.clone()
  light.updateMatrixWorld(true)

  if (clone.isSpotLight) {
    const target = clone.target.clone()
    const worldTarget = new THREE.Vector3()
    light.target.getWorldPosition(worldTarget)
    clone.add(target)
    clone.worldToLocal(worldTarget)
    target.position.copy(worldTarget)
    clone.target = target
  }

  return clone
}

function configureHybridLight(light) {
  if (!USE_BAKED_LIGHTING) return light
  const typeScale = light.isPointLight ? POINT_LIGHT_SCALE : 1
  light.intensity *= CANDELA_TO_SCENE * typeScale
  return light
}

function extractBlenderRig(scene) {
  const camera = scene.getObjectByName('Camera')
  const lights = []
  scene.traverse((child) => {
    if (child.isPointLight || child.isSpotLight || child.isDirectionalLight) {
      lights.push(configureHybridLight(cloneBlenderLight(child)))
    }
  })
  return { camera, lights }
}

function applyBlenderProjection(activeCamera, sourceCamera, width, height) {
  if (!sourceCamera.isPerspectiveCamera || !activeCamera.isPerspectiveCamera) return

  activeCamera.fov = sourceCamera.fov
  activeCamera.near = sourceCamera.near
  activeCamera.far = sourceCamera.far
  if (width > 0 && height > 0) {
    activeCamera.aspect = width / height
  }
  activeCamera.updateProjectionMatrix()
}

function applyBlenderCameraTo(activeCamera, sourceCamera, controls, size) {
  sourceCamera.updateMatrixWorld(true)

  const position = new THREE.Vector3()
  const lookDirection = new THREE.Vector3()
  sourceCamera.getWorldPosition(position)
  sourceCamera.getWorldDirection(lookDirection)

  applyBlenderProjection(activeCamera, sourceCamera, size.width, size.height)

  const target = position.clone().addScaledVector(lookDirection, ROOM_TARGET_DISTANCE)
  controls.setLookAt(
    position.x,
    position.y,
    position.z,
    target.x,
    target.y,
    target.z,
    false
  )

  const blenderDistance = position.distanceTo(target)

  return {
    position: position.clone(),
    target: target.clone(),
    blenderDistance,
    referenceAspect: size.width / size.height,
    blenderPosition: position.clone(),
    blenderTarget: target.clone(),
  }
}

export function BlenderSceneSetup({ controlsRef, homeStateRef, roomViewActive = true }) {
  const { scene } = useGLTF(GLB_PATH)
  const activeCamera = useThree((state) => state.camera)
  const viewportWidth = useThree((state) => state.size.width)
  const viewportHeight = useThree((state) => state.size.height)
  const invalidate = useThree((state) => state.invalidate)
  const transformSynced = useRef(false)
  const [cameraReady, setCameraReady] = useState(false)

  const rig = useMemo(() => {
    const { camera, lights } = extractBlenderRig(scene)
    return {
      camera: camera?.clone(),
      lights,
    }
  }, [scene])

  // One-time Blender camera sync; viewport refit is handled by RoomCameraFit.
  useLayoutEffect(() => {
    if (!rig.camera || transformSynced.current) return

    let raf
    const sync = () => {
      if (!viewportWidth || !viewportHeight) {
        raf = requestAnimationFrame(sync)
        return
      }
      if (!controlsRef.current) {
        raf = requestAnimationFrame(sync)
        return
      }

      const state = applyBlenderCameraTo(
        activeCamera,
        rig.camera,
        controlsRef.current,
        { width: viewportWidth, height: viewportHeight }
      )
      if (homeStateRef) homeStateRef.current = state
      applyRoomMode(controlsRef.current)
      transformSynced.current = true
      setCameraReady(true)
      invalidate()
    }

    sync()
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [
    rig,
    activeCamera,
    controlsRef,
    homeStateRef,
    roomViewActive,
    viewportWidth,
    viewportHeight,
    invalidate,
  ])

  if (!rig.camera) return null

  return (
    <>
      {rig.lights.map((light) => (
        <primitive key={light.uuid} object={light} />
      ))}
      <RoomCameraFit
        enabled={cameraReady}
        sourceCamera={rig.camera}
        controlsRef={controlsRef}
        homeStateRef={homeStateRef}
        roomViewActive={roomViewActive}
      />
    </>
  )
}

useGLTF.preload(GLB_PATH)
