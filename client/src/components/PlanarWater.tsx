// Harborfall — Phase 11 planar-reflection bay water (High tier only).
//
// The honest browser version of "ray-traced water": a mirrored camera
// renders the scene ONCE per frame into a half-resolution render
// target, and this surface samples that target with a projective
// texture matrix, perturbed by the same scrolling normal layers the
// Phase 5 shader water uses — so the bay mirrors the skyline, the
// bridge and the sunset instead of faking them with a fresnel gradient.
// It is the three.js Reflector technique with the render hoisted into
// useFrame, which buys three things the stock Reflector can't do here:
//   · the mirrored scene renders exactly once per frame (the stock
//     Reflector re-renders inside EVERY scene pass — the composer's
//     main pass AND the SSR G-buffer pass would each pay for it);
//   · the render is skipped entirely when the water is off-frustum;
//   · shadow maps are reused from the previous frame during the
//     mirrored pass (reflections don't need same-frame shadows).
// Everything else about the water is continuous with the shader it
// replaces on High: same plane (560×236 at y −0.02), same shore alpha
// fades, same manual fog blend, same sun-glint term — boats, swimming
// and buoyancy read the same WATER_Z / heights, so nothing that floats
// or swims can tell the difference. What reflects: the full scene
// (skyline, sky, bridges, boats, traffic) — layer restriction isn't
// possible without forking the scene graph, and the full skyline is
// the point. Cost control: half the drawing buffer (so it follows the
// Phase 8 DPR ladder), High tier only, player override in Settings.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { WATER_Z } from "../world";
import { G } from "../game/store";
import { sandNormal } from "../textures";
import type { GameTheme } from "../themes";

const WATER_Y = -0.02; // identical to the Phase 5 shader water plane

export default function PlanarWater({ theme, night }: { theme: GameTheme; night: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const meshRef = useRef<THREE.Mesh>(null);

  const rt = useMemo(() => new THREE.WebGLRenderTarget(1024, 512, {
    type: THREE.HalfFloatType, samples: 0, depthBuffer: true,
  }), []);

  const scratch = useMemo(() => ({
    virtCam: new THREE.PerspectiveCamera(),
    textureMatrix: new THREE.Matrix4(),
    reflectorPlane: new THREE.Plane(),
    normal: new THREE.Vector3(),
    reflectorWorldPosition: new THREE.Vector3(),
    cameraWorldPosition: new THREE.Vector3(),
    rotationMatrix: new THREE.Matrix4(),
    lookAtPosition: new THREE.Vector3(),
    clipPlane: new THREE.Vector4(),
    view: new THREE.Vector3(),
    target: new THREE.Vector3(),
    q: new THREE.Vector4(),
    frustum: new THREE.Frustum(),
    projView: new THREE.Matrix4(),
    waterSphere: new THREE.Sphere(new THREE.Vector3(0, 0, WATER_Z + 118), 305),
    dbSize: new THREE.Vector2(),
    sunDir: new THREE.Vector3(),
  }), []);

  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        tReflect: { value: rt.texture },
        uTextureMatrix: { value: new THREE.Matrix4() },
        uTime: { value: 0 },
        uRain: { value: 0 },
        uNight: { value: 0 },
        uDeep: { value: new THREE.Color("#0d3a4a") },
        uSunColor: { value: new THREE.Color("#ffb066") },
        uSunDir: { value: new THREE.Vector3(0.5, 0.35, 0.4) },
        uNormalMap: { value: sandNormal() },
        uFogColor: { value: new THREE.Color("#79b4c0") },
        uFogNear: { value: 60 },
        uFogFar: { value: 210 },
      },
      vertexShader: /* glsl */`
        uniform mat4 uTextureMatrix;
        varying vec3 vWorld;
        varying vec4 vUvP;
        varying float vFogDepth;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vUvP = uTextureMatrix * vec4(position, 1.0);
          vec4 mv = viewMatrix * wp;
          vFogDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uRain, uNight, uFogNear, uFogFar;
        uniform vec3 uDeep, uSunColor, uSunDir, uFogColor;
        uniform sampler2D uNormalMap, tReflect;
        varying vec3 vWorld;
        varying vec4 vUvP;
        varying float vFogDepth;
        void main() {
          vec2 uv1 = vWorld.xz * 0.045 + vec2(uTime * 0.013, uTime * 0.008);
          vec2 uv2 = vWorld.xz * 0.115 - vec2(uTime * 0.009, -uTime * 0.016);
          vec3 t1 = texture2D(uNormalMap, uv1).rgb * 2.0 - 1.0;
          vec3 t2 = texture2D(uNormalMap, uv2).rgb * 2.0 - 1.0;
          float amp = 0.38 + uRain * 0.35;
          float ripple = sin(vWorld.x * 2.3 + uTime * 2.8) * sin(vWorld.z * 1.9 - uTime * 2.3) * uRain * 0.22;
          vec3 N = normalize(vec3((t1.x + t2.x) * amp + ripple, 1.0, (t1.y + t2.y) * amp - ripple));
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(dot(viewDir, N), 0.0), 3.0);
          // planar reflection, UV perturbed by the wave normals so the
          // mirrored skyline shimmers instead of sitting mirror-still
          vec4 proj = vUvP;
          proj.xy += (t1.xy + t2.xy) * 0.055 * proj.w;
          vec3 refl = texture2DProj(tReflect, proj).rgb;
          vec3 col = mix(uDeep, refl, clamp(0.42 + fres * 0.55, 0.0, 1.0));
          vec3 rdir = reflect(-viewDir, N);
          float glint = pow(max(dot(rdir, normalize(uSunDir)), 0.0), 240.0);
          col += uSunColor * glint * 2.4;
          float a = 0.96;
          a *= smoothstep(128.0, 137.0, vWorld.z);
          vec2 dCoral = abs(vWorld.xz - vec2(70.0, 260.0)) - vec2(46.0, 70.0);
          float dOut = length(max(dCoral, 0.0));
          a *= smoothstep(0.0, 6.0, dOut);
          a *= 1.0 - smoothstep(252.0, 279.0, abs(vWorld.x));
          a *= 1.0 - smoothstep(348.0, 363.0, vWorld.z);
          float f = smoothstep(uFogNear, uFogFar, vFogDepth);
          col = mix(col, uFogColor, f);
          gl_FragColor = vec4(col, a);
        }`,
    });
    // SSR opt-out: the vendored screen-space-reflections G-buffer pass
    // reads `material.roughness` (absent on ShaderMaterial → 0 → full
    // SSR with a flat normal). The bay already has a true planar
    // reflection; an absurd roughness keeps SSR rays off this surface.
    (m as unknown as { roughness: number }).roughness = 2;
    return m;
  }, [rt]);

  useEffect(() => () => { rt.dispose(); mat.dispose(); }, [rt, mat]);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    const s = scratch;

    // ---- per-frame material state (mirrors the shader water's updates)
    const u = mat.uniforms;
    u.uTime.value = t;
    u.uRain.value = G.rainAmt;
    u.uNight.value = night;
    (u.uDeep.value as THREE.Color).set(theme.water);
    (u.uSunColor.value as THREE.Color).set(theme.sunColor);
    const ang = G.dayTime * Math.PI * 2 - Math.PI / 2;
    s.sunDir.set(Math.cos(ang) * 172, Math.max(4, Math.sin(ang) * 148), 46).normalize();
    (u.uSunDir.value as THREE.Vector3).copy(s.sunDir);
    if (scene.fog instanceof THREE.Fog) {
      (u.uFogColor.value as THREE.Color).setHex(scene.fog.color.getHex());
      u.uFogNear.value = scene.fog.near;
      u.uFogFar.value = scene.fog.far;
    }

    // ---- half-resolution target, following the DPR ladder
    gl.getDrawingBufferSize(s.dbSize);
    const tw = Math.max(256, Math.floor(s.dbSize.x * 0.5));
    const th = Math.max(256, Math.floor(s.dbSize.y * 0.5));
    if (rt.width !== tw || rt.height !== th) rt.setSize(tw, th);

    // ---- skip the mirrored render when the bay is off-frustum
    s.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    s.frustum.setFromProjectionMatrix(s.projView);
    if (!s.frustum.intersectsSphere(s.waterSphere)) return;

    // ---- mirrored camera (the Reflector derivation, incl. the
    // oblique near-plane clip so nothing below the surface leaks in)
    const virtCam = s.virtCam;
    s.reflectorWorldPosition.setFromMatrixPosition(mesh.matrixWorld);
    s.cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
    s.rotationMatrix.extractRotation(mesh.matrixWorld);
    s.normal.set(0, 0, 1).applyMatrix4(s.rotationMatrix);
    s.view.subVectors(s.reflectorWorldPosition, s.cameraWorldPosition);
    if (s.view.dot(s.normal) > 0) return; // camera under the plane — never in play, kept for safety
    s.view.reflect(s.normal).negate().add(s.reflectorWorldPosition);
    s.rotationMatrix.extractRotation(camera.matrixWorld);
    s.lookAtPosition.set(0, 0, -1).applyMatrix4(s.rotationMatrix).add(s.cameraWorldPosition);
    s.target.subVectors(s.reflectorWorldPosition, s.lookAtPosition).reflect(s.normal).negate().add(s.reflectorWorldPosition);
    virtCam.position.copy(s.view);
    virtCam.up.set(0, 1, 0).applyMatrix4(s.rotationMatrix).reflect(s.normal);
    virtCam.lookAt(s.target);
    virtCam.far = camera.far;
    virtCam.updateMatrixWorld();
    virtCam.projectionMatrix.copy(camera.projectionMatrix);

    s.textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0,
    );
    s.textureMatrix.multiply(virtCam.projectionMatrix);
    s.textureMatrix.multiply(virtCam.matrixWorldInverse);
    s.textureMatrix.multiply(mesh.matrixWorld);
    (u.uTextureMatrix.value as THREE.Matrix4).copy(s.textureMatrix);

    s.reflectorPlane.setFromNormalAndCoplanarPoint(s.normal, s.reflectorWorldPosition);
    s.reflectorPlane.applyMatrix4(virtCam.matrixWorldInverse);
    s.clipPlane.set(s.reflectorPlane.normal.x, s.reflectorPlane.normal.y, s.reflectorPlane.normal.z, s.reflectorPlane.constant);
    const pm = virtCam.projectionMatrix;
    s.q.x = (Math.sign(s.clipPlane.x) + pm.elements[8]) / pm.elements[0];
    s.q.y = (Math.sign(s.clipPlane.y) + pm.elements[9]) / pm.elements[5];
    s.q.z = -1.0;
    s.q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    s.clipPlane.multiplyScalar(2.0 / s.clipPlane.dot(s.q));
    pm.elements[2] = s.clipPlane.x;
    pm.elements[6] = s.clipPlane.y;
    pm.elements[10] = s.clipPlane.z + 1.0 - 0.003; // clipBias
    pm.elements[14] = s.clipPlane.w;

    // ---- render the mirrored scene once, reusing last frame's
    // shadow maps (autoUpdate off) and restoring all renderer state
    mesh.visible = false;
    const currentRT = gl.getRenderTarget();
    const currentShadowAuto = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(rt);
    gl.clear();
    gl.render(scene, virtCam);
    gl.setRenderTarget(currentRT);
    gl.shadowMap.autoUpdate = currentShadowAuto;
    mesh.visible = true;
  });

  return (
    <mesh ref={meshRef} position={[0, WATER_Y, WATER_Z + 118]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[560, 236]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}
