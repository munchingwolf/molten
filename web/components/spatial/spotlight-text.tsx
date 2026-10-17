"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame, type ThreeEvent } from "@react-three/fiber"

type Props = {
  /** Headline revealed by the light */
  text?: string
  /** Small line under the headline */
  subtext?: string
  /** Width of the text wall in metres */
  width?: number
  /** Spotlight radius in metres */
  radius?: number
  /** Show the light cone and lamp */
  beam?: boolean
  /** Lit text and beam colour */
  primaryColor?: string
  /** Second gradient colour in the lit text */
  secondaryColor?: string
  speed?: number
  paused?: boolean
  /** Light brightness */
  intensity?: number
  /** Tap: the light flares wide, then calls this */
  onPress?: () => void
}

const FONT_STACK = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
const CW = 2048
const CH = 820
const noRaycast = () => null

/** A dark wall of text lit by a moving spotlight. The light wanders on its own and follows your pointer or fingertip; only what it touches comes alive. */
export default function SpotlightText({
  text = "Made for space",
  subtext = "MOTION COMPONENTS FOR WEBXR",
  width = 1.3,
  radius = 0.17,
  beam = true,
  primaryColor = "#9FE7D2",
  secondaryColor = "#F2B48A",
  speed = 1,
  paused = false,
  intensity = 1,
  onPress,
}: Props) {
  const height = (width * CH) / CW
  const texture = useMemo(() => buildWall(text, subtext), [text, subtext])
  useEffect(() => () => texture.dispose(), [texture])

  const u = useMemo(
    () => ({
      uMap: { value: null as THREE.Texture | null },
      uSpot: { value: new THREE.Vector2() },
      uRadius: { value: 0.17 },
      uSize: { value: new THREE.Vector2(1.3, 0.52) },
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
    }),
    [],
  )
  useEffect(() => {
    u.uA.value.set(primaryColor).convertLinearToSRGB()
    u.uB.value.set(secondaryColor).convertLinearToSRGB()
  }, [primaryColor, secondaryColor, u])

  const plane = useRef<THREE.Mesh>(null)
  const lamp = useRef<THREE.Group>(null)
  const cone = useRef<THREE.Mesh>(null)
  const s = useRef({ time: 0, target: new THREE.Vector2(), spot: new THREE.Vector2(), lastMove: 10, flare: 0 })
  const tmp = useMemo(() => ({ apex: new THREE.Vector3(), dir: new THREE.Vector3(), down: new THREE.Vector3(0, -1, 0) }), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const st = s.current
    if (!paused) st.time += dt * speed
    st.lastMove += dt
    st.flare *= Math.exp(-dt * 2.5)
    if (st.lastMove > 1.2) {
      // nobody pointing: the light wanders across the words
      st.target.set(Math.sin(st.time * 0.45) * width * 0.36, Math.sin(st.time * 0.9 + 1) * height * 0.18)
    }
    st.spot.lerp(st.target, 1 - Math.exp(-dt * (st.lastMove > 1.2 ? 3 : 9)))
    const r = radius * (1 + st.flare * 1.4)
    u.uMap.value = texture
    u.uSpot.value.copy(st.spot)
    u.uRadius.value = r
    u.uSize.value.set(width, height)
    u.uTime.value = st.time
    u.uIntensity.value = intensity * (1 + st.flare * 0.5)

    if (lamp.current && cone.current) {
      tmp.apex.set(0, height / 2 + 0.2, 0.38)
      lamp.current.position.copy(tmp.apex)
      tmp.dir.set(st.spot.x, st.spot.y, 0).sub(tmp.apex)
      const len = tmp.dir.length()
      lamp.current.quaternion.setFromUnitVectors(tmp.down, tmp.dir.normalize())
      cone.current.scale.set(r * 0.85, len, r * 0.85)
    }
  })

  const follow = (e: ThreeEvent<PointerEvent>) => {
    if (!plane.current) return
    const p = plane.current.worldToLocal(e.point.clone())
    s.current.target.set(p.x, p.y)
    s.current.lastMove = 0
  }

  const coneGeometry = useMemo(() => new THREE.ConeGeometry(1, 1, 32, 1, true).translate(0, -0.5, 0), [])
  useEffect(() => () => coneGeometry.dispose(), [coneGeometry])

  return (
    <group>
      <mesh
        ref={plane}
        onPointerOver={follow}
        onPointerMove={follow}
        onClick={() => {
          s.current.flare = 1
          onPress?.()
        }}
      >
        <planeGeometry args={[width, height]} />
        <shaderMaterial uniforms={u} vertexShader={WALL_VERT} fragmentShader={WALL_FRAG} transparent premultipliedAlpha depthWrite={false} />
      </mesh>
      {beam && (
        <group ref={lamp}>
          <mesh ref={cone} geometry={coneGeometry} raycast={noRaycast} renderOrder={2}>
            <shaderMaterial uniforms={u} vertexShader={BEAM_VERT} fragmentShader={BEAM_FRAG} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh position={[0, 0.032, 0]} raycast={noRaycast}>
            <cylinderGeometry args={[0.024, 0.032, 0.064, 24]} />
            <meshBasicMaterial color="#1B1E26" />
          </mesh>
          <mesh position={[0, -0.001, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
            <circleGeometry args={[0.03, 24]} />
            <meshBasicMaterial color={primaryColor} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  )
}

/** Packs the words into one texture: red = headline fill, green = headline outline, blue = subtext. */
function buildWall(text: string, subtext: string) {
  const canvas = document.createElement("canvas")
  canvas.width = CW
  canvas.height = CH
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, CW, CH)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.font = `800 100px ${FONT_STACK}`
  const px = Math.min(300, Math.floor((1880 / Math.max(1, ctx.measureText(text).width)) * 100))
  ctx.font = `800 ${px}px ${FONT_STACK}`
  ctx.globalCompositeOperation = "lighter"
  ctx.fillStyle = "rgb(255,0,0)"
  ctx.fillText(text, CW / 2, CH * 0.44)
  ctx.strokeStyle = "rgb(0,255,0)"
  ctx.lineWidth = Math.max(2, px * 0.012)
  ctx.strokeText(text, CW / 2, CH * 0.44)
  if (subtext) {
    ctx.font = `600 54px ${FONT_STACK}`
    ctx.letterSpacing = "12px"
    ctx.fillStyle = "rgb(0,0,255)"
    ctx.fillText(subtext, CW / 2, CH * 0.8)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  return texture
}

const WALL_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const WALL_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uSpot;
uniform float uRadius;
uniform vec2 uSize;
uniform float uTime;
uniform float uIntensity;
uniform vec3 uA;
uniform vec3 uB;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(uMap, vUv);
  vec2 p = (vUv - 0.5) * uSize;
  float d = length(p - uSpot);
  float light = exp(-d * d / (uRadius * uRadius)) * uIntensity;
  float core = smoothstep(uRadius * 1.1, uRadius * 0.2, d);
  vec3 grad = mix(uA, uB, clamp(vUv.x * 1.2 - 0.1 + 0.15 * sin(uTime * 0.5 + vUv.y * 3.0), 0.0, 1.0));
  vec3 lit = mix(grad, vec3(1.0), core * 0.35);
  float fill = t.r;
  float outline = t.g;
  float sub = t.b;
  vec3 col = vec3(0.0);
  float a = 0.0;
  col += vec3(0.85) * outline * 0.16;
  a += outline * 0.16;
  col += lit * fill * light * 1.3;
  a += fill * min(light, 1.0);
  float subA = sub * (0.07 + min(light, 1.0) * 0.9);
  col += vec3(0.95) * subA;
  a += subA;
  vec2 g = fract(p / 0.025) - 0.5;
  float dots = smoothstep(0.12, 0.05, length(g)) * light * 0.4 * (1.0 - fill);
  col += uA * dots;
  a += dots;
  col += uA * light * 0.07;
  a += light * 0.07;
  a = clamp(a, 0.0, 1.0);
  gl_FragColor = vec4(min(col, vec3(1.5)), a);
}
`

const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

const BEAM_FRAG = /* glsl */ `
uniform vec3 uA;
uniform float uIntensity;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  float along = 1.0 - vUv.y;
  float facing = pow(abs(dot(normalize(vN), normalize(-vView))), 1.5);
  float a = (0.15 + along * along) * facing * 0.16 * uIntensity;
  gl_FragColor = vec4(uA, a);
}
`
