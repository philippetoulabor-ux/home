import React, { useState, useRef, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Center, Bounds, useBounds } from '@react-three/drei'
import * as THREE from 'three'
import { Model } from './raum'

function ClickCapture({ onClickObject }) {
  const { camera, gl, scene } = useThree()

  useEffect(() => {
    const raycaster = new THREE.Raycaster()
    const handler = (event) => {
      const rect = gl.domElement.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera({ x, y }, camera)
      const objects = scene.children
      const intersects = raycaster.intersectObjects(objects, true)
      if (intersects.length) {
        onClickObject(intersects[0].object)
      }
    }

    gl.domElement.addEventListener('pointerdown', handler)
    return () => gl.domElement.removeEventListener('pointerdown', handler)
  }, [camera, gl, scene, onClickObject])

  return null
}

function SaveControlsState({ controlsRef }) {
  useEffect(() => {
    let timeout
    const save = () => {
      if (controlsRef.current) {
        controlsRef.current.saveState()
      } else {
        timeout = window.setTimeout(save, 50)
      }
    }
    save()
    return () => {
      if (timeout) window.clearTimeout(timeout)
    }
  }, [controlsRef])

  return null
}

function ZoomController({ object }) {
  const bounds = useBounds()

  useEffect(() => {
    if (!object) return
    bounds.refresh(object).fit({ padding: 1.2, duration: 0.8 })
  }, [bounds, object])

  return null
}

function BackController({ controlsRef, startStateRef, trigger, onDone }) {
  const { camera } = useThree()

  useEffect(() => {
    if (!trigger) return
    const startState = startStateRef.current
    if (!startState || !controlsRef.current) {
      onDone && onDone()
      return
    }

    const duration = 800
    const startTime = performance.now()

    const fromPos = camera.position.clone()
    const toPos = startState.position.clone()
    const fromQuat = camera.quaternion.clone()
    const toQuat = startState.quaternion.clone()
    const fromTarget = controlsRef.current.target.clone()
    const toTarget = startState.target.clone()

    // disable controls during animation
    const controls = controlsRef.current
    const prevEnabled = controls.enabled
    controls.enabled = false

    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    let raf = null
    const tick = (now) => {
      const elapsed = now - startTime
      const t = Math.min(1, elapsed / duration)
      const e = ease(t)

      camera.position.lerpVectors(fromPos, toPos, e)
      // quaternion slerp
      camera.quaternion.copy(fromQuat).slerp(toQuat, e)
      // target lerp
      controls.target.lerpVectors(fromTarget, toTarget, e)
      controls.update()

      if (t < 1) raf = requestAnimationFrame(tick)
      else {
        controls.enabled = prevEnabled
        try { controls.saveState && controls.saveState() } catch (err) {}
        onDone && onDone()
      }
    }

    raf = requestAnimationFrame(tick)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      controls.enabled = prevEnabled
    }
  }, [trigger, controlsRef, startStateRef, camera, onDone])

  return null
}

function RecordStartView({ controlsRef, startStateRef }) {
  const { camera } = useThree()

  useEffect(() => {
    let raf
    const record = () => {
      if (controlsRef.current) {
        startStateRef.current = {
          position: camera.position.clone(),
          quaternion: camera.quaternion.clone(),
          target: controlsRef.current.target.clone(),
        }
      } else {
        raf = window.requestAnimationFrame(record)
      }
    }
    record()
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [camera, controlsRef, startStateRef])

  return null
}

function App() {
  const [isZoomed, setIsZoomed] = useState(false)
  const [clickedObject, setClickedObject] = useState(null)
  const [backTrigger, setBackTrigger] = useState(false)
  const controlsRef = useRef()
  const rootRef = useRef()
  const startStateRef = useRef(null)

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a1a', position: 'relative' }}>
      {isZoomed && (
        <div style={{ position: 'fixed', top: 20, left: 20, zIndex: 2147483647 }}>
          <button
            onClick={() => {
              setBackTrigger(true)
            }}
            style={{ padding: '10px 14px', fontSize: 15, cursor: 'pointer', background: '#ff2e63', color: '#fff', border: 'none', borderRadius: 6 }}
          >
            Back
          </button>
        </div>
      )}

      <Canvas camera={{ position: [0, 0, 1.7], fov: 50 }}>
        <ambientLight intensity={2} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        <Bounds clip observe>
          <Center>
            <Model groupRef={rootRef} />
            <ClickCapture
              onClickObject={(object) => {
                if (object.name === 'Raum') return
                setClickedObject(object)
                setIsZoomed(true)
              }}
            />
            <ZoomController object={clickedObject} />
            <SaveControlsState controlsRef={controlsRef} />
            <RecordStartView controlsRef={controlsRef} startStateRef={startStateRef} />
            <BackController
              controlsRef={controlsRef}
              startStateRef={startStateRef}
              trigger={backTrigger}
              onDone={() => {
                setIsZoomed(false)
                setClickedObject(null)
                setBackTrigger(false)
              }}
            />
          </Center>
        </Bounds>

        <OrbitControls ref={controlsRef} makeDefault enableZoom={false} />
      </Canvas>
    </div>
  )
}

export default App;