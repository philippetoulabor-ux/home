import { useState, useRef, useCallback, useLayoutEffect, useEffect, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Model } from './Raum'
import {
  BlenderSceneSetup,
  BLENDER_CAMERA_FOV_DEG,
  BLENDER_CAMERA_PERSPECTIVE,
  TONE_MAPPING_EXPOSURE,
} from './BlenderSceneSetup'
import { ASPECT_CLAMP_MAX, ASPECT_CLAMP_MIN, SceneControls } from './SceneControls'

function getClampedCanvasStyle() {
  const aspect = window.innerWidth / window.innerHeight

  if (aspect < ASPECT_CLAMP_MIN) {
    return {
      width: `min(100vw, calc(100vh * ${ASPECT_CLAMP_MIN}))`,
      height: '100vh',
    }
  }

  if (aspect > ASPECT_CLAMP_MAX) {
    return {
      width: '100vw',
      height: `min(100vh, calc(100vw / ${ASPECT_CLAMP_MAX}))`,
    }
  }

  return { width: '100vw', height: '100vh' }
}

function App() {
  const [isFocused, setIsFocused] = useState(false)
  const [focusObject, setFocusObject] = useState(null)
  const [returnHomeTrigger, setReturnHomeTrigger] = useState(0)
  const [canvasWrapStyle, setCanvasWrapStyle] = useState(getClampedCanvasStyle)
  const canvasWrapRef = useRef(null)
  const controlsRef = useRef()
  const homeStateRef = useRef(null)

  const handleFocusComplete = useCallback(() => setIsFocused(true), [])
  const handleReturnComplete = useCallback(() => {
    setIsFocused(false)
    setFocusObject(null)
  }, [])

  useLayoutEffect(() => {
    const update = () => setCanvasWrapStyle(getClampedCanvasStyle())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const element = canvasWrapRef.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      setCanvasWrapStyle(getClampedCanvasStyle())
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const roomViewActive = focusObject == null

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#1a1a1a',
        position: 'relative',
        touchAction: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isFocused && (
        <div style={{ position: 'fixed', top: 20, left: 20, zIndex: 2147483647 }}>
          <button
            onClick={() => setReturnHomeTrigger((n) => n + 1)}
            style={{
              padding: '10px 14px',
              fontSize: 15,
              cursor: 'pointer',
              background: '#ff2e63',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
            }}
          >
            Zurück
          </button>
        </div>
      )}

      <div ref={canvasWrapRef} style={canvasWrapStyle}>
        <Canvas
          style={{ display: 'block', width: '100%', height: '100%' }}
          camera={{
            fov: BLENDER_CAMERA_FOV_DEG,
            near: BLENDER_CAMERA_PERSPECTIVE.near,
            far: BLENDER_CAMERA_PERSPECTIVE.far,
            position: BLENDER_CAMERA_PERSPECTIVE.position,
          }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          onCreated={({ gl, camera, size }) => {
            gl.toneMappingExposure = TONE_MAPPING_EXPOSURE
            if (size.width > 0 && size.height > 0) {
              camera.aspect = size.width / size.height
              camera.updateProjectionMatrix()
            }
          }}
        >
          <color attach="background" args={['#1a1a1a']} />

          <SceneControls
            controlsRef={controlsRef}
            homeStateRef={homeStateRef}
            focusObject={focusObject}
            returnHomeTrigger={returnHomeTrigger}
            onFocusComplete={handleFocusComplete}
            onReturnComplete={handleReturnComplete}
          />

          <Suspense fallback={null}>
            <BlenderSceneSetup
              controlsRef={controlsRef}
              homeStateRef={homeStateRef}
              roomViewActive={roomViewActive}
            />

            <Model
              onObjectClick={(object) => {
                setFocusObject(object)
              }}
            />
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}

export default App
