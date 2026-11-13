"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Icon } from "@/editor/icons";
import { planAtom } from "@/editor/editor-atoms";
import { buildModel, type Model } from "./model";

type Preset = "angle" | "top" | "front";
type Look = (preset: Preset) => void;

// Only way to know WebGL is there is to try to get a context
function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

// Everything inside the canvas: lights, ground, the model and the camera controls
function Scene({
  model,
  lookRef,
}: {
  model: Model;
  lookRef: React.RefObject<Look | null>;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const groundRef = useRef<THREE.Mesh>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const controlsRef = useRef<OrbitControls | null>(null);
  const framed = useRef(false);

  // Three's own OrbitControls (not drei's) so zooming feels exactly the same as before.
  // Made in an effect so strict mode's extra mount and unmount gets its own controls.
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.maxPolarAngle = Math.PI / 2 - 0.04; // stop just above the ground, never look from below
    orbit.minDistance = 2;
    orbit.maxDistance = 120;
    controlsRef.current = orbit;
    return () => orbit.dispose();
  }, [camera, gl]);

  // Damping in the controls needs an update every frame, this runs before each render
  useFrame(() => controlsRef.current?.update());

  // Camera presets, placed relative to the size of the building so any plan fits.
  // Runs after the effect above, so the controls are already there.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const look: Look = (preset) => {
      const { centre, size } = model;
      const reach = size * 1.45 + 5;
      const offset =
        preset === "top"
          ? new THREE.Vector3(0, reach * 1.25, 0.001)
          : preset === "front"
            ? new THREE.Vector3(0, reach * 0.42, reach * 1.05)
            : new THREE.Vector3(-reach * 0.62, reach * 0.72, reach * 0.78);
      controls.target.copy(centre).setY(preset === "top" ? 0 : 0.6);
      camera.position.copy(centre).add(offset);
      controls.update();
    };
    lookRef.current = look;

    // Only frame the camera the first time, so editing doesn't keep moving it
    if (!framed.current) {
      framed.current = true;
      look("angle");
    }
  }, [model, camera, gl, lookRef]);

  // The sun and its shadow box move with the building so shadows stay sharp
  useEffect(() => {
    const sun = sunRef.current;
    const ground = groundRef.current;
    if (!sun || !ground) return;
    const { centre, size } = model;
    sun.target = target;
    sun.position.set(
      centre.x - size * 0.35,
      size * 1.5 + 6,
      centre.z + size * 0.8
    );
    target.position.copy(centre);
    const reach = size * 0.9 + 3;
    Object.assign(sun.shadow.camera, {
      left: -reach,
      right: reach,
      top: reach,
      bottom: -reach,
      near: 0.5,
      far: size * 4 + 30,
    });
    sun.shadow.camera.updateProjectionMatrix();
    ground.position.set(centre.x, -0.01, centre.z);
  }, [model, target]);

  return (
    <>
      <color attach="background" args={[0xe9e4da]} />
      <hemisphereLight args={[0xffffff, 0xf1ece1, 2.3]} />
      <directionalLight
        ref={sunRef}
        args={[0xfff1dc, 1.25]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
        shadow-radius={5}
      />
      <primitive object={target} />

      {/* Invisible ground that only shows the shadows */}
      <mesh
        ref={groundRef}
        rotation-x={-Math.PI / 2}
        position-y={-0.01}
        receiveShadow
      >
        <planeGeometry args={[400, 400]} />
        <shadowMaterial color={0x1d2a44} opacity={0.16} />
      </mesh>

      <primitive object={model.group} />
    </>
  );
}

const pill =
  "flex h-[34px] items-center gap-1.5 rounded-small px-3 font-semibold text-ink transition-[background,color] duration-150 ease-naksa hover:bg-tile aria-pressed:bg-navy aria-pressed:text-on-navy";

// 3D view of the plan. Drag to turn, right drag to move, scroll to zoom.
export default function Viewer3D() {
  const plan = useAtomValue(planAtom);
  const [cut, setCut] = useState(false);
  const [furniture, setFurniture] = useState(true);
  const [supported] = useState(hasWebGL);
  const lookRef = useRef<Look | null>(null);

  // A new model whenever the plan or the toggles change
  const model = useMemo(
    () => buildModel(plan, { cutHeight: cut ? 1200 : null, furniture }),
    [plan, cut, furniture]
  );

  // WebGL memory isn't freed by the garbage collector, so free the old model
  useEffect(() => () => model.dispose(), [model]);

  if (!supported) {
    return (
      <div className="grid flex-1 place-content-center gap-1.5 p-6 text-center">
        <h2 className="text-lg font-bold">3D view is not available</h2>
        <p className="max-w-[44ch] text-muted">
          This browser could not start WebGL. The Plan and Engineer views still
          work, and so does PNG export.
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1 bg-stage">
      <div
        className="absolute inset-0 [&_canvas]:block [&_canvas]:cursor-grab [&_canvas]:touch-none [&_canvas:active]:cursor-grabbing"
        aria-label="3D view of the plan. Drag to turn, right-drag to move, scroll to zoom."
        role="img"
      >
        {/* "percentage" is Three's default PCF shadows and "flat" turns off tone mapping, same look as plain Three */}
        <Canvas
          shadows="percentage"
          flat
          dpr={Math.min(window.devicePixelRatio || 1, 2)}
          gl={{ antialias: true }}
          camera={{ fov: 38, near: 0.1, far: 500 }}
        >
          <Scene model={model} lookRef={lookRef} />
        </Canvas>
      </div>

      {plan.walls.length === 0 && (
        <p className="absolute top-1/2 left-1/2 w-[min(320px,calc(100%-32px))] -translate-1/2 text-center text-sm text-muted">
          Nothing to show yet. Draw some walls in the Plan view first.
        </p>
      )}

      <div className="absolute top-3.5 left-3.5 flex flex-wrap gap-2">
        {/* Camera presets */}
        <div
          className="flex gap-0.5 rounded-big bg-paper p-[3px] shadow-raised"
          role="group"
          aria-label="Camera"
        >
          <button
            className={pill}
            onClick={() => lookRef.current?.("angle")}
            title="Look from a corner"
          >
            <Icon name="cube" size={17} />
            Angle
          </button>
          <button
            className={pill}
            onClick={() => lookRef.current?.("top")}
            title="Look straight down"
          >
            <Icon name="plan" size={17} />
            Top
          </button>
          <button
            className={pill}
            onClick={() => lookRef.current?.("front")}
            title="Look from the front"
          >
            <Icon name="eye" size={17} />
            Front
          </button>
        </div>

        {/* What to show */}
        <div
          className="flex gap-0.5 rounded-big bg-paper p-[3px] shadow-raised"
          role="group"
          aria-label="Show"
        >
          <button
            className={pill}
            aria-pressed={cut}
            onClick={() => setCut(!cut)}
            title="Cut the walls at 1.2 m to see into every room"
          >
            <Icon name="layers" size={17} />
            Low walls
          </button>
          <button
            className={pill}
            aria-pressed={furniture}
            onClick={() => setFurniture(!furniture)}
            title="Show or hide furniture"
          >
            <Icon name="eye" size={17} />
            Furniture
          </button>
        </div>
      </div>

      <p className="pointer-events-none absolute bottom-3.5 left-1/2 -translate-x-1/2 rounded-[8px] bg-[rgba(253,252,249,0.86)] px-3 py-1.5 text-xs whitespace-nowrap text-muted max-[720px]:hidden">
        Drag to turn · Right-drag to move · Scroll to zoom
      </p>
    </div>
  );
}
