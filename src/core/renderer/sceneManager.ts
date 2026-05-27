import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type ViewMode = 'normal' | 'ghost' | 'isolate'
type RenderMode = 'shaded' | 'wireframe' | 'shaded+edge'

const EDGE_THRESHOLD_ANGLE = 5

export class SceneManager {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private animationId: number | null = null
  private meshes = new Map<string, THREE.Mesh>()
  private edgeLines = new Map<string, { feature: THREE.LineSegments; grid: THREE.LineSegments }>()
  private viewMode: ViewMode = 'normal'
  private selectedName: string | null = null
  private renderMode: RenderMode = 'shaded'

  // 무대 요소
  private spot: THREE.SpotLight | null = null
  private stageFloor: THREE.Mesh | null = null
  private stageWall: THREE.Mesh | null = null

  constructor(canvas: HTMLCanvasElement) {
    const { clientWidth: w, clientHeight: h } = canvas

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x16162a)

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 50000)
    this.camera.position.set(0, 80, 200)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(w, h, false)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.setupLights()
    this.setupStage()

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.06
    this.controls.screenSpacePanning = true

    this.startAnimation()
  }

  // ── 메시 관리 ───────────────────────────────────────────────

  addNamedMesh(name: string, mesh: THREE.Mesh): void {
    const existing = this.meshes.get(name)
    if (existing) this.scene.remove(existing)

    mesh.name = name
    mesh.castShadow = true
    this.meshes.set(name, mesh)
    this.scene.add(mesh)
    this.fitCamera()
    this.rebuildEdgeLinesFor(name)
    this.applyMeshStates()
    this.updateStage()
  }

  removeNamedMesh(name: string): void {
    const mesh = this.meshes.get(name)
    if (mesh) { this.scene.remove(mesh); this.meshes.delete(name) }
    const lines = this.edgeLines.get(name)
    if (lines) { this.scene.remove(lines); this.edgeLines.delete(name) }
    if (this.meshes.size > 0) this.fitCamera()
    this.updateStage()
  }

  clearMeshes(): void {
    for (const mesh of this.meshes.values()) this.scene.remove(mesh)
    this.meshes.clear()
    for (const lines of this.edgeLines.values()) this.scene.remove(lines)
    this.edgeLines.clear()
    this.updateStage()
  }

  hasMesh(name: string): boolean {
    return this.meshes.has(name)
  }

  // ── 뷰 모드 ────────────────────────────────────────────────

  setViewMode(mode: ViewMode, activeName: string | null): void {
    this.viewMode = mode
    this.selectedName = activeName
    this.applyMeshStates()
  }

  highlight(name: string | null): void {
    this.selectedName = name
    this.applyMeshStates()
  }

  // ── 렌더 모드 ───────────────────────────────────────────────

  setRenderMode(mode: RenderMode): void {
    this.renderMode = mode
    this.rebuildAllEdgeLines()
    this.applyMeshStates()
  }

  // ── 레이캐스트 ─────────────────────────────────────────────

  raycast(clientX: number, clientY: number): string | null {
    const canvas = this.renderer.domElement
    const rect = canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -((clientY - rect.top) / rect.height) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera)
    const hits = raycaster.intersectObjects(Array.from(this.meshes.values()))
    return hits.length > 0 ? hits[0].object.name : null
  }

  // ── 카메라 ─────────────────────────────────────────────────

  fitCamera(): void {
    if (this.meshes.size === 0) return

    const box = new THREE.Box3()
    for (const mesh of this.meshes.values()) box.expandByObject(mesh)
    if (box.isEmpty()) return

    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = (this.camera.fov * Math.PI) / 180
    const distance = (maxDim / 2 / Math.tan(fov / 2)) * 1.8

    this.controls.target.copy(center)
    this.camera.position.set(
      center.x + distance * 0.6,
      center.y + distance * 0.4,
      center.z + distance
    )
    this.camera.near = maxDim * 0.001
    this.camera.far = maxDim * 50
    this.camera.updateProjectionMatrix()
    this.controls.update()
  }

  setView(view: 'front' | 'side' | 'top'): void {
    const box = new THREE.Box3()
    for (const mesh of this.meshes.values()) box.expandByObject(mesh)
    if (box.isEmpty()) return

    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = (this.camera.fov * Math.PI) / 180
    const dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.8

    this.controls.target.copy(center)
    if (view === 'front') {
      this.camera.up.set(0, 1, 0)
      this.camera.position.set(center.x, center.y, center.z + dist)
    } else if (view === 'side') {
      this.camera.up.set(0, 1, 0)
      this.camera.position.set(center.x + dist, center.y, center.z)
    } else {
      this.camera.up.set(0, 0, -1)
      this.camera.position.set(center.x, center.y + dist, center.z)
    }

    this.camera.near = maxDim * 0.001
    this.camera.far = maxDim * 50
    this.camera.updateProjectionMatrix()
    this.controls.update()
  }

  onResize(width: number, height: number): void {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  // ── 내부 ───────────────────────────────────────────────────

  private setupLights(): void {
    // 환경광 — 무대 암전이지만 형태는 보이게
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.28))

    // 핀 조명: 카메라 앞쪽 위 45° 대각선 — 전면과 윗면을 함께 비춤
    this.spot = new THREE.SpotLight(0xfff8f0, 5)
    this.spot.angle = Math.PI / 7   // ~26°
    this.spot.penumbra = 0.45
    this.spot.decay = 0             // 거리 감쇠 없음
    this.spot.castShadow = true
    this.spot.shadow.mapSize.set(2048, 2048)
    this.spot.shadow.bias = -0.0005
    this.scene.add(this.spot)
    this.scene.add(this.spot.target)

    // 아주 약한 후면 림 라이트 — 실루엣 분리
    const rim = new THREE.DirectionalLight(0x1a2a6a, 0.5)
    rim.position.set(-1, 0.3, -2)
    this.scene.add(rim)
  }

  private setupStage(): void {
    // 어두운 무대 바닥 — 스팟 조명원과 그림자가 보이는 재질
    const floorMat = new THREE.MeshPhongMaterial({
      color: 0x141428,
      shininess: 8,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    })
    this.stageFloor = new THREE.Mesh(new THREE.PlaneGeometry(100000, 100000), floorMat)
    this.stageFloor.rotation.x = -Math.PI / 2
    this.stageFloor.receiveShadow = true
    this.stageFloor.visible = false
    this.scene.add(this.stageFloor)

    // 어두운 배경 커튼 벽
    const wallMat = new THREE.MeshPhongMaterial({ color: 0x080810 })
    this.stageWall = new THREE.Mesh(new THREE.PlaneGeometry(100000, 100000), wallMat)
    this.stageWall.receiveShadow = true
    this.stageWall.visible = false
    this.scene.add(this.stageWall)
  }

  private updateStage(): void {
    if (this.meshes.size === 0) {
      if (this.stageFloor) this.stageFloor.visible = false
      if (this.stageWall)  this.stageWall.visible  = false
      return
    }

    const box = new THREE.Box3()
    for (const mesh of this.meshes.values()) box.expandByObject(mesh)
    const center = box.getCenter(new THREE.Vector3())
    const size   = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    const floorY  = box.min.y - maxDim * 0.12   // 물체를 바닥에서 띄움
    const wallDist = maxDim * 2.5   // 오브젝트 뒤쪽

    // 바닥
    if (this.stageFloor) {
      this.stageFloor.position.set(center.x, floorY, center.z)
      this.stageFloor.visible = true
    }

    // 뒷 커튼 벽
    if (this.stageWall) {
      this.stageWall.position.set(center.x, center.y, center.z - wallDist)
      this.stageWall.visible = true
    }

    // 스팟 라이트: 카메라 쪽 앞에서 위로 45° (전면+윗면 조명)
    if (this.spot) {
      const h = maxDim * 2.2
      this.spot.position.set(
        center.x + maxDim * 0.15,
        center.y + h,
        center.z + h           // 카메라 방향 앞쪽
      )
      this.spot.target.position.copy(center)
      this.spot.target.updateMatrixWorld()

      // 바닥까지 커버할 만큼 콘 각도 조정
      const distToTarget = this.spot.position.distanceTo(center)
      this.spot.angle = Math.atan2(maxDim * 1.0, distToTarget) + 0.12
      this.spot.distance = distToTarget * 4
      this.spot.shadow.camera.near = distToTarget * 0.05
      this.spot.shadow.camera.far  = distToTarget * 5
      this.spot.shadow.camera.updateProjectionMatrix()
    }
  }

  // ── 엣지 라인 ──────────────────────────────────────────────

  private buildEdgePair(name: string, mesh: THREE.Mesh) {
    const copyTransform = (src: THREE.Mesh, dst: THREE.LineSegments) => {
      dst.position.copy(src.position)
      dst.quaternion.copy(src.quaternion)
      dst.scale.copy(src.scale)
    }

    // Feature edges — 임계각 이상 꺾이는 선 (bright)
    const featureGeo = new THREE.EdgesGeometry(mesh.geometry, EDGE_THRESHOLD_ANGLE)
    const featureMat = new THREE.LineBasicMaterial({ color: 0x39ff14 })
    const feature = new THREE.LineSegments(featureGeo, featureMat)
    feature.name = `__edge__${name}`
    copyTransform(mesh, feature)

    // Grid overlay — 전체 삼각형 (faint) — 곡면에 메쉬 격자 표현
    const gridGeo = new THREE.WireframeGeometry(mesh.geometry)
    const gridMat = new THREE.LineBasicMaterial({ color: 0x39ff14, opacity: 0.1, transparent: true })
    const grid = new THREE.LineSegments(gridGeo, gridMat)
    grid.name = `__grid__${name}`
    copyTransform(mesh, grid)

    return { feature, grid }
  }

  private rebuildEdgeLinesFor(name: string): void {
    const old = this.edgeLines.get(name)
    if (old) { this.scene.remove(old.feature); this.scene.remove(old.grid); this.edgeLines.delete(name) }
    if (this.renderMode === 'shaded') return
    const mesh = this.meshes.get(name)
    if (!mesh) return
    const pair = this.buildEdgePair(name, mesh)
    this.scene.add(pair.feature)
    this.scene.add(pair.grid)
    this.edgeLines.set(name, pair)
  }

  private rebuildAllEdgeLines(): void {
    for (const pair of this.edgeLines.values()) { this.scene.remove(pair.feature); this.scene.remove(pair.grid) }
    this.edgeLines.clear()
    if (this.renderMode === 'shaded') return
    for (const [name, mesh] of this.meshes) {
      const pair = this.buildEdgePair(name, mesh)
      this.scene.add(pair.feature)
      this.scene.add(pair.grid)
      this.edgeLines.set(name, pair)
    }
  }

  private applyMeshStates(): void {
    const sel = this.selectedName
    const isWireframe = this.renderMode === 'wireframe'

    for (const [key, mesh] of this.meshes) {
      const mat = mesh.material as THREE.MeshPhongMaterial
      const isSelected = key === sel && sel !== null
      const pair = this.edgeLines.get(key)

      mat.color.set(isSelected ? 0xff6b00 : 0xb0b8c8)
      mat.wireframe = false

      let meshVisible = true
      let meshOpacity = 1
      let meshTransparent = false

      if (this.viewMode === 'isolate') {
        meshVisible = sel === null || isSelected
      } else if (this.viewMode === 'ghost') {
        const opaque = sel === null || isSelected
        meshOpacity = opaque ? 1 : 0.07
        meshTransparent = !opaque
        mesh.castShadow = opaque
      } else {
        mesh.castShadow = true
      }

      if (isWireframe) {
        mesh.visible = meshVisible
        mat.colorWrite = false
        mat.depthWrite = false
        mat.transparent = false
        mat.opacity = 1
      } else {
        mat.colorWrite = true
        mat.depthWrite = true
        mesh.visible = meshVisible
        mat.opacity = meshOpacity
        mat.transparent = meshTransparent
      }

      if (pair) {
        const featureMat = pair.feature.material as THREE.LineBasicMaterial
        const gridMat    = pair.grid.material    as THREE.LineBasicMaterial
        const dimEdge    = this.viewMode === 'ghost' && !isSelected && sel !== null
        const edgeColor  = isSelected ? 0xff8844 : 0x39ff14

        if (isWireframe) {
          pair.feature.visible = meshVisible
          pair.grid.visible    = meshVisible
          featureMat.color.set(edgeColor)
          featureMat.opacity = dimEdge ? 0.12 : 1
          featureMat.transparent = dimEdge
          pair.grid.visible = false
        } else {
          // shaded+edge
          pair.feature.visible = meshVisible
          pair.grid.visible    = false          // shaded+edge에선 grid 숨김
          featureMat.color.set(edgeColor)
          featureMat.opacity = meshOpacity < 1 ? meshOpacity * 0.5 : 0.75
          featureMat.transparent = meshTransparent || true
        }
      }
    }
  }

  private startAnimation(): void {
    const animate = (): void => {
      this.animationId = requestAnimationFrame(animate)
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
    }
    animate()
  }

  dispose(): void {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId)
    for (const pair of this.edgeLines.values()) { this.scene.remove(pair.feature); this.scene.remove(pair.grid) }
    this.edgeLines.clear()
    this.controls.dispose()
    this.renderer.dispose()
  }
}
