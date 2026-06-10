import { useEffect, useRef } from 'react'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

const { ACTION } = CameraControlsImpl

export const ROOM_TARGET_DISTANCE = 1.5

export const ASPECT_CLAMP_MIN = 0.75
export const ASPECT_CLAMP_MAX = 2.2
export const ROOM_FIT_MARGIN = 1.05
export const MAX_ROOM_FIT_FACTOR = 2.5

const MIN_FOCUS_DISTANCE = 0.1
const MAX_FOCUS_DISTANCE = 10

const _corner = new THREE.Vector3()
const _viewRight = new THREE.Vector3()
const _viewUp = new THREE.Vector3()

function getFocusMargin(maxDim) {
  if (maxDim <= 0.35) return 1.3
  if (maxDim <= 0.8) return 1.15
  if (maxDim <= 1.5) return 1.05
  if (maxDim <= 3) return 0.92
  return 0.82
}

function getViewExtents(box, center, viewDirection) {
  _viewRight.crossVectors(viewDirection, new THREE.Vector3(0, 1, 0))
  if (_viewRight.lengthSq() < 1e-6) {
    _viewRight.set(1, 0, 0)
  } else {
    _viewRight.normalize()
  }
  _viewUp.crossVectors(_viewRight, viewDirection).normalize()

  let halfWidth = 0
  let halfHeight = 0
  let halfDepth = 0

  const { min, max } = box
  for (let xi = 0; xi < 2; xi++) {
    for (let yi = 0; yi < 2; yi++) {
      for (let zi = 0; zi < 2; zi++) {
        _corner.set(xi ? max.x : min.x, yi ? max.y : min.y, zi ? max.z : min.z)
        _corner.sub(center)
        halfWidth = Math.max(halfWidth, Math.abs(_corner.dot(_viewRight)))
        halfHeight = Math.max(halfHeight, Math.abs(_corner.dot(_viewUp)))
        halfDepth = Math.max(halfDepth, Math.abs(_corner.dot(viewDirection)))
      }
    }
  }

  return { halfWidth, halfHeight, halfDepth }
}

export function applyRoomMode(controls) {
  const pos = new THREE.Vector3()
  const target = new THREE.Vector3()
  controls.getPosition(pos)
  controls.getTarget(target)
  const dist = Math.max(pos.distanceTo(target), 0.01)

  controls.minDistance = dist
  controls.maxDistance = dist
  controls.infinityDolly = true

  controls.minPolarAngle = 1.05
  controls.maxPolarAngle = 2.05
  controls.minAzimuthAngle = -Infinity
  controls.maxAzimuthAngle = Infinity

  controls.mouseButtons.left = ACTION.ROTATE
  controls.mouseButtons.middle = ACTION.NONE
  controls.mouseButtons.right = ACTION.NONE
  controls.mouseButtons.wheel = ACTION.NONE

  controls.touches.one = ACTION.TOUCH_ROTATE
  controls.touches.two = ACTION.NONE
  controls.touches.three = ACTION.NONE
}

export function applyObjectMode(controls, fittedDistance) {
  const pos = new THREE.Vector3()
  const target = new THREE.Vector3()
  controls.getPosition(pos)
  controls.getTarget(target)
  const currentDist = Math.max(pos.distanceTo(target), 0.01)
  const base = fittedDistance ?? currentDist

  controls.minDistance = Math.max(base * 0.35, 0.06)
  controls.maxDistance = Math.min(base * 3.2, MAX_FOCUS_DISTANCE)
  controls.infinityDolly = false

  controls.minPolarAngle = 0.25
  controls.maxPolarAngle = Math.PI - 0.25

  controls.mouseButtons.left = ACTION.ROTATE
  controls.mouseButtons.middle = ACTION.NONE
  controls.mouseButtons.right = ACTION.NONE
  controls.mouseButtons.wheel = ACTION.DOLLY

  controls.touches.one = ACTION.TOUCH_ROTATE
  controls.touches.two = ACTION.TOUCH_DOLLY_ROTATE
  controls.touches.three = ACTION.NONE
}

function releaseDistanceLimits(controls) {
  controls.minDistance = Number.EPSILON
  controls.maxDistance = Infinity
  controls.infinityDolly = false
}

function getObjectFocusMetrics(object, camera, homeState) {
  object.updateWorldMatrix(true, true)

  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) return null

  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)

  if (!Number.isFinite(maxDim) || maxDim <= 0) return null

  const viewDirection = getApproachDirection(center, camera, homeState)
  const { halfWidth, halfHeight, halfDepth } = getViewExtents(box, center, viewDirection)

  const fovRad = THREE.MathUtils.degToRad(camera.fov)
  const hFov = 2 * Math.atan(Math.tan(fovRad / 2) * camera.aspect)

  const distForHeight = halfHeight / Math.tan(fovRad / 2)
  const distForWidth = halfWidth / Math.tan(hFov / 2)

  let distance = Math.max(distForHeight, distForWidth, halfDepth * 0.35)
  distance *= getFocusMargin(maxDim)
  distance = THREE.MathUtils.clamp(distance, MIN_FOCUS_DISTANCE, MAX_FOCUS_DISTANCE)

  return { center, distance, viewDirection }
}

export function getHomeViewDirection(homeState) {
  const direction = new THREE.Vector3()
  const position = homeState?.blenderPosition ?? homeState?.position
  const target = homeState?.blenderTarget ?? homeState?.target
  if (!position || !target) {
    direction.set(0, 0.2, 1)
    return direction.normalize()
  }
  direction.copy(position).sub(target)
  if (direction.lengthSq() < 1e-6) {
    direction.set(0, 0.2, 1)
  }
  return direction.normalize()
}

export function getResponsiveRoomDistance(homeState, aspect) {
  const blenderDistance = getBlenderHomeDistance(homeState)
  const refAspect = homeState?.referenceAspect

  if (!refAspect || !aspect || !Number.isFinite(aspect)) {
    return blenderDistance
  }

  const widthScale = refAspect / aspect
  const heightScale = aspect / refAspect
  let scale = Math.max(1, widthScale, heightScale)
  scale = Math.min(scale, MAX_ROOM_FIT_FACTOR)
  if (scale > 1.001) scale *= ROOM_FIT_MARGIN

  return blenderDistance * scale
}

export function getBlenderHomeDistance(homeState) {
  if (homeState?.blenderDistance != null) {
    return Math.max(homeState.blenderDistance, 0.01)
  }
  if (!homeState?.position || !homeState?.target) {
    return ROOM_TARGET_DISTANCE
  }
  return Math.max(homeState.position.distanceTo(homeState.target), 0.01)
}

export function applyResponsiveRoomCamera(controls, camera, homeState) {
  const target = homeState?.blenderTarget ?? homeState?.target
  if (!target) return null

  const targetVec = target.clone()
  const viewDirection = getHomeViewDirection(homeState)
  const distance = getResponsiveRoomDistance(homeState, camera.aspect)
  const position = targetVec.clone().addScaledVector(viewDirection, distance)

  controls.setLookAt(
    position.x,
    position.y,
    position.z,
    targetVec.x,
    targetVec.y,
    targetVec.z,
    false
  )

  return {
    homeState: {
      ...homeState,
      position: position.clone(),
      target: targetVec.clone(),
    },
    distance,
  }
}

function getApproachDirection(objectCenter, camera, homeState) {
  const direction = camera.position.clone().sub(objectCenter)

  if (direction.lengthSq() < 0.02 && homeState?.position) {
    direction.copy(homeState.position).sub(objectCenter)
  }

  if (direction.lengthSq() < 0.02) {
    direction.set(0, 0.2, 1)
  }

  direction.y = Math.max(direction.y, -0.08)
  return direction.normalize()
}

export async function focusCameraOnObject(controls, camera, object, homeState) {
  const metrics = getObjectFocusMetrics(object, camera, homeState)
  if (!metrics) return null

  const { center, distance, viewDirection } = metrics
  const cameraPos = center.clone().addScaledVector(viewDirection, distance)

  releaseDistanceLimits(controls)
  await controls.setLookAt(
    cameraPos.x,
    cameraPos.y,
    cameraPos.z,
    center.x,
    center.y,
    center.z,
    true
  )

  return distance
}

export function SceneControls({
  controlsRef,
  homeStateRef,
  focusObject,
  returnHomeTrigger,
  onFocusComplete,
  onReturnComplete,
}) {
  const camera = useThree((state) => state.camera)
  const busyRef = useRef(false)
  const lastReturnTriggerRef = useRef(0)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls || !focusObject) return

    let cancelled = false
    busyRef.current = true
    controls.cancel()
    controls.enabled = false

    focusCameraOnObject(controls, camera, focusObject, homeStateRef?.current)
      .then((fittedDistance) => {
        if (cancelled || fittedDistance == null) return
        applyObjectMode(controls, fittedDistance)
        controls.enabled = true
        onFocusComplete?.()
      })
      .finally(() => {
        if (!cancelled) busyRef.current = false
      })

    return () => {
      cancelled = true
      controls.cancel()
      busyRef.current = false
    }
  }, [controlsRef, camera, focusObject, homeStateRef, onFocusComplete])

  useEffect(() => {
    if (!returnHomeTrigger || returnHomeTrigger === lastReturnTriggerRef.current) return

    const controls = controlsRef.current
    const home = homeStateRef?.current
    if (!controls || !home) return

    lastReturnTriggerRef.current = returnHomeTrigger

    let cancelled = false
    busyRef.current = true
    controls.enabled = false
    controls.cancel()
    releaseDistanceLimits(controls)

    const target = (home.blenderTarget ?? home.target).clone()
    const viewDir = getHomeViewDirection(home)
    const distance = getResponsiveRoomDistance(home, camera.aspect)
    const position = target.clone().addScaledVector(viewDir, distance)

    controls
      .setLookAt(
        position.x,
        position.y,
        position.z,
        target.x,
        target.y,
        target.z,
        true
      )
      .then(() => {
        if (cancelled) return
        if (homeStateRef?.current) {
          const fitted = applyResponsiveRoomCamera(controls, camera, homeStateRef.current)
          if (fitted) homeStateRef.current = fitted.homeState
        }
        applyRoomMode(controls)
        controls.enabled = true
        onReturnComplete?.()
      })
      .catch(() => {
        if (cancelled) return
        applyRoomMode(controls)
        controls.enabled = true
        onReturnComplete?.()
      })
      .finally(() => {
        if (!cancelled) busyRef.current = false
      })

    return () => {
      cancelled = true
      busyRef.current = false
    }
  }, [controlsRef, homeStateRef, returnHomeTrigger, onReturnComplete, camera])

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      smoothTime={0.35}
      draggingSmoothTime={0.12}
      azimuthRotateSpeed={0.35}
      polarRotateSpeed={0.35}
      dollySpeed={0.8}
    />
  )
}
