import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Grid() {
  // Basic Three.js setup
  const fullWidth = window.innerWidth;
  const fullHeight = window.innerHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(100, fullWidth / fullHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(fullWidth, fullHeight);
  // body에 렌더링
  // document.body.style.margin = '0'; // 기본 margin 제거
  // document.body.style.overflow = 'hidden'; // 스크롤바 제거
  // document.body.appendChild(renderer.domElement); // 
  const containerRef = useRef<HTMLDivElement>(null);

  // BoxGeometry Grid 만들기
  const gridSize = 20;
  const gridDivisions = 20;
  // #000 20%
  const gridColorCenterLine = 0x444444; // 중앙 선 색상
  const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, gridColorCenterLine);
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const dir = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(gridHelper);
  scene.add(ambient, dir);

  const boxWidth = 1; // width
  const boxHeight = 1; // height
  const boxDepth = 1; // depth

  // 깊이감: 안개(fog) 추가
  scene.fog = new THREE.FogExp2(0x000000, 0.04);

  // 레이아웃 포지션 미리 계산 (grid ↔ globe 전환용)
  const rows = 10; // 3개 행
  const cols = 10; // 4개 열 (총 12개 박스)
  const total = rows * cols;
  const gridPositions: THREE.Vector3[] = [];
  const globePositions: THREE.Vector3[] = [];

  // Grid positions (기존 배치 로직을 벡터로 저장)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * 2; // 중앙 정렬
      const y = 0.5; // 박스 높이의 절반
      const z = (r - (rows - 1) / 2) * 2;
      gridPositions.push(new THREE.Vector3(x, y, z));
    }
  }

  // Globe positions (Fibonacci sphere)
  const radius = 10; // 구 반지름
  for (let i = 0; i < total; i++) {
    const k = (i + 0.5) / total;
    const phi = Math.acos(1 - 2 * k);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    globePositions.push(new THREE.Vector3(x, y, z));
  }

  // 전환 상태값
  let targetLayout: 'grid' | 'globe' = 'grid';
  let t = 0; // 0=grid, 1=globe

  // Row와 Cell로 나누어서 2차원 그리드 생성
  const boxes = [];
  const grid: {
    mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial, THREE.Object3DEventMap>;
    row: number;
    col: number;
    index: number;
  }[][] = []; // 2차원 배열로 그리드 구조 저장
  // const boxColors = [
  //   0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff,
  //   0x00ffff, 0xffa500, 0x800080, 0xffc0cb, 0xa52a2a,
  //   0x32cd32, 0xff1493
  // ];

  // random rgb
  const boxColors: string[] = [];

  for (let i = 0; i < rows * cols; i++) {
    const r = Math.ceil(Math.random() * 255);
    const g = Math.ceil(Math.random() * 255);
    const b = Math.ceil(Math.random() * 255);
    boxColors.push(`rgb(${r}, ${g}, ${b})`);
  }

  // Row별로 그리드 생성
  for (let row = 0; row < rows; row++) {
    const currentRow = [];

    for (let col = 0; col < cols; col++) {
      const index = row * cols + col; // 0~11
      const boxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
      const boxMaterial = new THREE.MeshStandardMaterial({
        color: boxColors[index] as unknown as THREE.ColorRepresentation,
        metalness: 0.1,
        roughness: 0.6,
        transparent: true,
        opacity: 0.9,
      });
      const box = new THREE.Mesh(boxGeometry, boxMaterial);

      // Cell 정보를 객체로 저장
      const cell = {
        mesh: box,
        row: row,
        col: col,
        index: index
      };

      // 2차원 그리드로 배치
      box.position.copy(gridPositions[index]);

      boxes.push(box);
      currentRow.push(cell);
      scene.add(box);
    }

    grid.push(currentRow);
  }

  // document.body.appendChild(renderer.domElement);
  // id rendering
  const container = document.getElementById('threejs-container') || null;
  container?.appendChild(renderer.domElement);

  // 카메라 포지션 - 위에서 아래로 내려다보기
  camera.position.x = 0;   // 중앙
  camera.position.y = 10;  // 높은 곳에서
  camera.position.z = 0;   // 그리드 중앙 위에서

  // 카메라가 그리드를 위에서 아래로 내려다보도록 설정
  camera.lookAt(0, 0, 0);

  // 라이트 위치
  dir.position.set(5, 10, 5);

  // 애니메이션 루프 - Row별로 다른 애니메이션
  const animate = () => {
    requestAnimationFrame(animate);

    // Row별로 다른 애니메이션 적용
    grid.forEach((row, _rowIndex) => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      row.forEach((cell: { mesh: any; index: number; }, _colIndex: number) => {
        const box = cell.mesh;

        // 전환 보간 값 업데이트 (부드럽게)
        const speed = 0.02; // 보간 속도
        if (targetLayout === 'globe') {
          t = Math.min(1, t + speed);
        } else {
          t = Math.max(0, t - speed);
        }

        // 대상 위치 계산 (grid ↔ globe)
        const idx = cell.index;
        const from = gridPositions[idx];
        const to = globePositions[idx];
        box.position.lerpVectors(from, to, t);

        // 같은 축으로 천천히 회전
        box.rotation.x += 0.008;
        box.rotation.y += 0.008;
        // box.rotation.z += 0.001;
      });
    });

    renderer.render(scene, camera);
  };
  animate();

  // onKeyDown을 useEffect 바깥에 선언하여 cleanup에서 접근 가능하게 함
  const onKeyDown = (e: KeyboardEvent) => {
    // 한국어/영문 키보드 레이아웃과 무관하게 G 키 감지
    if (e.code === 'KeyG') {
      targetLayout = targetLayout === 'grid' ? 'globe' : 'grid';
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.appendChild(renderer.domElement);
      window.addEventListener('keydown', onKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      // 컴포넌트 언마운트 시 정리
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [renderer.domElement]);

  return (
    <>
      <div ref={containerRef} className="w-full h-full" />
    </>
  )
}