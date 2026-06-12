"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { WorkerData } from "@/data/crewData";

/* wardrobe per crew member */
const APPEARANCE: Record<string, {
  skin: string; hair: string; jacket: string; sleeve: string;
  shirt: string; pants: string; shoe: string;
  glasses: false | 'big' | 'small';
  cap: null | 'beret' | 'flat'; capColor?: string;
  headphones: boolean; headColor?: string;
  headset: boolean; scarf: null | string[];
  prop: null | 'megaphone' | 'launchpad'; megaColor?: string;
  clapper: boolean; pointing: null | 'left' | 'right';
  bag: boolean; mug: false | 'left' | 'right';
}> = {
  director: {
    skin: '#e7cdb4', hair: '#16161d', jacket: '#1a2138', sleeve: '#161d31',
    shirt: '#e6e3dc', pants: '#13172a', shoe: '#0f1018',
    glasses: false, cap: 'flat', capColor: '#1f2844', headphones: false, headset: true, scarf: null,
    prop: 'megaphone', megaColor: '#d23b35', clapper: true, pointing: null, mug: false, bag: false,
  },
  writer: {
    skin: '#e9d2bc', hair: '#141119', jacket: '#1d5e57', sleeve: '#19514b',
    shirt: '#e6e3dc', pants: '#14171c', shoe: '#0d0f12',
    glasses: false, cap: null, headphones: true, headColor: '#1f9bb0', headset: false, scarf: null,
    prop: 'launchpad', bag: true, pointing: null, mug: false, clapper: false,
  },
  casting: {
    skin: '#e9d6c2', hair: '#46301d', jacket: '#2c3142', sleeve: '#262b3a',
    shirt: '#6f7a39', pants: '#232838', shoe: '#14161f',
    glasses: 'big', cap: null, headphones: false, headset: false,
    scarf: ['#b22f39', '#7c1f28'], prop: null, pointing: 'left', mug: 'right', clapper: false, bag: false,
  },
};

function buildCharacter(worker: WorkerData) {
  const group = new THREE.Group();
  const a = APPEARANCE[worker.id] || APPEARANCE.director;

  const clay = (color: string, rough = 0.62, metal = 0.04) =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: metal });
  const cast = <T extends THREE.Object3D>(m: T): T => { (m as any).castShadow = true; (m as any).receiveShadow = true; return m; };

  const skinM = clay(a.skin, 0.62), hairM = clay(a.hair, 0.78), jacketM = clay(a.jacket, 0.66),
    sleeveM = clay(a.sleeve, 0.66), shirtM = clay(a.shirt, 0.62), pantsM = clay(a.pants, 0.68),
    shoeM = clay(a.shoe, 0.42, 0.06), blackM = clay('#1b1820', 0.5, 0.15),
    accentM = clay(worker.glowHex, 0.4, 0.2);

  // rounded capsule (cylinder + hemisphere caps); total height = len + 2r
  function capsule(r: number, len: number, mat: THREE.Material) {
    const g = new THREE.Group();
    g.add(cast(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24), mat)));
    const t = cast(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat)); t.position.y = len / 2; g.add(t);
    const b = cast(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat)); b.position.y = -len / 2; g.add(b);
    return g;
  }
  const sphere = (r: number, mat: THREE.Material) => cast(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mat));

  /* ---- proportions: ~6.5 heads tall, slim adult silhouette ----
     head Ø 0.84, shoulders ~1.3 wide, long tapered legs. Origin at mid-body. */
  const rH = 0.42;             // head radius
  const headY = 1.46;          // head center
  const neckY = 0.96;          // neck center
  const shoulderY = 0.74;      // shoulder joint height
  const shoulderX = 0.5;       // shoulder joint x
  const hipX = 0.22;           // leg spacing
  const footY = -1.86;

  // ===== LEGS (thigh + knee + calf + shoe) =====
  [-hipX, hipX].forEach((x) => {
    const thigh = capsule(0.165, 0.42, pantsM); thigh.position.set(x, -0.74, 0.0); group.add(thigh);
    const knee = sphere(0.155, pantsM); knee.position.set(x, -1.06, 0.02); group.add(knee);
    const calf = capsule(0.13, 0.42, pantsM); calf.position.set(x, -1.4, -0.01); group.add(calf);
    // shoe: low rounded box, longer toward the front
    const shoe = cast(new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16), shoeM));
    shoe.position.set(x, footY, 0.12); shoe.scale.set(1.0, 0.62, 1.85); group.add(shoe);
    const heel = cast(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), shoeM));
    heel.position.set(x, footY + 0.02, -0.12); group.add(heel);
  });

  // ===== PELVIS / HIPS =====
  const pelvis = sphere(0.32, pantsM);
  pelvis.position.set(0, -0.46, 0); pelvis.scale.set(1.2, 0.78, 0.82); group.add(pelvis);

  // ===== TORSO (tapered: broad chest -> narrow waist) =====
  const torso = new THREE.Group();
  const trunk = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.28, 0.92, 30), jacketM));
  trunk.position.y = 0.28; torso.add(trunk);
  const chestTop = sphere(0.38, jacketM); chestTop.position.y = 0.7; chestTop.scale.set(1, 0.72, 0.9); torso.add(chestTop);
  const waistBot = sphere(0.28, jacketM); waistBot.position.y = -0.16; torso.add(waistBot);
  torso.scale.set(1.18, 1, 0.66); group.add(torso);

  // shoulders (rounded deltoids)
  [-1, 1].forEach((s) => {
    const sh = sphere(0.21, jacketM);
    sh.position.set(s * 0.44, shoulderY, 0); sh.scale.set(1, 0.92, 0.92); group.add(sh);
  });

  // shirt placket down the chest
  const shirt = cast(new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 18), shirtM));
  shirt.position.set(0, 0.2, 0.27); shirt.scale.set(0.42, 1.5, 0.34); group.add(shirt);
  // collar
  [-1, 1].forEach((s) => {
    const col = cast(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.06), shirtM));
    col.position.set(s * 0.1, 0.56, 0.27); col.rotation.z = s * 0.5; group.add(col);
  });
  // jacket lapels
  [-1, 1].forEach((s) => {
    const lap = cast(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.56, 0.08), jacketM));
    lap.position.set(s * 0.17, 0.22, 0.3); lap.rotation.z = s * 0.3; group.add(lap);
  });
  // buttons
  [0.16, -0.04, -0.24].forEach((y) => {
    const btn = sphere(0.035, clay('#2a2616', 0.5));
    btn.position.set(0, y, 0.32); group.add(btn);
  });

  // ===== NECK + HEAD =====
  const neck = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.3, 20), skinM));
  neck.position.set(0, neckY, 0.0); group.add(neck);
  const head = cast(new THREE.Mesh(new THREE.SphereGeometry(rH, 36, 28), skinM));
  head.position.set(0, headY, 0.0); head.scale.set(0.94, 1.08, 0.98); group.add(head);
  // jaw taper
  const jaw = sphere(0.3, skinM); jaw.position.set(0, headY - 0.26, 0.04); jaw.scale.set(0.92, 0.9, 0.92); group.add(jaw);
  const faceZ = 0.40; // approx front surface of head at center

  // ears
  [-1, 1].forEach((s) => {
    const ear = sphere(0.085, skinM);
    ear.position.set(s * (rH * 0.92), headY - 0.02, 0.0); ear.scale.set(0.6, 1, 0.8); group.add(ear);
  });

  // eyes + brows + nose + mouth
  const white = clay('#f7f3ec', 0.45), pupil = clay('#16131b', 0.35);
  [-0.155, 0.155].forEach((x) => {
    const e = cast(new THREE.Mesh(new THREE.SphereGeometry(0.085, 22, 16), white));
    e.position.set(x, headY + 0.04, faceZ - 0.04); e.scale.set(1, 1.15, 0.6); group.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.046, 16, 12), pupil);
    p.position.set(x, headY + 0.03, faceZ + 0.01); group.add(p);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), clay('#ffffff', 0.15));
    gl.position.set(x + 0.02, headY + 0.07, faceZ + 0.04); group.add(gl);
    const brow = cast(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.05), hairM));
    brow.position.set(x, headY + 0.18, faceZ - 0.02); brow.rotation.z = x > 0 ? -0.1 : 0.1; group.add(brow);
  });
  // nose
  const nose = sphere(0.052, skinM); nose.position.set(0, headY - 0.04, faceZ + 0.03); nose.scale.set(0.8, 1.1, 1); group.add(nose);
  // mouth
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 10, 18, Math.PI), clay('#a65c52', 0.5));
  mouth.position.set(0, headY - 0.2, faceZ - 0.02); mouth.rotation.set(Math.PI, 0, 0); group.add(mouth);

  // ===== HAIR =====
  const hairCap = cast(new THREE.Mesh(
    new THREE.SphereGeometry(rH + 0.03, 30, 22, 0, Math.PI * 2, 0, Math.PI * 0.58), hairM));
  hairCap.position.set(0, headY + 0.04, -0.01); hairCap.scale.set(1.04, 1.08, 1.04); group.add(hairCap);
  // sideburns / fringe tufts (scaled to head)
  const tufts: [number, number, number][] = [
    [-0.24, 0.30, 0.30], [0, 0.36, 0.33], [0.24, 0.30, 0.30],
    [-0.36, 0.12, 0.14], [0.36, 0.12, 0.14], [-0.14, 0.36, 0.16], [0.14, 0.37, 0.14], [0, 0.24, -0.34],
  ];
  tufts.forEach(([x, y, z]) => {
    const tf = sphere(0.14, hairM);
    tf.position.set(x, headY + y, z); tf.scale.set(1, 0.82, 0.9); group.add(tf);
  });

  // ===== GLASSES =====
  if (a.glasses) {
    const big = a.glasses === 'big';
    [-0.155, 0.155].forEach((x) => {
      const lens = new THREE.Mesh(
        big ? new THREE.BoxGeometry(0.3, 0.24, 0.04) : new THREE.TorusGeometry(0.12, 0.022, 12, 26),
        blackM,
      );
      lens.position.set(x, headY + 0.04, faceZ + 0.02); group.add(lens);
      if (big) {
        const fr = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 12, 4), blackM);
        fr.position.set(x, headY + 0.04, faceZ + 0.03); fr.rotation.z = Math.PI / 4; group.add(fr);
      }
    });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.04), blackM);
    bridge.position.set(0, headY + 0.06, faceZ + 0.03); group.add(bridge);
    [-1, 1].forEach((s) => {
      const temple = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), blackM);
      temple.position.set(s * 0.32, headY + 0.06, 0.18);
      temple.rotation.set(0, s * 0.5, Math.PI / 2); group.add(temple);
    });
  }

  // ===== FLAT CAP =====
  if (a.cap === 'flat') {
    const capM = clay(a.capColor || '#1f2844', 0.62);
    const crown = cast(new THREE.Mesh(
      new THREE.SphereGeometry(rH + 0.04, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.52), capM));
    crown.position.set(0, headY + 0.18, -0.01); crown.scale.set(1.04, 0.7, 1.06); crown.rotation.x = -0.1; group.add(crown);
    const brim = cast(new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.04, 24, 1, false, 0, Math.PI), capM));
    brim.position.set(0, headY + 0.2, faceZ - 0.02); brim.rotation.x = 0.32; brim.scale.set(1.4, 1, 1); group.add(brim);
    const btn = sphere(0.04, capM); btn.position.set(0, headY + 0.36, -0.01); group.add(btn);
  } else if (a.cap === 'beret') {
    const beret = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.14, 28), accentM));
    beret.position.set(0.08, headY + 0.34, -0.02); beret.rotation.z = -0.2; group.add(beret);
    const nub = sphere(0.05, accentM); nub.position.set(0.1, headY + 0.44, -0.02); group.add(nub);
  }

  // ===== HEADPHONES =====
  if (a.headphones) {
    const hpM = clay(a.headColor || worker.glowHex, 0.5, 0.1);
    const band = cast(new THREE.Mesh(new THREE.TorusGeometry(rH + 0.02, 0.045, 14, 36, Math.PI), clay('#15151c', 0.5)));
    band.position.set(0, headY + 0.16, -0.01); group.add(band);
    [-1, 1].forEach((s) => {
      const can = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 22), hpM));
      can.position.set(s * (rH + 0.04), headY - 0.02, 0); can.rotation.z = Math.PI / 2; group.add(can);
      const pad = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 18), clay('#15151c', 0.6)));
      pad.position.set(s * (rH - 0.04), headY - 0.02, 0); pad.rotation.z = Math.PI / 2; group.add(pad);
    });
  }

  // ===== HEADSET MIC (earpiece on one side + boom toward mouth) =====
  if (a.headset) {
    const band = cast(new THREE.Mesh(new THREE.TorusGeometry(rH + 0.02, 0.022, 12, 30, Math.PI * 0.9), blackM));
    band.position.set(0, headY + 0.14, -0.02); band.rotation.z = -0.2; group.add(band);
    const cup = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 18), blackM));
    cup.position.set(rH + 0.02, headY - 0.04, 0.0); cup.rotation.z = Math.PI / 2; group.add(cup);
    const boom = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.42, 8), blackM));
    boom.position.set(0.3, headY - 0.18, 0.28); boom.rotation.set(0.4, 0, 0.85); group.add(boom);
    const tip = sphere(0.04, blackM); tip.position.set(0.13, headY - 0.26, 0.4); group.add(tip);
  }

  // ===== SCARF (around the neck) =====
  if (a.scarf) {
    const [c1, c2] = a.scarf;
    const ring = cast(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.1, 16, 30), clay(c1, 0.72)));
    ring.position.set(0, neckY - 0.06, 0.04); ring.scale.set(1.1, 0.85, 1.2); group.add(ring);
    const knot = sphere(0.1, clay(c1, 0.72)); knot.position.set(0.03, neckY - 0.22, 0.26); group.add(knot);
    [-0.05, 0.08].forEach((x, i) => {
      const tail = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.035, 0.34, 12), clay(i ? c2 : c1, 0.72)));
      tail.position.set(x, neckY - 0.48, 0.28); tail.rotation.z = x * 1.4; group.add(tail);
    });
  }

  // ===== ARMS (shoulder -> elbow -> forearm -> hand) =====
  // Returns { group, hand: worldPosition } so props can attach to the hand.
  function arm(side: number, mode: 'down' | 'point' | 'hold') {
    const g = new THREE.Group();
    const upper = capsule(0.12, 0.4, sleeveM); upper.position.y = -0.26; g.add(upper);
    const elbow = sphere(0.115, sleeveM); elbow.position.y = -0.5; g.add(elbow);
    const fore = capsule(0.105, 0.36, sleeveM); fore.position.y = -0.74; g.add(fore);
    const hand = sphere(0.115, skinM); hand.position.set(0, -0.98, 0.02); hand.scale.set(1, 1.15, 0.85);
    g.add(hand);
    g.position.set(side * shoulderX, shoulderY, 0.02);
    if (mode === 'point') { g.rotation.z = side * -1.7; g.rotation.x = -0.5; g.position.y = shoulderY - 0.05; }
    else if (mode === 'hold') { g.rotation.z = side * 0.18; g.rotation.x = -0.9; }
    else { g.rotation.z = side * 0.12; }
    return g;
  }
  const pointL = a.pointing === 'left', pointR = a.pointing === 'right';
  const armL = arm(-1, pointL ? 'point' : 'down');
  const armR = arm(1, pointR ? 'point' : 'down');
  group.add(armL, armR);
  const addFinger = (armGrp: THREE.Group) => {
    const finger = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.2, 10), skinM));
    finger.position.set(0, -1.14, 0.04); armGrp.add(finger);
  };
  if (pointL) addFinger(armL);
  if (pointR) addFinger(armR);

  // ===== MESSENGER BAG (strap across chest + pouch at hip) =====
  if (a.bag) {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 10, 32, Math.PI * 1.05), clay('#15151c', 0.6));
    strap.position.set(0, 0.06, 0.26); strap.rotation.set(0.1, 0, 0.6); strap.scale.set(1, 1.35, 1); group.add(strap);
    const pouch = cast(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.12), clay('#1c1c24', 0.6)));
    pouch.position.set(0.4, -0.42, 0.28); pouch.rotation.y = -0.2; group.add(pouch);
  }

  // ===== MUG (held low at the hip on one side) =====
  if (a.mug) {
    const mugGrp = new THREE.Group();
    mugGrp.add(cast(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.2, 20), clay('#efe9df', 0.5))));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 10, 18), clay('#efe9df', 0.5));
    handle.position.set(0.13, 0, 0); mugGrp.add(handle);
    const coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.02, 18), clay('#3a241a', 0.4));
    coffee.position.y = 0.1; mugGrp.add(coffee);
    const side = a.mug === 'left' ? -1 : 1;
    mugGrp.position.set(side * 0.5, -0.34, 0.34); group.add(mugGrp);
  }

  // ===== LAUNCHPAD (held in left hand) =====
  if (a.prop === 'launchpad') {
    const lp = new THREE.Group();
    lp.add(cast(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.36), clay('#15171b', 0.5))));
    const padM = clay(a.headColor || worker.glowHex, 0.4, 0.2);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.025, 0.07),
        r === 1 && c === 2 ? clay('#e8e6e2', 0.4) : padM,
      );
      pad.position.set(-0.13 + c * 0.087, 0.045, -0.095 + r * 0.095); lp.add(pad);
    }
    lp.position.set(-0.5, -0.34, 0.42); lp.rotation.set(-0.55, 0, 0.12); group.add(lp);
  }

  // ===== MEGAPHONE (raised in right hand toward mouth) =====
  if (a.prop === 'megaphone') {
    const horn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.1, 0.4, 24, 1, true),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(a.megaColor || '#d23b35'), roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide,
      }),
    );
    const megM = clay(a.megaColor || '#d23b35', 0.45, 0.05);
    horn.position.set(0.42, 0.28, 0.5); horn.rotation.set(1.2, 0.3, -0.7); group.add(horn);
    const lip = cast(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 10, 24), megM));
    lip.position.set(0.52, 0.42, 0.62); lip.rotation.set(1.2, 0.3, -0.7); group.add(lip);
    const grip = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 12), blackM));
    grip.position.set(0.36, 0.12, 0.42); grip.rotation.z = -0.5; group.add(grip);
    // raise the right arm to hold it
    armR.rotation.set(-1.0, 0, 0.5);
  }

  // ===== CLAPPERBOARD (held low in left hand) =====
  if (a.clapper) {
    const cl = new THREE.Group();
    cl.add(cast(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.035), clay('#16161c', 0.5))));
    const top = cast(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.045), clay('#e8e6e2', 0.5)));
    top.position.set(0, 0.2, 0.01); top.rotation.z = -0.18; cl.add(top);
    for (let i = 0; i < 4; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.05), clay('#16161c', 0.5));
      stripe.position.set(-0.14 + i * 0.095, 0.2, 0.015); stripe.rotation.z = -0.18; cl.add(stripe);
    }
    cl.position.set(-0.56, -0.34, 0.42); cl.rotation.set(0.1, 0.35, 0.12); group.add(cl);
  }

  group.userData.body = torso;
  return group;
}

export default function CinematicChar3D({
  worker,
  interactive = true,
  bloom = 1,
}: {
  worker: WorkerData;
  interactive?: boolean;
  bloom?: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    targetY: number; targetX: number; curY: number; curX: number;
    dragging: boolean; lastX: number; lastY: number; vel: number;
  }>({
    targetY: -0.2, targetX: 0, curY: -0.2, curX: 0,
    dragging: false, lastX: 0, lastY: 0, vel: 0.0016,
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const W = mount.clientWidth || 400, H = mount.clientHeight || 600;
    const camera = new THREE.PerspectiveCamera(25, W / H, 0.1, 100);
    camera.position.set(0, 0.12, 11.2);
    camera.lookAt(0, -0.04, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    (renderer as any).outputEncoding = 3001; // THREE.sRGBEncoding
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab';

    // lighting
    scene.add(new THREE.AmbientLight(0x9aa0b5, 0.55));
    const hemi = new THREE.HemisphereLight(0xbfd0ff, 0x140f1c, 0.5); scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(5, 6, 5); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1; key.shadow.camera.far = 20; scene.add(key);
    const rim = new THREE.PointLight(new THREE.Color(worker.glowHex), 1.5 * bloom, 13);
    rim.position.set(-3.4, 2.2, -2.2); scene.add(rim);
    const fill = new THREE.PointLight(new THREE.Color(worker.hex), 0.55 * bloom, 12);
    fill.position.set(3, -0.5, 3); scene.add(fill);

    // character
    const char = buildCharacter(worker);
    char.scale.setScalar(1.0);
    scene.add(char);

    // contact shadow plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.ShadowMaterial({ opacity: 0.32 }),
    );
    ground.rotation.x = -Math.PI / 2; ground.position.y = -2.0;
    ground.receiveShadow = true; scene.add(ground);

    const st = stateRef.current;
    st.targetY = -0.2; st.targetX = 0; st.curY = -0.2; st.curX = 0;
    st.dragging = false; st.vel = reduce ? 0 : 0.0016;

    // interaction
    const el = renderer.domElement;
    const down = (e: PointerEvent) => {
      if (!interactive) return;
      st.dragging = true; st.lastX = e.clientX; st.lastY = e.clientY;
      el.style.cursor = 'grabbing'; el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!st.dragging) return;
      const dx = e.clientX - st.lastX, dy = e.clientY - st.lastY;
      st.targetY += dx * 0.01;
      st.targetX = Math.max(-0.5, Math.min(0.5, st.targetX + dy * 0.006));
      st.lastX = e.clientX; st.lastY = e.clientY; st.vel = dx * 0.0006;
    };
    const up = (e: PointerEvent) => {
      st.dragging = false; el.style.cursor = 'grab';
      try { el.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    };
    if (interactive) {
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    }

    let raf: number;
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      if (!st.dragging) st.targetY += st.vel;
      st.curY += (st.targetY - st.curY) * 0.12;
      st.curX += (st.targetX - st.curX) * 0.12;
      char.rotation.y = st.curY; char.rotation.x = st.curX;
      char.position.y = reduce ? 0 : Math.sin(t * 1.1) * 0.06;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      if (interactive) {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      }
      renderer.dispose();
      scene.traverse((o) => {
        if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
        const mat = (o as THREE.Mesh).material;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((m) => m.dispose());
      });
      if (el.parentNode) el.parentNode.removeChild(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker.id, interactive, bloom]);

  return <div ref={mountRef} className="char3d" />;
}
