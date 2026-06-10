import { useLayoutEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { applyResponsiveRoomCamera, applyRoomMode } from './SceneControls'

function applyBlenderProjection(activeCamera, sourceCamera, width, height) {
  if (!sourceCamera?.isPerspectiveCamera || !activeCamera.isPerspectiveCamera) return

  activeCamera.fov = sourceCamera.fov
  activeCamera.near = sourceCamera.near
  activeCamera.far = sourceCamera.far
  if (width > 0 && height > 0) {
    activeCamera.aspect = width / height
  }
  activeCamera.updateProjectionMatrix()
}

export function RoomCameraFit({
  controlsRef,
  homeStateRef,
  roomViewActive,
  sourceCamera,
  enabled,
}) {
  const gl = useThree((state) => state.gl)
  const activeCamera = useThree((state) => state.camera)
  const viewportWidth = useThree((state) => state.size.width)
  const viewportHeight = useThree((state) => state.size.height)
  const invalidate = useThree((state) => state.invalidate)
  const lastDistanceRef = useRef(null)

  useLayoutEffect(() => {
    if (!enabled || !roomViewActive || !sourceCamera || !controlsRef.current) return

    const runFit = () => {
      const home = homeStateRef?.current
      if (!viewportWidth || !viewportHeight || !home) return

      applyBlenderProjection(activeCamera, sourceCamera, viewportWidth, viewportHeight)

      const fitted = applyResponsiveRoomCamera(controlsRef.current, activeCamera, home)
      if (!fitted) return

      if (homeStateRef) homeStateRef.current = fitted.homeState

      if (lastDistanceRef.current !== fitted.distance) {
        lastDistanceRef.current = fitted.distance
        applyRoomMode(controlsRef.current)
      }

      invalidate()
    }

    runFit()

    let resizeRaf
    const onResize = () => {
      cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(runFit)
    }

    window.addEventListener('resize', onResize)

    const canvas = gl.domElement
    let observer
    if (canvas && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(onResize)
      observer.observe(canvas)
    }

    return () => {
      window.removeEventListener('resize', onResize)
      observer?.disconnect()
      cancelAnimationFrame(resizeRaf)
    }
  }, [
    enabled,
    roomViewActive,
    sourceCamera,
    controlsRef,
    homeStateRef,
    activeCamera,
    gl,
    viewportWidth,
    viewportHeight,
    invalidate,
  ])

  return null
}
