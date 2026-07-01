"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";

const TARGET = 1.7; // normalized max dimension in world units

function Model({ url }: { url: string }) {
  const outer = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
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
  const [fit, setFit] = useState({ scale: 1, offset: [0, 0, 0] as [number, number, number] });

  // Measure AFTER mount + a couple of frames, so matrixWorld and the skeleton are posed.
  // setFromObject then yields correct world bounds (Mixamo models carry a root scale that
  // is only applied once the object is in the scene graph).
  useEffect(() => {
    let id1 = 0, id2 = 0;
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
        setFit({ scale: TARGET / maxDim, offset: [center.x, center.y, center.z] });
      });
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [cloned]);

  useEffect(() => {
    if (!names.length) return;
    const a = actions[names[0]];
    a?.reset().fadeIn(0.4).play();
    return () => void a?.fadeOut(0.2);
  }, [actions, names]);

  // outer applies the normalizing scale; inner holds the model offset so its center sits at origin
  return (
    <group ref={outer} scale={fit.scale}>
      <group ref={inner} position={[-fit.offset[0], -fit.offset[1], -fit.offset[2]]}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}

export default function AvatarCanvas({ url, autoRotate = true }: { url: string; autoRotate?: boolean }) {
  return (
    <Canvas shadows camera={{ position: [0, 0, 3.2], fov: 42 }} dpr={[1, 2]}>
      <color attach="background" args={["#f4f1ea"]} />
      <ambientLight intensity={0.95} />
      <directionalLight position={[3, 5, 4]} intensity={1.9} castShadow />
      <pointLight position={[-4, 1, -2]} intensity={22} color="#2547ff" />
      <pointLight position={[4, -1, 3]} intensity={16} color="#e23b2e" />
      <Suspense fallback={null}>
        <Model key={url} url={url} />
        <ContactShadows position={[0, -0.95, 0]} opacity={0.45} scale={6} blur={2.6} far={3} />
      </Suspense>
      <OrbitControls
        makeDefault
        autoRotate={autoRotate}
        autoRotateSpeed={1.4}
        enablePan={false}
        enableZoom={false}
        target={[0, 0, 0]}
        minPolarAngle={Math.PI / 2.6}
        maxPolarAngle={Math.PI / 1.9}
      />
    </Canvas>
  );
}

useGLTF.preload("/avatars/readyplayerme.glb");
