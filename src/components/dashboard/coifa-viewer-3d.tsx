'use client';

// Visualizador 3D paramétrico de coifas — baseado no protótipo
// "LEMANOX COIFAS - Gerador Paramétrico 3D", adaptado pra:
//  - ler os mesmos campos que a Calculadora já usa (não duplica formulário);
//  - desenhar a forma real de cada um dos 4 modelos (o protótipo original só
//    desenhava uma forma genérica, equivalente à Piramidal);
//  - ser só visual: nunca calcula nem decide preço, nunca escreve na tela
//    de resultado — isso continua 100% a cargo de coifa-calculator.ts.
//
// Mão de obra fixa aqui (câmera orbital, zoom, pan, vistas, raio-X, cotas em
// tela, exportar PNG) foi portada quase sem mudança do protótipo — essa
// parte já estava bem resolvida.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type CoifaViewerModelo = 'Box' | 'Piramidal' | 'Linea' | 'Tube';
export type CoifaViewerMount = 'Parede' | 'Ilha';

export interface CoifaViewer3DProps {
  modelo: CoifaViewerModelo;
  width: number;  // mm — ignorado para Tube (diâmetro sempre 500mm)
  depth: number;  // mm
  height: number; // mm
  tetoWidth?: number;  // Piramidal
  tetoDepth?: number;  // Piramidal
  carenagemWidth?: number;  // Línea — só visual, não entra no preço
  carenagemDepth?: number;  // Línea — só visual, não entra no preço
  carenagemHeight?: number; // Línea — essa sim entra no preço (ver coifa-calculator.ts)
  mount: CoifaViewerMount;
  qtdLampadas?: number;
  qtdBotoes?: number;
  className?: string;
  /** Oculta a barra de ferramentas e cotas — usado na miniatura do orçamento. */
  compact?: boolean;
}

export interface CoifaViewer3DHandle {
  /** Devolve um PNG (data URL) do frame atual — usado na impressão do orçamento. */
  capturePng: () => string | null;
}

type ShowState = { dims: boolean; edges: boolean; xray: boolean; ortho: boolean };

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

type Rect = { x0: number; x1: number; z0: number; z1: number; y: number };
const rect = (w: number, d: number, cx: number, cz: number, y: number): Rect => ({
  x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, y,
});

// Casca com 4 faces laterais entre dois retângulos (caixa ou tronco de
// pirâmide), com tampa opcional embaixo e/ou em cima.
function shellQuads(b: Rect, t: Rect, bottomCap: boolean, topCap = false): number[][][] {
  const q = [
    [[b.x0, b.y, b.z1], [b.x1, b.y, b.z1], [t.x1, t.y, t.z1], [t.x0, t.y, t.z1]],
    [[b.x1, b.y, b.z0], [b.x0, b.y, b.z0], [t.x0, t.y, t.z0], [t.x1, t.y, t.z0]],
    [[b.x1, b.y, b.z1], [b.x1, b.y, b.z0], [t.x1, t.y, t.z0], [t.x1, t.y, t.z1]],
    [[b.x0, b.y, b.z0], [b.x0, b.y, b.z1], [t.x0, t.y, t.z1], [t.x0, t.y, t.z0]],
  ];
  if (bottomCap) q.push([[b.x0, b.y, b.z0], [b.x1, b.y, b.z0], [b.x1, b.y, b.z1], [b.x0, b.y, b.z1]]);
  if (topCap) q.push([[t.x0, t.y, t.z1], [t.x1, t.y, t.z1], [t.x1, t.y, t.z0], [t.x0, t.y, t.z0]]);
  return q;
}

// Reflexos de "estúdio" gerados por código (mesma técnica do protótipo):
// sem isso o material metálico fica quase preto, já que não há o que refletir.
function makeEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.5, '#c9cfd6'); grd.addColorStop(1, '#5c636c');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
  g.fillStyle = 'rgba(255,255,255,.95)'; [40, 190, 330, 450].forEach(x => g.fillRect(x, 30, 60, 90));
  g.fillStyle = 'rgba(40,46,54,.55)'; [120, 260, 400].forEach(x => g.fillRect(x, 60, 28, 120));
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(tex).texture;
  tex.dispose(); pm.dispose();
  return env;
}
function geomFromQuads(quads: number[][][]): THREE.BufferGeometry {
  const pos: number[] = [];
  quads.forEach(q => [0, 1, 2, 0, 2, 3].forEach(i => pos.push(...q[i])));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export const CoifaViewer3D = forwardRef<CoifaViewer3DHandle, CoifaViewer3DProps>(function CoifaViewer3D(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ request: () => void; fitView: (animate?: boolean) => void; viewTo: (name: string) => void } | null>(null);
  const [show, setShow] = useState<ShowState>({ dims: !props.compact, edges: true, xray: false, ortho: false });

  // Tudo que precisa sobreviver entre renders (cena, câmera, estado de
  // órbita etc.) fica num único ref — evita recriar a cena do zero a cada
  // mudança de prop.
  const sceneRef = useRef<{
    scene: THREE.Scene;
    persp: THREE.PerspectiveCamera;
    ortho: THREE.OrthographicCamera;
    camera: THREE.Camera;
    renderer: THREE.WebGLRenderer;
    modelGroup: THREE.Group;
    dimGroup: THREE.Group;
    metalMat: THREE.MeshStandardMaterial;
    edgeMat: THREE.LineBasicMaterial;
    dimMat: THREE.LineBasicMaterial;
    lampMat: THREE.MeshStandardMaterial;
    btnMat: THREE.MeshStandardMaterial;
    edgesObj: THREE.LineSegments | null;
    labels: { el: HTMLDivElement; pos: THREE.Vector3 }[];
    theta: number; phi: number; radius: number; target: THREE.Vector3;
    animId: number; pending: boolean;
    ptrs: Map<number, { x: number; y: number }>;
    show: ShowState;
  } | null>(null);

  // ── Inicialização da cena (uma única vez) ───────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    const labelsEl = labelsRef.current;
    if (!host || !labelsEl) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4f6);
    const persp = new THREE.PerspectiveCamera(40, 1, 10, 100000);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -50000, 50000);
    // preserveDrawingBuffer: permite capturar o PNG do canvas a qualquer momento.
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const envTexture = makeEnvironment(renderer);
    scene.environment = envTexture;

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(1000, 2000, 1200); scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3); fill.position.set(-1000, -500, -800); scene.add(fill);

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xb4bac2, metalness: 0.9, roughness: 0.38, envMapIntensity: 1.1, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    const btnMat = new THREE.MeshStandardMaterial({ color: 0x2b3440, metalness: 0.3, roughness: 0.6 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd66b, emissiveIntensity: 0.8, roughness: 0.2 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x4b5563 });
    const dimMat = new THREE.LineBasicMaterial({ color: 0xc2410c, depthTest: false, transparent: true });

    const modelGroup = new THREE.Group(), dimGroup = new THREE.Group();
    scene.add(modelGroup, dimGroup);

    sceneRef.current = {
      scene, persp, ortho, camera: persp, renderer, modelGroup, dimGroup,
      metalMat, edgeMat, dimMat, lampMat, btnMat, edgesObj: null, labels: [],
      theta: 0.65, phi: 1.15, radius: 2000, target: new THREE.Vector3(0, 300, 0),
      animId: 0, pending: false, ptrs: new Map(), show,
    };

    const render = () => {
      const s = sceneRef.current;
      if (!s) return;
      s.pending = false;
      updateCamera();
      s.renderer.render(s.scene, s.camera);
      const cw = host.clientWidth, ch = host.clientHeight, v = new THREE.Vector3();
      s.labels.forEach(l => {
        v.copy(l.pos).project(s.camera);
        const sx = (v.x * 0.5 + 0.5) * cw, sy = (-v.y * 0.5 + 0.5) * ch;
        const vis = s.show.dims && v.z > -1 && v.z < 1;
        l.el.style.display = vis ? 'block' : 'none';
        if (vis) { l.el.style.left = sx + 'px'; l.el.style.top = sy + 'px'; }
      });
    };
    const request = () => { const s = sceneRef.current; if (s && !s.pending) { s.pending = true; requestAnimationFrame(render); } };
    function updateCamera() {
      const s = sceneRef.current; if (!s) return;
      const sp = Math.sin(s.phi);
      s.camera.position.set(sp * Math.sin(s.theta), Math.cos(s.phi), sp * Math.cos(s.theta)).multiplyScalar(s.radius).add(s.target);
      s.camera.up.set(0, 1, 0);
      (s.camera as THREE.PerspectiveCamera).lookAt(s.target);
      if ((s.camera as THREE.OrthographicCamera).isOrthographicCamera) {
        const oc = s.camera as THREE.OrthographicCamera;
        const hh = s.radius * Math.tan(THREE.MathUtils.degToRad(s.persp.fov / 2)), ww = hh * s.persp.aspect;
        oc.left = -ww; oc.right = ww; oc.top = hh; oc.bottom = -hh;
      }
      (s.camera as THREE.PerspectiveCamera).updateProjectionMatrix();
      s.camera.updateMatrixWorld();
    }
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h); persp.aspect = w / h; persp.updateProjectionMatrix(); request();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    function fitRadius() {
      const s = sceneRef.current; if (!s) return 2000;
      const vf = THREE.MathUtils.degToRad(s.persp.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * s.persp.aspect);
      const sphereR = new THREE.Box3().setFromObject(s.modelGroup).getBoundingSphere(new THREE.Sphere()).radius;
      return (sphereR || 500) / Math.sin(Math.min(vf, hf) / 2) * (s.show.dims ? 1.45 : 1.15);
    }
    function goTo(to: { theta: number; phi: number; radius: number; target: THREE.Vector3 }, ms: number) {
      const s = sceneRef.current; if (!s) return;
      const id = ++s.animId;
      if (!ms) { s.theta = to.theta; s.phi = to.phi; s.radius = to.radius; s.target.copy(to.target); request(); return; }
      const from = { theta: s.theta, phi: s.phi, radius: s.radius, t: s.target.clone() };
      const dth = Math.atan2(Math.sin(to.theta - s.theta), Math.cos(to.theta - s.theta)), t0 = performance.now();
      (function step(now: number) {
        const cur = sceneRef.current; if (!cur || id !== cur.animId) return;
        let k = Math.min(1, (now - t0) / ms); k = k * k * (3 - 2 * k);
        cur.theta = from.theta + dth * k; cur.phi = from.phi + (to.phi - from.phi) * k;
        cur.radius = from.radius + (to.radius - from.radius) * k; cur.target.copy(from.t).lerp(to.target, k);
        render(); if (k < 1) requestAnimationFrame(step);
      })(t0);
    }
    function fitView(animate = true) {
      const s = sceneRef.current; if (!s) return;
      const c = new THREE.Box3().setFromObject(s.modelGroup).getCenter(new THREE.Vector3());
      goTo({ theta: s.theta, phi: s.phi, radius: fitRadius(), target: c }, animate ? 350 : 0);
    }
    function viewTo(name: string) {
      const s = sceneRef.current; if (!s) return;
      if (name === 'fit') return fitView();
      const c = new THREE.Box3().setFromObject(s.modelGroup).getCenter(new THREE.Vector3());
      const views: Record<string, [number, number]> = {
        front: [0, Math.PI / 2], right: [Math.PI / 2, Math.PI / 2], top: [0, 0.001], bottom: [0, Math.PI - 0.001], iso: [Math.PI / 4, 0.955],
      };
      const [t, p] = views[name];
      goTo({ theta: t, phi: p, radius: fitRadius(), target: c }, 350);
    }

    // ── Interação (mouse / toque) ──────────────────────────────────────
    function orbit(dx: number, dy: number) {
      const s = sceneRef.current; if (!s) return;
      s.theta -= dx * 0.006; s.phi = Math.min(Math.PI - 0.001, Math.max(0.001, s.phi - dy * 0.006));
    }
    const pan = (dx: number, dy: number) => {
      const s = sceneRef.current; if (!s) return;
      const k = 2 * s.radius * Math.tan(THREE.MathUtils.degToRad(s.persp.fov / 2)) / host.clientHeight;
      const m = s.camera.matrixWorld.elements;
      s.target.add(V(m[0], m[1], m[2]).multiplyScalar(-dx * k)).add(V(m[4], m[5], m[6]).multiplyScalar(dy * k));
    };
    const onPointerDown = (e: PointerEvent) => {
      const s = sceneRef.current; if (!s) return;
      host.setPointerCapture(e.pointerId); s.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); s.animId++;
    };
    const onPointerMove = (e: PointerEvent) => {
      const s = sceneRef.current; if (!s) return;
      const p = s.ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (s.ptrs.size === 1) {
        if ((e.buttons & 6) || e.shiftKey) pan(dx, dy); else orbit(dx, dy);
      } else if (s.ptrs.size === 2) {
        const otherEntry = [...s.ptrs.entries()].find(([id]) => id !== e.pointerId);
        if (otherEntry) {
          const o = otherEntry[1];
          const d0 = Math.hypot(p.x - o.x, p.y - o.y), d1 = Math.hypot(e.clientX - o.x, e.clientY - o.y);
          if (d1 > 0) s.radius = Math.min(50000, Math.max(50, s.radius * d0 / d1));
          pan(dx / 2, dy / 2);
        }
      }
      p.x = e.clientX; p.y = e.clientY; request();
    };
    const onPointerUp = (e: PointerEvent) => { sceneRef.current?.ptrs.delete(e.pointerId); };
    const onWheel = (e: WheelEvent) => {
      const s = sceneRef.current; if (!s) return;
      e.preventDefault(); s.animId++;
      s.radius = Math.min(50000, Math.max(50, s.radius * Math.exp(e.deltaY * 0.0015))); request();
    };
    const onDblClick = () => fitView();
    const onContextMenu = (e: Event) => e.preventDefault();

    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerup', onPointerUp);
    host.addEventListener('pointercancel', onPointerUp);
    host.addEventListener('wheel', onWheel, { passive: false });
    host.addEventListener('dblclick', onDblClick);
    host.addEventListener('contextmenu', onContextMenu);

    apiRef.current = { request, fitView, viewTo };

    request();

    return () => {
      apiRef.current = null;
      ro.disconnect();
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerup', onPointerUp);
      host.removeEventListener('pointercancel', onPointerUp);
      host.removeEventListener('wheel', onWheel);
      host.removeEventListener('dblclick', onDblClick);
      host.removeEventListener('contextmenu', onContextMenu);
      modelGroup.traverse(n => { const m = n as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      dimGroup.traverse(n => { const m = n as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      metalMat.dispose(); btnMat.dispose(); lampMat.dispose(); edgeMat.dispose(); dimMat.dispose();
      envTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reconstrução da geometria quando os parâmetros mudam ────────────────
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const labelsEl = labelsRef.current;
    if (!labelsEl) return;

    const { modelGroup, dimGroup, metalMat, edgeMat, dimMat, lampMat, btnMat } = s;
    // Geometrias de cada rebuild precisam ser liberadas — senão vazam memória
    // de GPU a cada tecla digitada no formulário.
    [modelGroup, dimGroup].forEach(g => {
      g.traverse(n => { const m = n as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      g.clear();
    });
    labelsEl.innerHTML = '';
    s.labels = [];

    const addLabel = (pos: THREE.Vector3, text: string) => {
      const el = document.createElement('div');
      el.className = 'absolute -translate-x-1/2 -translate-y-1/2 bg-white/90 text-orange-900 border border-orange-600 rounded px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap pointer-events-none';
      el.textContent = text;
      labelsEl.appendChild(el);
      s.labels.push({ el, pos });
    };
    const addDimLine = (pts: THREE.Vector3[]) => {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.LineSegments(geo, dimMat);
      line.renderOrder = 10;
      dimGroup.add(line);
    };

    const { modelo, depth } = props;
    const width = modelo === 'Tube' ? 500 : props.width;
    const height = Math.max(1, props.height);
    const gap = Math.max(width, depth, height) * 0.12;

    let hullGeom: THREE.BufferGeometry;

    if (modelo === 'Tube') {
      const radius = 250; // diâmetro fixo 500mm
      hullGeom = new THREE.CylinderGeometry(radius, radius, height, 32);
      hullGeom.translate(0, height / 2, 0);
      addDimLine([V(-radius, 0, radius), V(radius, 0, radius)]);
      addLabel(V(0, -gap * 0.15, radius + gap * 0.2), 'Ø 500');
      addDimLine([V(radius, 0, 0), V(radius, height, 0)]);
      addLabel(V(radius + gap * 0.3, height / 2, 0), 'Altura ' + fmt(height));
    } else if (modelo === 'Piramidal') {
      const tw = props.tetoWidth && props.tetoWidth > 0 ? props.tetoWidth : width * 0.4;
      const td = props.tetoDepth && props.tetoDepth > 0 ? props.tetoDepth : depth * 0.7;
      const zc = props.mount === 'Parede' ? -(depth / 2 - td / 2) : 0;
      const quads = shellQuads(rect(width, depth, 0, 0, 0), rect(tw, td, 0, zc, height), true);
      hullGeom = geomFromQuads(quads);
      addDimLabelsBoxLike(width, depth, height, tw, td, zc);
    } else if (modelo === 'Linea') {
      // Corpo: caixa baixa e larga. Carenagem: segunda caixa, mais estreita,
      // subindo a partir do topo do corpo — largura/profundidade dela são só
      // estéticas (não entram no cálculo de preço, só a altura entra).
      const corpoQuads = shellQuads(rect(width, depth, 0, 0, 0), rect(width, depth, 0, 0, height), true, true);
      const cw = props.carenagemWidth && props.carenagemWidth > 0 ? props.carenagemWidth : width * 0.5;
      const cd = props.carenagemDepth && props.carenagemDepth > 0 ? props.carenagemDepth : depth * 0.5;
      const ch = props.carenagemHeight && props.carenagemHeight > 0 ? props.carenagemHeight : 0;
      const zc = props.mount === 'Parede' ? -(depth / 2 - cd / 2) : 0;
      let quads = corpoQuads;
      if (ch > 0) {
        quads = quads.concat(shellQuads(rect(cw, cd, 0, zc, height), rect(cw, cd, 0, zc, height + ch), false, true));
      }
      hullGeom = geomFromQuads(quads);
      addDimLabelsLinea(width, depth, height, ch);
    } else {
      // Box: caixa reta, sem afunilar — não existe campo de chaminé pro Box
      // no modelo de dados real.
      const quads = shellQuads(rect(width, depth, 0, 0, 0), rect(width, depth, 0, 0, height), true, true);
      hullGeom = geomFromQuads(quads);
      addDimLabelsBoxLike(width, depth, height);
    }

    const hull = new THREE.Mesh(hullGeom, metalMat);
    modelGroup.add(hull);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(hullGeom, 20), edgeMat);
    edges.visible = s.show.edges;
    modelGroup.add(edges);
    s.edgesObj = edges;

    // Botões (face frontal, na base) e lâmpadas (face inferior) — só
    // indicadores visuais da quantidade já calculada no preço, não é um
    // novo campo de entrada.
    const n = Math.max(0, Math.round(props.qtdBotoes ?? 0));
    if (n > 0 && modelo !== 'Tube') {
      const dia = Math.min(16, width / (n * 2));
      const total = n * dia + (n - 1) * (dia * 0.6);
      const x0 = -total / 2 + dia / 2;
      const bg = new THREE.CylinderGeometry(dia / 2, dia / 2, 4, 20);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(bg, btnMat);
        m.rotation.x = Math.PI / 2;
        m.position.set(x0 + i * (dia + dia * 0.6), Math.min(height, 60) / 2, depth / 2 + 1);
        modelGroup.add(m);
      }
    }
    const lampN = Math.max(0, Math.round(props.qtdLampadas ?? 0));
    if (lampN > 0 && modelo !== 'Tube') {
      const lampDia = Math.min(80, width / (lampN * 1.5));
      const lg = new THREE.CylinderGeometry(lampDia / 2, lampDia / 2, 4, 24);
      for (let j = 0; j < lampN; j++) {
        const m = new THREE.Mesh(lg, lampMat);
        m.position.set(-width / 2 + width * (j + 0.5) / lampN, -1, 0);
        modelGroup.add(m);
      }
    }

    function addDimLabelsBoxLike(w: number, d: number, h: number, tw?: number, td?: number, zc?: number) {
      const zf = d / 2;
      addDimLine([V(-w / 2, 0, zf), V(w / 2, 0, zf)]);
      addLabel(V(0, -gap * 0.15, zf + gap * 0.2), 'Largura ' + fmt(w));
      // Profundidade do lado esquerdo — do direito ela colide com a cota de altura.
      addDimLine([V(-w / 2, 0, -d / 2), V(-w / 2, 0, zf)]);
      addLabel(V(-w / 2 - gap * 0.3, -gap * 0.15, 0), 'Prof. ' + fmt(d));
      addDimLine([V(w / 2, 0, zf), V(w / 2, h, zf)]);
      addLabel(V(w / 2 + gap * 0.2, h / 2, zf), 'Altura ' + fmt(h));
      if (tw && td && zc !== undefined) {
        addLabel(V(0, h + gap * 0.1, zc), `Teto ${fmt(tw)}×${fmt(td)}`);
      }
    }
    function addDimLabelsLinea(w: number, d: number, h: number, ch: number) {
      addDimLabelsBoxLike(w, d, h);
      if (ch > 0) addLabel(V(0, h + ch / 2, 0), 'Carenagem ' + fmt(ch));
    }

    apiRef.current?.fitView(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.modelo, props.width, props.depth, props.height, props.tetoWidth, props.tetoDepth,
    props.carenagemWidth, props.carenagemDepth, props.carenagemHeight, props.mount,
    props.qtdLampadas, props.qtdBotoes,
  ]);

  // ── Aplica toggles (arestas, raio-x, ortho, cotas) ───────────────────────
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.show = show;
    if (s.edgesObj) s.edgesObj.visible = show.edges;
    s.dimGroup.visible = show.dims;
    s.metalMat.transparent = show.xray;
    s.metalMat.opacity = show.xray ? 0.3 : 1;
    s.metalMat.depthWrite = !show.xray;
    s.metalMat.needsUpdate = true;
    s.camera = show.ortho ? s.ortho : s.persp;
    apiRef.current?.request();
  }, [show]);

  useImperativeHandle(ref, () => ({
    // As cotas são HTML por cima do canvas — pra saírem na imagem (e no PDF
    // do orçamento), são redesenhadas num canvas 2D junto com o frame 3D.
    capturePng: () => {
      const s = sceneRef.current;
      const host = hostRef.current;
      if (!s || !host) return null;
      s.renderer.render(s.scene, s.camera);
      const src = s.renderer.domElement;
      const out = document.createElement('canvas');
      out.width = src.width; out.height = src.height;
      const g = out.getContext('2d');
      if (!g) return src.toDataURL('image/png');
      g.drawImage(src, 0, 0);
      const k = src.width / (host.clientWidth || src.width);
      g.font = `600 ${11 * k}px Arial`; g.textBaseline = 'middle'; g.textAlign = 'center';
      s.labels.filter(l => l.el.style.display !== 'none' && l.el.style.left).forEach(l => {
        const text = l.el.textContent || '';
        const x = parseFloat(l.el.style.left) * k, y = parseFloat(l.el.style.top) * k;
        const tw = g.measureText(text).width + 10 * k;
        g.fillStyle = 'rgba(255,255,255,.93)'; g.fillRect(x - tw / 2, y - 9 * k, tw, 18 * k);
        g.strokeStyle = '#c2410c'; g.lineWidth = k; g.strokeRect(x - tw / 2, y - 9 * k, tw, 18 * k);
        g.fillStyle = '#9a3412'; g.fillText(text, x, y);
      });
      return out.toDataURL('image/png');
    },
  }));

  return (
    <div className={cn('relative w-full h-full min-h-[280px] bg-muted/30 rounded-md overflow-hidden', props.className)}>
      <div ref={hostRef} className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none" />
      <div ref={labelsRef} className="absolute inset-0 pointer-events-none overflow-hidden" />
      {!props.compact && (
        <>
          <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[70%] z-10">
            {([['front', 'Frontal'], ['right', 'Lateral'], ['top', 'Superior'], ['iso', 'Isométrica'], ['fit', 'Ajustar']] as const).map(([v, label]) => (
              <Button key={v} type="button" size="sm" variant="secondary" className="h-6 px-2 text-[11px]" onClick={() => apiRef.current?.viewTo(v)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end max-w-[70%] z-10">
            {([['dims', 'Cotas'], ['edges', 'Arestas'], ['xray', 'Raio-X'], ['ortho', 'Ortogonal']] as const).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={show[key] ? 'default' : 'secondary'}
                className="h-6 px-2 text-[11px]"
                onClick={() => setShow(v => ({ ...v, [key]: !v[key] }))}
              >
                {label}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
});
