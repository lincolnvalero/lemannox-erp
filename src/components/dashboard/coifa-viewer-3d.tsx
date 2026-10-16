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
import { Eye, SlidersHorizontal } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { planejarFuros, resumoFuros, type PosicaoLampadas, type PosicaoComando } from '@/lib/coifa-furos';
import type { TipoControle } from '@/lib/coifa-calculator';

export type CoifaViewerModelo = 'Box' | 'Piramidal' | 'Linea' | 'Tube';
export type CoifaViewerMount = 'Parede' | 'Ilha';

export interface CoifaViewer3DProps {
  modelo: CoifaViewerModelo;
  width: number;  // mm — ignorado para Tube (diâmetro sempre 500mm)
  depth: number;  // mm
  height: number; // mm
  tetoWidth?: number;  // Piramidal
  tetoDepth?: number;  // Piramidal
  carenagemWidth?: number;  // Línea e Piramidal — só visual, não entra no preço
  carenagemDepth?: number;  // Línea e Piramidal — só visual, não entra no preço
  carenagemHeight?: number; // Línea e Piramidal — essa sim entra no preço (ver coifa-calculator.ts)
  mount: CoifaViewerMount;
  qtdLampadas?: number;
  qtdBotoes?: number;
  /** Botões avulsos ou botoeira (placa com 5 botões). Padrão: botoeira. */
  controle?: TipoControle;
  /** Instalação em Parede: lâmpadas na frente (padrão) ou junto à parede. Na Ilha, metade/metade. */
  posicaoLampadas?: PosicaoLampadas;
  /** Onde ficam os botões/botoeira: frente ou embaixo × esquerda/centro/direita. Padrão: frente-centro. */
  posicaoComando?: PosicaoComando;
  /** Nome do material (ex: "Inox 430", "Carbono") — muda a aparência: inox escovado x carbono pintado. */
  material?: string;
  filtro?: 'nenhum' | 'aluminio' | 'inercial_430' | 'inercial_304';
  coletor?: 'nenhum' | 'simples' | 'duplo';
  frisoFrente?: boolean;
  frisoLD?: boolean;
  frisoLE?: boolean;
  frisoLinhas?: number;
  className?: string;
  /**
   * Modo embutido (prévia do orçamento): a roda do mouse só dá zoom depois de
   * clicar no desenho, e o arrasto vertical no celular rola a página — senão o
   * visualizador "sequestra" a rolagem de quem só está lendo o orçamento.
   */
  embedded?: boolean;
  /** Chamado (com atraso curto) sempre que o desenho muda de ângulo ou forma. */
  onViewChange?: () => void;
}

// Limite de marcadores desenhados — protege contra digitação errada (ex: 1000
// lâmpadas) travando a aba com milhares de objetos 3D.
const MAX_MARCADORES = 50;

export interface CoifaViewer3DHandle {
  /** Devolve um PNG (data URL) do frame atual — usado na impressão do orçamento. */
  capturePng: () => string | null;
}

type ShowState = { dims: boolean; edges: boolean; xray: boolean; ortho: boolean; chapas: boolean; furos: boolean };

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

type Rect = { x0: number; x1: number; z0: number; z1: number; y: number };
const rect = (w: number, d: number, cx: number, cz: number, y: number): Rect => ({
  x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, y,
});

// Faces nomeadas da casca entre dois retângulos (caixa ou tronco de
// pirâmide). Nomeadas pra cada face poder ir pro grupo de chapa certo
// (frente/laterais = chapa 22; costas/teto = chapa 24), igual ao cálculo.
type Quad = number[][];
type Faces = { front: Quad; back: Quad; right: Quad; left: Quad; bottom: Quad; top: Quad };
function shellFaces(b: Rect, t: Rect): Faces {
  return {
    front: [[b.x0, b.y, b.z1], [b.x1, b.y, b.z1], [t.x1, t.y, t.z1], [t.x0, t.y, t.z1]],
    back: [[b.x1, b.y, b.z0], [b.x0, b.y, b.z0], [t.x0, t.y, t.z0], [t.x1, t.y, t.z0]],
    right: [[b.x1, b.y, b.z1], [b.x1, b.y, b.z0], [t.x1, t.y, t.z0], [t.x1, t.y, t.z1]],
    left: [[b.x0, b.y, b.z0], [b.x0, b.y, b.z1], [t.x0, t.y, t.z1], [t.x0, t.y, t.z0]],
    bottom: [[b.x0, b.y, b.z0], [b.x1, b.y, b.z0], [b.x1, b.y, b.z1], [b.x0, b.y, b.z1]],
    top: [[t.x0, t.y, t.z1], [t.x1, t.y, t.z1], [t.x1, t.y, t.z0], [t.x0, t.y, t.z0]],
  };
}
// Seção da casca na altura y (interpola entre a base e o topo — serve pro
// tronco da Piramidal, onde as faces são inclinadas).
function secao(b: Rect, t: Rect, y: number): Rect {
  const k = t.y === b.y ? 0 : (y - b.y) / (t.y - b.y);
  const l = (a: number, c: number) => a + (c - a) * k;
  return { x0: l(b.x0, t.x0), x1: l(b.x1, t.x1), z0: l(b.z0, t.z0), z1: l(b.z1, t.z1), y };
}
// Faixa horizontal (friso) numa face, entre as alturas ya e yb.
function faixa(b: Rect, t: Rect, face: 'front' | 'right' | 'left', ya: number, yb: number): Quad {
  return shellFaces(secao(b, t, ya), secao(b, t, yb))[face];
}

// Tampa horizontal (teto) com um recorte retangular — o vão onde a carenagem
// se encaixa. Devolve as faixas que sobram em volta do recorte (a Línea tem o
// teto igual a L×P, com o recorte ao centro na Ilha e no fundo na Parede).
function tampaComRecorte(t: Rect, corte: Rect): Quad[] {
  const c = {
    x0: Math.max(t.x0, corte.x0), x1: Math.min(t.x1, corte.x1),
    z0: Math.max(t.z0, corte.z0), z1: Math.min(t.z1, corte.z1),
  };
  const y = t.y;
  const faixa = (x0: number, x1: number, z0: number, z1: number): Quad[] =>
    x1 - x0 > 0.5 && z1 - z0 > 0.5 ? [[[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]]] : [];
  return [
    ...faixa(t.x0, t.x1, c.z1, t.z1),       // frente
    ...faixa(t.x0, t.x1, t.z0, c.z0),       // fundo
    ...faixa(t.x0, c.x0, c.z0, c.z1),       // esquerda
    ...faixa(c.x1, t.x1, c.z0, c.z1),       // direita
  ];
}

// Cores do modo "Chapas" — as mesmas da legenda.
const COR_CHAPA_22 = 0x5b8fd6;
const COR_CHAPA_24 = 0xe39b45;
const HEX_22 = '#5b8fd6';
const HEX_24 = '#e39b45';
const LEGENDA_CHAPAS: Record<CoifaViewerModelo, [string, string]> = {
  Box: ['Chapa 22 — frente e laterais', 'Chapa 24 — costas e teto'],
  Piramidal: ['Chapa 22 — frente e laterais', 'Chapa 24 — costas, teto e carenagem'],
  Linea: ['Chapa 22 — corpo', 'Chapa 24 — carenagem'],
  Tube: ['Chapa 22 — tampas', 'Chapa 24 — corpo'],
};

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
// ESCALA_TEXTURA: um "ladrilho" da textura de aço escovado a cada 250mm.
const ESCALA_TEXTURA = 250;

function geomFromQuads(quads: number[][][]): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  quads.forEach(q => {
    // Mapeamento plano pelo eixo dominante da normal: as "escovadas" ficam
    // sempre na horizontal (u = eixo horizontal da face), como no aço real.
    const [a, b, c] = q;
    const n = [
      (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ].map(Math.abs);
    const eixo = n[0] >= n[1] && n[0] >= n[2] ? 0 : n[1] >= n[2] ? 1 : 2;
    [0, 1, 2, 0, 2, 3].forEach(i => {
      const p = q[i];
      pos.push(...p);
      uv.push(...(eixo === 0 ? [p[2], p[1]] : eixo === 1 ? [p[0], p[2]] : [p[0], p[1]]).map(v => v / ESCALA_TEXTURA));
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// Textura de aço escovado (fios finos na horizontal), gerada por código.
function makeEscovadoTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, 256, 256);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let y = 0; y < 256; y++) {
    const l = 120 + Math.floor(rnd() * 90);
    g.fillStyle = `rgb(${l},${l},${l})`; g.fillRect(0, y, 256, 1);
  }
  // Fios mais longos/claros por cima, pra quebrar a regularidade.
  for (let i = 0; i < 140; i++) {
    const l = 150 + Math.floor(rnd() * 100);
    g.fillStyle = `rgba(${l},${l},${l},0.35)`;
    g.fillRect(Math.floor(rnd() * 256), Math.floor(rnd() * 256), 20 + Math.floor(rnd() * 120), 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Fundo em degradê claro (mais "vitrine" que o cinza chapado).
function makeFundoTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#dde2e8');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type MateriaisCasca = {
  hullMeshes: THREE.Mesh[];
  show: ShowState;
  carbono: boolean;
  metalMat: THREE.MeshStandardMaterial;
  carbonoMat: THREE.MeshStandardMaterial;
  chapa22Mat: THREE.MeshStandardMaterial;
  chapa24Mat: THREE.MeshStandardMaterial;
};
// Decide o material de cada parte da casca: aparência real (inox escovado
// ou carbono pintado) ou, no modo "Chapas", a cor do grupo de chapa.
function aplicarMateriais(s: MateriaisCasca) {
  const base = s.carbono ? s.carbonoMat : s.metalMat;
  s.hullMeshes.forEach(m => {
    if (m.userData.tube) {
      // Cilindro: grupo 0 = corpo (chapa 24), 1 e 2 = tampas (chapa 22).
      m.material = s.show.chapas ? [s.chapa24Mat, s.chapa22Mat, s.chapa22Mat] : base;
    } else if (s.show.chapas && m.userData.grupo === '22') m.material = s.chapa22Mat;
    else if (s.show.chapas && m.userData.grupo === '24') m.material = s.chapa24Mat;
    else m.material = base;
  });
  [s.metalMat, s.carbonoMat, s.chapa22Mat, s.chapa24Mat].forEach(mat => {
    mat.transparent = s.show.xray;
    mat.opacity = s.show.xray ? 0.3 : 1;
    mat.depthWrite = !s.show.xray;
    mat.needsUpdate = true;
  });
}

export const CoifaViewer3D = forwardRef<CoifaViewer3DHandle, CoifaViewer3DProps>(function CoifaViewer3D(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ request: () => void; fitView: (animate?: boolean) => void; viewTo: (name: string) => void } | null>(null);
  // No orçamento (embutido) as cotas começam desligadas: elas cobrem detalhes das peças e as medidas já estão escritas abaixo da imagem.
  const [show, setShow] = useState<ShowState>({ dims: !props.embedded, edges: true, xray: false, ortho: false, chapas: false, furos: false });
  const [estreito, setEstreito] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [webglIndisponivel, setWebglIndisponivel] = useState(false);
  const [ativo, setAtivo] = useState(false);
  // Callback mais recente sem precisar recriar a cena quando ele muda.
  const onViewChangeRef = useRef(props.onViewChange);
  onViewChangeRef.current = props.onViewChange;
  const embeddedRef = useRef(props.embedded);
  embeddedRef.current = props.embedded;

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
    carbonoMat: THREE.MeshStandardMaterial;
    chapa22Mat: THREE.MeshStandardMaterial;
    chapa24Mat: THREE.MeshStandardMaterial;
    frisoMat: THREE.MeshStandardMaterial;
    filtroMat: THREE.MeshStandardMaterial;
    coletorMat: THREE.MeshStandardMaterial;
    hullMeshes: THREE.Mesh[];
    carbono: boolean;
    escovadoTex: THREE.Texture;
    edgeMat: THREE.LineBasicMaterial;
    dimMat: THREE.LineBasicMaterial;
    lampMat: THREE.MeshStandardMaterial;
    btnMat: THREE.MeshStandardMaterial;
    edgesObj: THREE.LineSegments | null;
    labels: { el: HTMLDivElement; pos: THREE.Vector3; furos?: boolean }[];
    theta: number; phi: number; radius: number; target: THREE.Vector3;
    animId: number; pending: boolean;
    ptrs: Map<number, { x: number; y: number }>;
    show: ShowState;
    ativo: boolean;
  } | null>(null);

  // ── Inicialização da cena (uma única vez) ───────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    const labelsEl = labelsRef.current;
    if (!host || !labelsEl) return;

    const scene = new THREE.Scene();
    const fundoTex = makeFundoTexture();
    const escovadoTex = makeEscovadoTexture();
    scene.background = fundoTex;
    const persp = new THREE.PerspectiveCamera(40, 1, 10, 100000);
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -50000, 50000);
    // Sem WebGL (aceleração desligada, acesso remoto, GPU bloqueada) o
    // construtor lança erro — sem esse try, a prévia do orçamento inteira
    // quebraria por causa de um desenho ilustrativo.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setWebglIndisponivel(true);
      return;
    }
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
    // Polygon offset em todos os materiais da casca: frisos e filtro são
    // desenhados rente às faces e precisam ganhar a disputa de profundidade.
    const offset = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, side: THREE.DoubleSide } as const;
    // Aço carbono sai pintado (fosco, escuro) — não brilha como inox.
    const carbonoMat = new THREE.MeshStandardMaterial({ color: 0x4b525c, metalness: 0.25, roughness: 0.6, ...offset });
    const chapa22Mat = new THREE.MeshStandardMaterial({ color: COR_CHAPA_22, metalness: 0.35, roughness: 0.45, ...offset });
    const chapa24Mat = new THREE.MeshStandardMaterial({ color: COR_CHAPA_24, metalness: 0.35, roughness: 0.45, ...offset });
    // Friso brilhante (aço polido) em contraste com o corpo escovado.
    const frisoMat = new THREE.MeshStandardMaterial({ color: 0xeef1f5, metalness: 1, roughness: 0.08, envMapIntensity: 1.5, side: THREE.DoubleSide });
    const filtroMat = new THREE.MeshStandardMaterial({ color: 0x9aa1aa, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide });
    const coletorMat = new THREE.MeshStandardMaterial({ color: 0x7c848f, metalness: 0.7, roughness: 0.4 });
    const btnMat = new THREE.MeshStandardMaterial({ color: 0x2b3440, metalness: 0.3, roughness: 0.6 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd66b, emissiveIntensity: 0.8, roughness: 0.2 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x4b5563 });
    const dimMat = new THREE.LineBasicMaterial({ color: 0xc2410c, depthTest: false, transparent: true });

    const modelGroup = new THREE.Group(), dimGroup = new THREE.Group();
    scene.add(modelGroup, dimGroup);

    sceneRef.current = {
      scene, persp, ortho, camera: persp, renderer, modelGroup, dimGroup,
      metalMat, carbonoMat, chapa22Mat, chapa24Mat, frisoMat, filtroMat, coletorMat, hullMeshes: [], carbono: false, escovadoTex,
      edgeMat, dimMat, lampMat, btnMat, edgesObj: null, labels: [],
      theta: 0.65, phi: 1.15, radius: 2000, target: new THREE.Vector3(0, 300, 0),
      animId: 0, pending: false, ptrs: new Map(), show, ativo: false,
    };

    let notifyTimer: ReturnType<typeof setTimeout> | undefined;
    const render = () => {
      const s = sceneRef.current;
      if (!s) return;
      s.pending = false;
      if (notifyTimer) clearTimeout(notifyTimer);
      notifyTimer = setTimeout(() => onViewChangeRef.current?.(), 400);
      updateCamera();
      s.renderer.render(s.scene, s.camera);
      const cw = host.clientWidth, ch = host.clientHeight, v = new THREE.Vector3();
      s.labels.forEach(l => {
        v.copy(l.pos).project(s.camera);
        const sx = (v.x * 0.5 + 0.5) * cw, sy = (-v.y * 0.5 + 0.5) * ch;
        const vis = s.show.dims && (!l.furos || s.show.furos) && v.z > -1 && v.z < 1;
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
      s.ativo = true; setAtivo(true);
      host.setPointerCapture(e.pointerId); s.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); s.animId++;
    };
    const onPointerLeave = () => {
      const s = sceneRef.current;
      if (s && s.ptrs.size === 0) { s.ativo = false; setAtivo(false); }
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
      // No modo embutido, sem clicar antes, a roda rola a página normalmente.
      if (embeddedRef.current && !s.ativo) return;
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
    host.addEventListener('pointerleave', onPointerLeave);

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
      host.removeEventListener('pointerleave', onPointerLeave);
      if (notifyTimer) clearTimeout(notifyTimer);
      modelGroup.traverse(n => { const m = n as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      dimGroup.traverse(n => { const m = n as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      [metalMat, carbonoMat, chapa22Mat, chapa24Mat, frisoMat, filtroMat, coletorMat, btnMat, lampMat, edgeMat, dimMat].forEach(m => m.dispose());
      envTexture.dispose(); fundoTex.dispose(); escovadoTex.dispose();
      renderer.dispose();
      // Libera o contexto WebGL na hora — o navegador só aceita ~16 abertos,
      // e a prévia do orçamento monta/desmonta os visualizadores ao trocar de aba.
      renderer.forceContextLoss();
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

    const { modelGroup, dimGroup, metalMat, edgeMat, dimMat, lampMat, btnMat, frisoMat } = s;
    // Geometrias de cada rebuild precisam ser liberadas — senão vazam memória
    // de GPU a cada tecla digitada no formulário.
    [modelGroup, dimGroup].forEach(g => {
      g.traverse(n => { const m = n as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      g.clear();
    });
    labelsEl.innerHTML = '';
    s.labels = [];

    const addLabel = (pos: THREE.Vector3, text: string, furos = false) => {
      const el = document.createElement('div');
      el.className = 'absolute -translate-x-1/2 -translate-y-1/2 bg-white/80 text-orange-900 border border-orange-600/70 rounded px-1 py-px text-[10px] font-semibold whitespace-nowrap pointer-events-none';
      el.textContent = text;
      labelsEl.appendChild(el);
      s.labels.push({ el, pos, furos });
    };
    const addDimLine = (pts: THREE.Vector3[]) => {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.LineSegments(geo, dimMat);
      line.renderOrder = 10;
      dimGroup.add(line);
    };

    const { modelo, depth } = props;
    // Tube: `width` é o diâmetro (500mm quando vem da Calculadora; itens antigos podem ter outro).
    const width = modelo === 'Tube' ? (props.width > 0 ? props.width : 500) : props.width;
    const height = Math.max(1, props.height);
    const gap = Math.max(width, depth, height) * 0.12;

    // Casca separada por grupo de chapa, igual ao cálculo de custo:
    // Box/Piramidal — frente+laterais = chapa 22; costas+teto = chapa 24.
    // Línea — corpo = chapa 22; carenagem = chapa 24. Tube — tampas = 22, corpo = 24.
    // "base" = fundo, que não é chapa do cálculo (só fecha o desenho).
    type Grupo = '22' | '24' | 'base';
    const partes: Record<Grupo, Quad[]> = { '22': [], '24': [], base: [] };
    s.hullMeshes = [];
    s.carbono = /carbono/i.test(props.material ?? '');
    // Inox sempre escovado (a fábrica não faz coifa de inox brilhante): fios
    // finos e reflexo difuso. Só os frisos são brilhantes.
    metalMat.color.setHex(0xc6cbd2); metalMat.metalness = 0.95; metalMat.roughness = 0.62; metalMat.envMapIntensity = 1.1;
    metalMat.roughnessMap = s.escovadoTex; metalMat.bumpMap = s.escovadoTex; metalMat.bumpScale = 0.35;
    metalMat.needsUpdate = true;
    const todas: Quad[] = [];
    let corpoBase: Rect | null = null, corpoTopo: Rect | null = null; // onde vão frisos/filtro

    if (modelo === 'Tube') {
      const radius = width / 2;
      const geo = new THREE.CylinderGeometry(radius, radius, height, 48);
      geo.translate(0, height / 2, 0);
      // Textura de aço escovado em escala real (u = volta do cilindro, v = altura).
      const uvT = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uvT.count; i++) uvT.setXY(i, uvT.getX(i) * Math.PI * width / ESCALA_TEXTURA, uvT.getY(i) * height / ESCALA_TEXTURA);
      // Grupos do CylinderGeometry: 0 = lateral (corpo), 1 = topo, 2 = base (tampas).
      const tube = new THREE.Mesh(geo, metalMat);
      tube.userData.tube = true;
      modelGroup.add(tube);
      s.hullMeshes.push(tube);
      const edgesTube = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat);
      edgesTube.visible = s.show.edges;
      modelGroup.add(edgesTube);
      s.edgesObj = edgesTube;
      addDimLine([V(-radius, 0, radius), V(radius, 0, radius)]);
      addLabel(V(0, -gap * 0.15, radius + gap * 0.2), `Ø ${fmt(width)}`);
      addDimLine([V(radius, 0, 0), V(radius, height, 0)]);
      addLabel(V(radius + gap * 0.3, height / 2, 0), 'Altura ' + fmt(height));
      // Frisos da Tube: anéis em volta do corpo, na parte de baixo.
      if (props.frisoFrente || props.frisoLD || props.frisoLE) {
        const nLinhas = Math.max(1, Math.min(3, props.frisoLinhas ?? 1));
        const faixaAltura = Math.min(height * 0.3, 400);
        const esp = Math.min(12, faixaAltura / (nLinhas + 1) * 0.5);
        for (let i = 0; i < nLinhas; i++) {
          const anel = new THREE.Mesh(new THREE.CylinderGeometry(radius + 1, radius + 1, esp, 48, 1, true), frisoMat);
          anel.position.y = faixaAltura * (i + 1) / (nLinhas + 1);
          modelGroup.add(anel);
        }
      }
    } else {
      if (modelo === 'Piramidal') {
        const tw = props.tetoWidth && props.tetoWidth > 0 ? props.tetoWidth : width * 0.4;
        const td = props.tetoDepth && props.tetoDepth > 0 ? props.tetoDepth : depth * 0.7;
        const zc = props.mount === 'Parede' ? -(depth / 2 - td / 2) : 0;
        corpoBase = rect(width, depth, 0, 0, 0); corpoTopo = rect(tw, td, 0, zc, height);
        const f = shellFaces(corpoBase, corpoTopo);
        partes['22'].push(f.front, f.right, f.left); partes['24'].push(f.back); partes.base.push(f.bottom);
        // Carenagem opcional sobre o teto (mesma regra da Línea). Sem medida
        // própria, acompanha o teto — é o duto subindo dele. Na Parede encosta
        // no fundo; na Ilha fica centralizada: o teto da Piramidal tem 3 águas
        // na Parede e 4 na Ilha.
        const ch = props.carenagemHeight && props.carenagemHeight > 0 ? props.carenagemHeight : 0;
        const cw = props.carenagemWidth && props.carenagemWidth > 0 ? props.carenagemWidth : tw;
        const cd = props.carenagemDepth && props.carenagemDepth > 0 ? props.carenagemDepth : td;
        const zcCar = props.mount === 'Parede' ? -(depth / 2 - cd / 2) : 0;
        if (ch > 0) {
          const c = shellFaces(rect(cw, cd, 0, zcCar, height), rect(cw, cd, 0, zcCar, height + ch));
          partes['24'].push(c.front, c.back, c.right, c.left, c.top);
          // O teto fica aberto onde a carenagem se encaixa.
          partes['24'].push(...tampaComRecorte(corpoTopo, rect(cw, cd, 0, zcCar, height)));
        } else {
          partes['24'].push(f.top);
        }
        addDimLabelsBoxLike(width, depth, height, tw, td, zc);
        if (ch > 0) addLabel(V(0, height + ch / 2, zcCar), `Carenagem ${fmt(cw)}×${fmt(cd)}×${fmt(ch)}`);
      } else if (modelo === 'Linea') {
        // Corpo: caixa baixa e larga. Carenagem: segunda caixa, mais estreita,
        // subindo a partir do topo do corpo — largura/profundidade dela são só
        // estéticas (não entram no cálculo de preço, só a altura entra).
        corpoBase = rect(width, depth, 0, 0, 0); corpoTopo = rect(width, depth, 0, 0, height);
        const f = shellFaces(corpoBase, corpoTopo);
        partes['22'].push(f.front, f.back, f.right, f.left); partes.base.push(f.bottom);
        const cw = props.carenagemWidth && props.carenagemWidth > 0 ? props.carenagemWidth : width * 0.5;
        const cd = props.carenagemDepth && props.carenagemDepth > 0 ? props.carenagemDepth : depth * 0.5;
        const ch = props.carenagemHeight && props.carenagemHeight > 0 ? props.carenagemHeight : 0;
        const zc = props.mount === 'Parede' ? -(depth / 2 - cd / 2) : 0;
        if (ch > 0) {
          const c = shellFaces(rect(cw, cd, 0, zc, height), rect(cw, cd, 0, zc, height + ch));
          partes['24'].push(c.front, c.back, c.right, c.left, c.top);
          // Teto da Línea = L×P, com o recorte onde a carenagem se encaixa
          // (ao centro na Ilha, no fundo na Parede).
          partes['22'].push(...tampaComRecorte(corpoTopo, rect(cw, cd, 0, zc, height)));
        } else {
          partes['22'].push(f.top);
        }
        addDimLabelsLinea(width, depth, height, ch, cw, cd, zc);
      } else {
        // Box: caixa reta, sem afunilar — não existe campo de chaminé pro Box
        // no modelo de dados real.
        corpoBase = rect(width, depth, 0, 0, 0); corpoTopo = rect(width, depth, 0, 0, height);
        const f = shellFaces(corpoBase, corpoTopo);
        partes['22'].push(f.front, f.right, f.left); partes['24'].push(f.back, f.top); partes.base.push(f.bottom);
        addDimLabelsBoxLike(width, depth, height);
      }
      (['22', '24', 'base'] as Grupo[]).forEach(g => {
        if (partes[g].length === 0) return;
        const mesh = new THREE.Mesh(geomFromQuads(partes[g]), metalMat);
        mesh.userData.grupo = g;
        modelGroup.add(mesh);
        s.hullMeshes.push(mesh);
        todas.push(...partes[g]);
      });
      const edgesGeo = geomFromQuads(todas);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(edgesGeo, 20), edgeMat);
      edgesGeo.dispose();
      edges.visible = s.show.edges;
      modelGroup.add(edges);
      s.edgesObj = edges;
    }

    // ── Frisos (Box/Piramidal/Línea): faixas na parte de baixo das faces marcadas.
    if (corpoBase && corpoTopo && (props.frisoFrente || props.frisoLD || props.frisoLE)) {
      const nLinhas = Math.max(1, Math.min(3, props.frisoLinhas ?? 1));
      const faixaAltura = modelo === 'Linea' ? height : Math.min(height * 0.35, 180);
      const esp = Math.min(10, faixaAltura / (nLinhas + 1) * 0.5);
      const faces: ('front' | 'right' | 'left')[] = [];
      if (props.frisoFrente) faces.push('front');
      if (props.frisoLD) faces.push('right');
      if (props.frisoLE) faces.push('left');
      const quads: Quad[] = [];
      for (let i = 0; i < nLinhas; i++) {
        const yc = faixaAltura * (i + 1) / (nLinhas + 1);
        faces.forEach(face => quads.push(faixa(corpoBase!, corpoTopo!, face, yc - esp / 2, yc + esp / 2)));
      }
      modelGroup.add(new THREE.Mesh(geomFromQuads(quads), frisoMat));
    }

    // ── Furos (lâmpadas e botões/botoeira) ───────────────────────────────────
    // As posições vêm de planejarFuros (lib/coifa-furos.ts) — a mesma lista
    // servirá de base para o DXF. Ilha: metade das lâmpadas na frente e metade
    // no fundo; Parede: só na frente (ou junto à parede, se escolhido).
    const plano = planejarFuros({
      modelo, width, depth, height, mount: props.mount,
      qtdLampadas: Math.min(MAX_MARCADORES, Math.max(0, props.qtdLampadas ?? 0)),
      qtdBotoes: Math.min(MAX_MARCADORES, Math.max(0, props.qtdBotoes ?? 0)),
      tipoControle: props.controle ?? 'botoeira',
      posicaoLampadas: props.posicaoLampadas,
      posicaoComando: props.posicaoComando,
    });

    // ── Filtro e coletor de gordura (vistos por baixo — vista "Inferior").
    // O filtro deixa livre a faixa onde ficam as lâmpadas (frente e/ou fundo).
    const temFiltro = props.filtro && props.filtro !== 'nenhum' && modelo !== 'Tube';
    if (temFiltro) {
      const margem = Math.min(40, width * 0.05);
      const z0 = -depth / 2 + (plano.reservaFundo > 0 ? plano.reservaFundo : margem);
      const z1 = depth / 2 - (plano.reservaFrente > 0 ? plano.reservaFrente : margem);
      const x0 = -width / 2 + margem, x1 = width / 2 - margem;
      if (z1 - z0 > 50 && x1 - x0 > 50) {
        s.filtroMat.color.setHex(props.filtro === 'aluminio' ? 0xcfd4db : props.filtro === 'inercial_304' ? 0xb8bfc8 : 0x969da7);
        const placa = new THREE.Mesh(geomFromQuads([[[x0, -0.6, z0], [x1, -0.6, z0], [x1, -0.6, z1], [x0, -0.6, z1]]]), s.filtroMat);
        modelGroup.add(placa);
        // Lâminas (chicanas) do filtro.
        const pts: THREE.Vector3[] = [];
        const passo = 60;
        for (let x = x0 + passo / 2; x < x1; x += passo) pts.push(V(x, -1, z0), V(x, -1, z1));
        pts.push(V(x0, -1, z0), V(x1, -1, z0), V(x1, -1, z0), V(x1, -1, z1), V(x1, -1, z1), V(x0, -1, z1), V(x0, -1, z1), V(x0, -1, z0));
        modelGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), edgeMat));
        if (props.coletor && props.coletor !== 'nenhum') {
          const calha = (z: number) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 22, 36), s.coletorMat);
            m.position.set(0, -12, z);
            modelGroup.add(m);
          };
          calha(z1 + 18);
          if (props.coletor === 'duplo') calha(z0 - 18);
        }
      }
    }

    // Lâmpadas: discos na face de baixo.
    if (plano.lampadas.furos.length > 0) {
      const lg = new THREE.CylinderGeometry(plano.lampadas.diametro / 2, plano.lampadas.diametro / 2, 4, 24);
      plano.lampadas.furos.forEach(f => {
        const m = new THREE.Mesh(lg, lampMat);
        m.position.set(f.x, -1.5, f.z);
        modelGroup.add(m);
      });
    }

    // Botões ou botoeira: na frente (rente à face, que é inclinada na Piramidal)
    // ou embaixo (face de baixo, junto à borda da frente).
    const zFrenteEm = (y: number) => (corpoBase && corpoTopo ? secao(corpoBase, corpoTopo, y).z1 : depth / 2);
    const embaixo = plano.botoes.lado === 'embaixo';
    if (plano.botoes.furos.length > 0) {
      const dBot = plano.botoes.diametro;
      const bg = new THREE.CylinderGeometry(dBot / 2, dBot / 2, 4, 20);
      plano.botoes.placas.forEach(pl => {
        if (embaixo) {
          // Embaixo o casco é escuro: placa clara e botões escuros pra aparecer.
          const placa = new THREE.Mesh(new THREE.BoxGeometry(pl.largura, 3, pl.altura), s.coletorMat);
          placa.position.set(pl.x, -1.5, pl.z ?? 0);
          modelGroup.add(placa);
        } else {
          const placa = new THREE.Mesh(new THREE.BoxGeometry(pl.largura, pl.altura, 3), btnMat);
          placa.position.set(pl.x, pl.y ?? 0, zFrenteEm(pl.y ?? 0) + 1.5);
          modelGroup.add(placa);
        }
      });
      const recuo = plano.botoes.placas.length > 0 ? 3 : 0; // botões da botoeira saem da placa
      plano.botoes.furos.forEach(f => {
        const m = new THREE.Mesh(bg, plano.botoes.placas.length > 0 && !embaixo ? s.coletorMat : btnMat);
        if (embaixo) {
          m.position.set(f.x, -2 - recuo, f.z ?? 0);
        } else {
          m.rotation.x = Math.PI / 2;
          m.position.set(f.x, f.y ?? 0, zFrenteEm(f.y ?? 0) + 2 + recuo);
        }
        modelGroup.add(m);
      });
    }
    // Notas dos furos (somem junto com as cotas) — mesma informação que o
    // protótipo do Marcelo mostrava: quantidade e diâmetro.
    if (modelo !== 'Tube') {
      const resumo = resumoFuros(plano);
      if (resumo.botoes && plano.botoes.furos.length > 0) {
        const alvo = plano.botoes.placas[0] ?? plano.botoes.furos[0];
        const xMedio = plano.botoes.furos.reduce((a, f) => a + f.x, 0) / plano.botoes.furos.length;
        addLabel(
          embaixo ? V(xMedio, -14, (alvo.z ?? 0) - 24) : V(xMedio, (alvo.y ?? 0) + 46, zFrenteEm(alvo.y ?? 0) + 4),
          resumo.botoes.split(' — ')[0], true,
        );
      }
      if (plano.lampadas.furos.length > 0) {
        const n = plano.lampadas.furos.length;
        addLabel(V(0, -4, 0), `${n}× Ø${fmt(Math.round(plano.lampadas.diametro))} lâmpadas${plano.lampadas.nFrente > 0 && plano.lampadas.nFundos > 0 ? ` (${plano.lampadas.nFrente} frente + ${plano.lampadas.nFundos} fundo)` : ''}`, true);
      }
    }

    aplicarMateriais(s);

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
    function addDimLabelsLinea(w: number, d: number, h: number, ch: number, cw: number, cd: number, zc: number) {
      addDimLabelsBoxLike(w, d, h);
      if (ch > 0) addLabel(V(0, h + ch / 2, zc), `Carenagem ${fmt(cw)}×${fmt(cd)}×${fmt(ch)}`);
    }

    apiRef.current?.fitView(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.modelo, props.width, props.depth, props.height, props.tetoWidth, props.tetoDepth,
    props.carenagemWidth, props.carenagemDepth, props.carenagemHeight, props.mount,
    props.qtdLampadas, props.qtdBotoes, props.controle, props.posicaoLampadas, props.posicaoComando, props.material, props.filtro, props.coletor,
    props.frisoFrente, props.frisoLD, props.frisoLE, props.frisoLinhas,
  ]);

  // ── Aplica toggles (arestas, raio-x, ortho, cotas) ───────────────────────
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.show = show;
    if (s.edgesObj) s.edgesObj.visible = show.edges;
    s.dimGroup.visible = show.dims;
    aplicarMateriais(s);
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
      if (s.show.chapas) {
        const [t22, t24] = LEGENDA_CHAPAS[props.modelo];
        g.font = `600 ${11 * k}px Arial`; g.textAlign = 'left';
        const largura = Math.max(g.measureText(t22).width, g.measureText(t24).width) + 34 * k;
        const x0 = 8 * k, y0 = out.height - 52 * k;
        g.fillStyle = 'rgba(255,255,255,.93)'; g.fillRect(x0, y0, largura, 44 * k);
        [[HEX_22, t22], [HEX_24, t24]].forEach(([cor, texto], i) => {
          const y = y0 + 13 * k + i * 18 * k;
          g.fillStyle = cor; g.fillRect(x0 + 8 * k, y - 6 * k, 14 * k, 12 * k);
          g.fillStyle = '#1f2937'; g.fillText(texto, x0 + 28 * k, y);
        });
      }
      return out.toDataURL('image/png');
    },
  }));

  // Barra de ferramentas vira dois menus quando o espaço é estreito (celular,
  // miniatura do orçamento) — com botões soltos ela cobria o desenho.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setEstreito(e.contentRect.width < 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, [webglIndisponivel]);

  const VISTAS = [['front', 'Frontal'], ['right', 'Lateral'], ['top', 'Superior'], ['bottom', 'Inferior'], ['iso', 'Isométrica']] as const;
  const EXIBIR = [['dims', 'Cotas'], ['edges', 'Arestas'], ['chapas', 'Chapas 22/24'], ['furos', 'Furos'], ['xray', 'Raio-X'], ['ortho', 'Ortogonal']] as const;
  const alternar = (key: keyof ShowState) => setShow(v => ({ ...v, [key]: !v[key] }));

  if (webglIndisponivel) {
    return (
      <div className={cn('relative w-full h-full min-h-[200px] rounded-md border border-dashed flex items-center justify-center p-4 text-center text-sm text-muted-foreground', props.className)}>
        Visualização 3D indisponível neste computador (o navegador não liberou aceleração gráfica/WebGL).
        O cálculo e o orçamento não são afetados.
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative w-full h-full min-h-[280px] bg-muted/30 rounded-md overflow-hidden', props.className)}>
      {/* No modo embutido, arrasto vertical no celular rola a página. */}
      <div ref={hostRef} className={cn('absolute inset-0 cursor-grab active:cursor-grabbing', props.embedded ? 'touch-pan-y' : 'touch-none')} />
      <div ref={labelsRef} className="absolute inset-0 pointer-events-none overflow-hidden" />
      {props.embedded && !ativo && !show.chapas && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none rounded bg-black/55 px-2 py-0.5 text-[11px] text-white whitespace-nowrap">
          Arraste para girar · clique antes de usar o zoom
        </div>
      )}
      {show.chapas && (
        <div className="absolute bottom-2 left-2 z-10 rounded bg-white/90 px-2 py-1 text-[11px] text-gray-800 shadow-sm space-y-0.5 pointer-events-none">
          {LEGENDA_CHAPAS[props.modelo].map((texto, i) => (
            <div key={texto} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-3.5 rounded-sm" style={{ background: i === 0 ? HEX_22 : HEX_24 }} />
              {texto}
            </div>
          ))}
        </div>
      )}
      {estreito ? (
        <div className="absolute top-2 left-2 right-2 z-10 flex justify-between gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-xs"><Eye className="mr-1 h-3.5 w-3.5" />Vista</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {VISTAS.map(([v, label]) => (
                <DropdownMenuItem key={v} onSelect={() => apiRef.current?.viewTo(v)}>{label}</DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => apiRef.current?.viewTo('fit')}>Ajustar à tela</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-xs"><SlidersHorizontal className="mr-1 h-3.5 w-3.5" />Exibir</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {EXIBIR.map(([key, label]) => (
                <DropdownMenuCheckboxItem key={key} checked={show[key]} onCheckedChange={() => alternar(key)} onSelect={e => e.preventDefault()}>
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <>
          <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[55%] z-10">
            {VISTAS.map(([v, label]) => (
              <Button key={v} type="button" size="sm" variant="secondary" className="h-6 px-2 text-[11px]" onClick={() => apiRef.current?.viewTo(v)}>
                {label}
              </Button>
            ))}
            <Button type="button" size="sm" variant="secondary" className="h-6 px-2 text-[11px]" onClick={() => apiRef.current?.viewTo('fit')}>Ajustar</Button>
          </div>
          <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end max-w-[45%] z-10">
            {EXIBIR.map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={show[key] ? 'default' : 'secondary'}
                className="h-6 px-2 text-[11px]"
                onClick={() => alternar(key)}
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
