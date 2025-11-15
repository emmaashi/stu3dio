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

  const skinM = clay(a.skin, 0.66), hairM = clay(a.hair, 0.7), jacketM = clay(a.jacket, 0.66),
    sleeveM = clay(a.sleeve, 0.66), shirtM = clay(a.shirt, 0.64), pantsM = clay(a.pants, 0.66),
    shoeM = clay(a.shoe, 0.5), blackM = clay('#1b1820', 0.5, 0.15),
    accentM = clay(worker.glowHex, 0.4, 0.2);

  function capsule(r: number, len: number, mat: THREE.Material) {
    const g = new THREE.Group();
    g.add(cast(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24), mat)));
    const t = cast(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat)); t.position.y = len / 2; g.add(t);
    const b = cast(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat)); b.position.y = -len / 2; g.add(b);
    return g;
  }

  // legs
  [-0.34, 0.34].forEach((x) => {
    const leg = capsule(0.27, 0.5, pantsM); leg.position.set(x, -0.95, 0); group.add(leg);
    const shoe = cast(new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), shoeM));
    shoe.position.set(x, -1.28, 0.12); shoe.scale.set(1, 0.7, 1.25); group.add(shoe);
  });

  // torso
  const torso = new THREE.Group();
  torso.add(cast(new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.7, 1.05, 28), jacketM)));
  const tTop = cast(new THREE.Mesh(new THREE.SphereGeometry(0.66, 28, 18), jacketM)); tTop.position.y = 0.52; torso.add(tTop);
  const tBot = cast(new THREE.Mesh(new THREE.SphereGeometry(0.7, 28, 18), jacketM)); tBot.position.y = -0.52; torso.add(tBot);
  torso.scale.set(1.18, 1, 0.7); torso.position.y = -0.15; group.add(torso);

  // shirt placket
  const shirt = cast(new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), shirtM));
  shirt.position.set(0, -0.18, 0.5); shirt.scale.set(0.66, 1.15, 0.34); group.add(shirt);
  // lapels
  [-1, 1].forEach((s) => {
    const lap = cast(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.1), jacketM));
    lap.position.set(s * 0.22, 0.02, 0.56); lap.rotation.z = s * 0.32; group.add(lap);
  });
  // buttons
  [0.0, -0.22, -0.44].forEach((y) => {
    const btn = cast(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), clay('#2a2616', 0.5)));
    btn.position.set(0, y - 0.05, 0.66); group.add(btn);
  });

  // neck + head
  const neck = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.26, 20), skinM));
  neck.position.set(0, 0.5, 0.02); group.add(neck);
  const head = cast(new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 24), skinM));
  head.position.set(0, 1.06, 0.02); head.scale.set(1, 1.08, 0.96); group.add(head);
  const headY = 1.06;

  // ears
  [-0.58, 0.58].forEach((x) => {
    const ear = cast(new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), skinM));
    ear.position.set(x, headY, 0.0); ear.scale.set(0.7, 1, 0.8); group.add(ear);
  });

  // eyes + brows + mouth
  const white = clay('#f7f3ec', 0.5), pupil = clay('#16131b', 0.4);
  [-0.22, 0.22].forEach((x) => {
    const e = cast(new THREE.Mesh(new THREE.SphereGeometry(0.13, 22, 16), white));
    e.position.set(x, headY + 0.05, 0.52); e.scale.set(1, 1.12, 0.7); group.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), pupil);
    p.position.set(x, headY + 0.04, 0.62); group.add(p);
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), clay('#ffffff', 0.2));
    g.position.set(x + 0.03, headY + 0.09, 0.66); group.add(g);
    const brow = cast(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.06), hairM));
    brow.position.set(x, headY + 0.26, 0.5); brow.rotation.z = x > 0 ? -0.12 : 0.12; group.add(brow);
  });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 10, 18, Math.PI), clay('#7a3b34', 0.5));
  mouth.position.set(0, headY - 0.2, 0.54); mouth.rotation.set(Math.PI, 0, 0); group.add(mouth);

  // hair
  const hairCap = cast(new THREE.Mesh(new THREE.SphereGeometry(0.63, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM));
  hairCap.position.set(0, headY + 0.06, -0.02); hairCap.scale.set(1.04, 1.06, 1.06); group.add(hairCap);
  const tufts: [number, number, number][] = [
    [-0.34, 0.42, 0.42], [0, 0.5, 0.46], [0.34, 0.42, 0.42],
    [-0.5, 0.2, 0.2], [0.5, 0.2, 0.2], [-0.2, 0.5, 0.2], [0.2, 0.52, 0.18], [0, 0.36, -0.45],
  ];
  tufts.forEach(([x, y, z]) => {
    const tf = cast(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 14), hairM));
    tf.position.set(x, headY + y - 0.06, z); tf.scale.set(1, 0.85, 0.9); group.add(tf);
  });

  // glasses
  if (a.glasses) {
    const big = a.glasses === 'big';
    const tube = big ? 0.045 : 0.03;
    [-0.22, 0.22].forEach((x) => {
      const lens = new THREE.Mesh(
        big ? new THREE.BoxGeometry(0.46, 0.34, 0.06) : new THREE.TorusGeometry(0.17, tube, 12, 26),
        blackM,
      );
      lens.position.set(x, headY + 0.05, 0.6); group.add(lens);
      if (big) {
        const fr = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 12, 4), blackM);
        fr.position.set(x, headY + 0.05, 0.62); fr.rotation.z = Math.PI / 4; group.add(fr);
      }
    });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.06), blackM);
    bridge.position.set(0, headY + 0.09, 0.62); group.add(bridge);
    [-1, 1].forEach((s) => {
      const temple = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), blackM);
      temple.position.set(s * 0.46, headY + 0.08, 0.4);
      temple.rotation.set(0, 0, Math.PI / 2); temple.rotation.y = s * 0.5; group.add(temple);
    });
  }

  // flat cap
  if (a.cap === 'flat') {
    const capM = clay(a.capColor || '#1f2844', 0.62);
    const crown = cast(new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), capM,
    ));
    crown.position.set(0, headY + 0.34, -0.02); crown.scale.set(1.06, 0.7, 1.08); crown.rotation.x = -0.12; group.add(crown);
    const brim = cast(new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.05, 24, 1, false, 0, Math.PI), capM,
    ));
    brim.position.set(0, headY + 0.34, 0.5); brim.rotation.x = 0.3; brim.scale.set(1.5, 1, 1); group.add(brim);
    const btn = cast(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), capM));
    btn.position.set(0, headY + 0.55, -0.02); group.add(btn);
  } else if (a.cap === 'beret') {
    const beret = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.64, 0.2, 28), accentM));
    beret.position.set(0.1, headY + 0.52, -0.04); beret.rotation.z = -0.2; group.add(beret);
    const nub = cast(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), accentM));
    nub.position.set(0.12, headY + 0.66, -0.04); group.add(nub);
  }

  // headphones
  if (a.headphones) {
    const hpM = clay(a.headColor || worker.glowHex, 0.5, 0.1);
    const band = cast(new THREE.Mesh(
      new THREE.TorusGeometry(0.66, 0.06, 14, 36, Math.PI), clay('#15151c', 0.5),
    ));
    band.position.set(0, headY + 0.3, -0.02); group.add(band);
    [-0.66, 0.66].forEach((x) => {
      const can = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.18, 22), hpM));
      can.position.set(x, headY, 0); can.rotation.z = Math.PI / 2; group.add(can);
    });
  }

  // headset mic
  if (a.headset) {
    const ear = cast(new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), blackM));
    ear.position.set(0.6, headY, 0.04); group.add(ear);
    const boom = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 8), blackM));
    boom.position.set(0.42, headY - 0.18, 0.42); boom.rotation.set(0.5, 0, 0.7); group.add(boom);
    const tip = cast(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), blackM));
    tip.position.set(0.24, headY - 0.32, 0.56); group.add(tip);
  }

  // scarf
  if (a.scarf) {
    const [c1, c2] = a.scarf;
    const ring = cast(new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.18, 16, 30), clay(c1, 0.72)));
    ring.position.set(0, 0.54, 0.1); ring.scale.set(1.08, 0.92, 1.15); group.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.12, 12, 16), clay(c2, 0.72));
    ring2.position.set(0, 0.54, 0.13); ring2.scale.set(1.08, 0.92, 1.15); group.add(ring2);
    const knot = cast(new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), clay(c1, 0.72)));
    knot.position.set(0.04, 0.34, 0.5); group.add(knot);
    [-0.08, 0.1].forEach((x, i) => {
      const tail = cast(new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.04, 0.36, 12), clay(i ? c2 : c1, 0.72),
      ));
      tail.position.set(x, 0.12, 0.5); tail.rotation.z = x * 1.2; group.add(tail);
    });
  }

  // arms
  function arm(side: number, raised: boolean) {
    const g = new THREE.Group();
    const upper = capsule(0.17, 0.62, sleeveM); upper.position.y = -0.28; g.add(upper);
    const hand = cast(new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 14), skinM));
    hand.position.y = -0.66; g.add(hand);
    g.position.set(side * 0.82, 0.28, 0.04);
    if (raised) { g.rotation.z = side * -2.2; g.position.y = 0.42; }
    else { g.rotation.z = side * 0.32; }
    return g;
  }
  const pointL = a.pointing === 'left', pointR = a.pointing === 'right';
  const armL = arm(-1, pointL); const armR = arm(1, pointR); group.add(armL, armR);
  const addFinger = (armGrp: THREE.Group) => {
    const finger = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.22, 10), skinM));
    finger.position.set(0, -0.84, 0.04); armGrp.add(finger);
  };
  if (pointL) addFinger(armL);
  if (pointR) addFinger(armR);

  // bag
  if (a.bag) {
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.05, 10, 32, Math.PI * 1.1), clay('#15151c', 0.6),
    );
    strap.position.set(0, -0.05, 0.42); strap.rotation.set(0.1, 0, 0.5); strap.scale.set(1, 1.3, 1); group.add(strap);
    const pouch = cast(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.12), clay('#1c1c24', 0.6)));
    pouch.position.set(0.42, -0.5, 0.42); group.add(pouch);
  }

  // mug
  if (a.mug) {
    const mugGrp = new THREE.Group();
    mugGrp.add(cast(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.24, 20), clay('#efe9df', 0.5))));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 10, 18), clay('#efe9df', 0.5));
    handle.position.set(0.16, 0, 0); mugGrp.add(handle);
    const coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 18), clay('#3a241a', 0.4));
    coffee.position.y = 0.12; mugGrp.add(coffee);
    const side = a.mug === 'left' ? -1 : 1;
    mugGrp.position.set(side * 0.74, -0.42, 0.34); group.add(mugGrp);
  }

  // launchpad
  if (a.prop === 'launchpad') {
    const lp = new THREE.Group();
    lp.add(cast(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.42), clay('#15171b', 0.5))));
    const padM = clay(a.headColor || worker.glowHex, 0.4, 0.2);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.03, 0.08),
        r === 1 && c === 2 ? clay('#e8e6e2', 0.4) : padM,
      );
      pad.position.set(-0.15 + c * 0.1, 0.05, -0.11 + r * 0.11); lp.add(pad);
    }
    lp.position.set(-0.74, -0.46, 0.42); lp.rotation.set(-0.5, 0, 0.12); group.add(lp);
  }

  // megaphone
  if (a.prop === 'megaphone') {
    const megM = clay(a.megaColor || '#d23b35', 0.45, 0.05);
    const meg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.13, 0.48, 24, 1, true), megM);
    meg.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(a.megaColor || '#d23b35'), roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide,
    });
    meg.position.set(0.66, -0.16, 0.62); meg.rotation.set(1.15, 0.2, -0.5); group.add(meg);
    const ring = cast(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 10, 24), megM));
    ring.position.set(0.78, -0.02, 0.74); ring.rotation.set(1.15, 0.2, -0.5); group.add(ring);
    const grip = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 12), blackM));
    grip.position.set(0.6, -0.36, 0.5); grip.rotation.z = -0.5; group.add(grip);
  }

  // clapperboard
  if (a.clapper) {
    const cl = new THREE.Group();
    cl.add(cast(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.04), clay('#16161c', 0.5))));
    const top = cast(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.05), clay('#e8e6e2', 0.5)));
    top.position.set(0, 0.22, 0.01); top.rotation.z = -0.18; cl.add(top);
    for (let i = 0; i < 4; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.06), clay('#16161c', 0.5));
      stripe.position.set(-0.16 + i * 0.11, 0.22, 0.015); stripe.rotation.z = -0.18; cl.add(stripe);
    }
    cl.position.set(-0.72, -0.4, 0.4); cl.rotation.set(0, 0.3, 0.1); group.add(cl);
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
    const camera = new THREE.PerspectiveCamera(26, W / H, 0.1, 100);
    camera.position.set(0, 0.5, 10.6);
    camera.lookAt(0, 0.35, 0);

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
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.65;
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
