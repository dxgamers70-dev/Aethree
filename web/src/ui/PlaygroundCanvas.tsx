"use client";

import { Component, type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { GradientTexture, Grid, Html, OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import type { WorldAgent } from "./PlaygroundViewer";

const TARGET = 1.6; // normalized max dimension (world units) so every avatar reads at a similar size
const SPACING = 3.4; // distance between agents on the ground grid

/** Keeps one unloadable avatar from blanking the whole world — renders nothing on error. */
class ModelBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Lay agents out on a centered square grid on the ground plane. */
function layout(n: number): [number, number, number][] {
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  const positions: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols - 1) / 2) * SPACING;
    const z = (row - (rows - 1) / 2) * SPACING;
    positions.push([x, 0, z]);
  }
  return positions;
}

/** Tiny deterministic PRNG (mulberry32) so scenery is stable across renders. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stylized low-poly tree: a tapered trunk under two stacked foliage cones. */
function Tree({ position, scale, hue }: { position: [number, number, number]; scale: number; hue: string }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.12, 0.18, 1, 6]} />
        <meshStandardMaterial color="#8a7355" roughness={1} />
      </mesh>
      <mesh position={[0, 1.5, 0]} castShadow>
        <coneGeometry args={[0.9, 1.5, 8]} />
        <meshStandardMaterial color={hue} roughness={1} />
      </mesh>
      <mesh position={[0, 2.35, 0]} castShadow>
        <coneGeometry args={[0.65, 1.2, 8]} />
        <meshStandardMaterial color={hue} roughness={1} />
      </mesh>
    </group>
  );
}

/** A simple block building with a slightly darker roof slab and lit windows. */
function Building({
  position,
  size,
  rotation,
  tone,
}: {
  position: [number, number, number];
  size: [number, number, number];
  rotation: number;
  tone: string;
}) {
  const [w, h, d] = size;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={tone} roughness={0.9} metalness={0.05} />
      </mesh>
      {/* roof slab */}
      <mesh position={[0, h + 0.06, 0]} castShadow>
        <boxGeometry args={[w + 0.15, 0.12, d + 0.15]} />
        <meshStandardMaterial color="#cfc7b6" roughness={1} />
      </mesh>
      {/* a strip of warm-lit windows facing the scene */}
      <mesh position={[0, h * 0.55, d / 2 + 0.01]}>
        <planeGeometry args={[w * 0.7, h * 0.6]} />
        <meshStandardMaterial
          color="#cdd7ff"
          emissive="#2547ff"
          emissiveIntensity={0.18}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

/** Builds a tileable grass texture on a canvas: a green base speckled with lighter
 *  and darker flecks + a few short blade strokes, so the ground reads as grass
 *  without any 3D geometry. Returned as a repeating THREE.CanvasTexture. */
function useGrassTexture() {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const r = rng(99);

    // base gradient — subtle variation so large tiles don't look flat
    ctx.fillStyle = "#7c9c66";
    ctx.fillRect(0, 0, size, size);

    // speckle flecks of lighter / darker green
    const flecks = ["#8fb178", "#6f9159", "#658450", "#9bbd84", "#5f8050"];
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = flecks[Math.floor(r() * flecks.length)];
      const x = r() * size;
      const y = r() * size;
      ctx.fillRect(x, y, 1 + r() * 1.5, 1 + r() * 1.5);
    }

    // short blade strokes for a hint of texture direction
    for (let i = 0; i < 700; i++) {
      ctx.strokeStyle = r() > 0.5 ? "#587646" : "#a3c58c";
      ctx.lineWidth = 0.8;
      const x = r() * size;
      const y = r() * size;
      const len = 2 + r() * 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 2, y - len);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 40);
    tex.anisotropy = 8;
    return tex;
  }, []);
}

/** Scatters trees in a mid-ground ring and a building skyline in the far ring,
 *  both leaving the centre clear for the agent grid. `clearRadius` grows with
 *  the agent count so scenery never overlaps the avatars. */
function Scenery({ clearRadius }: { clearRadius: number }) {
  const { trees, buildings } = useMemo(() => {
    const r = rng(1337);
    const treeHues = ["#7fa06b", "#6b8c5a", "#8fb178", "#5f8050"];
    const treeRing = Math.max(12, clearRadius + 4);
    const trees = Array.from({ length: 60 }, () => {
      const angle = r() * Math.PI * 2;
      const radius = treeRing + r() * 18;
      return {
        position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number],
        scale: 0.8 + r() * 0.9,
        hue: treeHues[Math.floor(r() * treeHues.length)],
      };
    });

    const tones = ["#f1ece1", "#e8e1d2", "#ece6da", "#e3dccb"];
    const buildingRing = Math.max(30, clearRadius + 22);
    const buildings = Array.from({ length: 26 }, () => {
      const angle = r() * Math.PI * 2;
      const radius = buildingRing + r() * 16;
      const w = 2.5 + r() * 3;
      return {
        position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number],
        size: [w, 5 + r() * 12, 2.5 + r() * 3] as [number, number, number],
        rotation: angle + Math.PI + (r() - 0.5) * 0.6, // roughly face the centre
        tone: tones[Math.floor(r() * tones.length)],
      };
    });
    return { trees, buildings };
  }, [clearRadius]);

  return (
    <>
      {buildings.map((b, i) => (
        <Building key={`b${i}`} {...b} />
      ))}
      {trees.map((t, i) => (
        <Tree key={`t${i}`} {...t} />
      ))}
    </>
  );
}

function AgentAvatar({
  agent,
  position,
  onEnter,
}: {
  agent: WorldAgent;
  position: [number, number, number];
  onEnter: (id: string) => void;
}) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(agent.avatar);
  const [hovered, setHovered] = useState(false);

  const cloned = useMemo(() => {
    const c = cloneSkeleton(scene);
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  const { actions, names } = useAnimations(animations, inner);
  const [fit, setFit] = useState({ scale: 1, lift: 0, offset: [0, 0, 0] as [number, number, number], labelY: 2 });

  // Measure after a couple of frames so skinned/Mixamo root scales are applied in world space.
  useEffect(() => {
    let id1 = 0,
      id2 = 0;
    id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        const obj = inner.current;
        if (!obj) return;
        obj.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(obj);
        if (box.isEmpty()) return;
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = TARGET / maxDim;
        const lift = (size.y * scale) / 2; // raise so the feet sit on the ground plane
        setFit({
          scale,
          lift,
          offset: [center.x, center.y, center.z],
          labelY: lift * 2 + 0.45,
        });
      });
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [cloned]);

  // Play the first animation clip, if any.
  useEffect(() => {
    if (!names.length) return;
    const a = actions[names[0]];
    a?.reset().fadeIn(0.4).play();
    return () => void a?.fadeOut(0.2);
  }, [actions, names]);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  const launched = agent.status === "launched";
  const accent = launched ? "#2547ff" : "#e23b2e";

  return (
    <group position={position}>
      <group
        ref={outer}
        scale={fit.scale * (hovered ? 1.06 : 1)}
        position={[0, fit.lift, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onEnter(agent.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <group ref={inner} position={[-fit.offset[0], -fit.offset[1], -fit.offset[2]]}>
          <primitive object={cloned} />
        </group>
      </group>

      {/* glow ring on the ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.9, 1.05, 48]} />
        <meshBasicMaterial color={accent} transparent opacity={hovered ? 0.9 : 0.35} side={THREE.DoubleSide} />
      </mesh>

      {/* name label */}
      <Html position={[0, fit.labelY, 0]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <div
          style={{ borderColor: hovered ? accent : "rgba(139,144,160,0.3)" }}
          className="select-none whitespace-nowrap rounded-lg border bg-void/85 px-2.5 py-1 text-center backdrop-blur"
        >
          <div className="text-[13px] font-bold leading-tight text-ink">{agent.name}</div>
          <div
            className="font-mono text-[9px] uppercase tracking-widest"
            style={{ color: accent }}
          >
            {hovered ? "enter →" : agent.status}
          </div>
        </div>
      </Html>
    </group>
  );
}

function World({ agents }: { agents: WorldAgent[] }) {
  const router = useRouter();
  const positions = useMemo(() => layout(agents.length), [agents.length]);
  const onEnter = (id: string) => router.push(`/agent/${id}`);
  const grass = useGrassTexture();

  // Radius the agent grid occupies, so scenery rings stay clear of the avatars.
  const clearRadius = useMemo(() => {
    if (!positions.length) return 6;
    const max = Math.max(...positions.map(([x, , z]) => Math.hypot(x, z)));
    return max + 4;
  }, [positions]);

  return (
    <>
      <color attach="background" args={["#ece7dc"]} />
      <fog attach="fog" args={["#e7e1d5", 20, 58]} />

      {/* gradient sky dome — a soft cool horizon band fading to warm paper at the poles */}
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[70, 32, 24]} />
        <meshBasicMaterial side={THREE.BackSide} fog={false}>
          <GradientTexture attach="map" stops={[0, 0.48, 0.55, 1]} colors={["#f6f3ec", "#e7ecfb", "#dfe6fb", "#f6f3ec"]} />
        </meshBasicMaterial>
      </mesh>

      <ambientLight intensity={0.95} />
      <hemisphereLight args={["#cdd7ff", "#e9e2d5", 0.7]} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <pointLight position={[-12, 4, -8]} intensity={45} color="#2547ff" distance={40} />
      <pointLight position={[12, 4, 8]} intensity={35} color="#e23b2e" distance={40} />

      {/* grass ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial map={grass} color="#dfe6d8" roughness={1} metalness={0} />
      </mesh>
      <Grid
        position={[0, 0.01, 0]}
        args={[200, 200]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6f9159"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#587646"
        fadeDistance={45}
        fadeStrength={2}
        infiniteGrid
      />

      <Scenery clearRadius={clearRadius} />

      {agents.map((a, i) => (
        <ModelBoundary key={a.id}>
          <Suspense fallback={null}>
            <AgentAvatar agent={a} position={positions[i]} onEnter={onEnter} />
          </Suspense>
        </ModelBoundary>
      ))}

      <OrbitControls
        makeDefault
        target={[0, 0.8, 0]}
        enablePan
        enableZoom
        minDistance={3}
        maxDistance={42}
        maxPolarAngle={Math.PI / 2.05}
      />
    </>
  );
}

export default function PlaygroundCanvas({ agents }: { agents: WorldAgent[] }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 5, 14], fov: 45 }}
      className="h-full w-full"
    >
      <World agents={agents} />
    </Canvas>
  );
}
