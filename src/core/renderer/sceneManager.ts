import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

export type ViewMode = 'normal' | 'ghost' | 'isolate'
type RenderMode = 'shaded' | 'wireframe' | 'shaded+edge'

const EDGE_THRESHOLD_ANGLE = 5

export interface PinData {
  id: string
  position: { x: number; y: number; z: number }
  label: string
  partNumber: string | null
}

export class SceneManager {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private labelRenderer: CSS2DRenderer
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

  // 어노테이션 핀
  private pins = new Map<string, THREE.Group>()
  private pinSpheres = new Map<string, THREE.Mesh>()

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
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

    // CSS2D 레이블 렌더러 (핀 레이블용)
    this.labelRenderer = new CSS2DRenderer()
    this.labelRenderer.setSize(w, h)
    this.labelRenderer.domElement.style.position = 'absolute'
    this.labelRenderer.domElement.style.top = '0'
    this.labelRenderer.domElement.style.left = '0'
    this.labelRenderer.domElement.style.width = '100%'
    this.labelRenderer.domElement.style.height = '100%'
    this.labelRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(this.labelRenderer.domElement)

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
    const pair = this.edgeLines.get(name)
    if (pair) { this.scene.remove(pair.feature); this.scene.remove(pair.grid); this.edgeLines.delete(name) }
    if (this.meshes.size > 0) this.fitCamera()
    this.updateStage()
  }

  clearMeshes(): void {
    for (const mesh of this.meshes.values()) this.scene.remove(mesh)
    this.meshes.clear()
    for (const pair of this.edgeLines.values()) { this.scene.remove(pair.feature); this.scene.remove(pair.grid) }
    this.edgeLines.clear()
    this.updateStage()
  }

  hasMesh(name: string): boolean { return this.meshes.has(name) }

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

  // ── 방향(좌표계) 보정 ─────────────────────────────────────────

  setMeshRotation(name: string, rx: number, ry: number, rz: number): void {
    const mesh = this.meshes.get(name)
    if (!mesh) return
    const toRad = (d: number) => (d * Math.PI) / 180
    mesh.rotation.set(toRad(rx), toRad(ry), toRad(rz))
    // edge lines의 transform도 동기화
    const pair = this.edgeLines.get(name)
    if (pair) {
      pair.feature.quaternion.copy(mesh.quaternion)
      pair.grid.quaternion.copy(mesh.quaternion)
    }
    this.updateStage()
    this.fitCamera()
  }

  setAllMeshesRotation(rx: number, ry: number, rz: number): void {
    for (const name of this.meshes.keys()) this.setMeshRotation(name, rx, ry, rz)
  }

  // ── 자동 회전 ──────────────────────────────────────────────

  setAutoRotate(dir: 'cw' | 'ccw' | 'off'): void {
    if (dir === 'off') {
      this.controls.autoRotate = false
    } else {
      this.controls.autoRotate = true
      this.controls.autoRotateSpeed = dir === 'cw' ? 2.5 : -2.5
    }
  }

  // ── 레이캐스트 ─────────────────────────────────────────────

  raycast(clientX: number, clientY: number): string | null {
    const hit = this.raycastWithPoint(clientX, clientY)
    return hit?.name ?? null
  }

  raycastWithPoint(clientX: number, clientY: number): { name: string; point: THREE.Vector3 } | null {
    const ndc = this.toNDC(clientX, clientY)
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, this.camera)
    const hits = raycaster.intersectObjects(Array.from(this.meshes.values()))
    if (hits.length === 0) return null
    return { name: hits[0].object.name, point: hits[0].point.clone() }
  }

  raycastPin(clientX: number, clientY: number): string | null {
    const ndc = this.toNDC(clientX, clientY)
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, this.camera)
    const hits = raycaster.intersectObjects(Array.from(this.pinSpheres.values()))
    if (hits.length === 0) return null
    return hits[0].object.name.replace('__pin_sphere__', '')
  }

  private toNDC(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect()
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
  }

  // ── 어노테이션 핀 ──────────────────────────────────────────

  addPin(pin: PinData): void {
    if (this.pins.has(pin.id)) this.removePin(pin.id)

    const sceneSize = this.getSceneSize()
    const r = Math.max(sceneSize * 0.012, 0.5)
    const stemH = Math.max(sceneSize * 0.08, 3)

    const group = new THREE.Group()
    group.name = `__pin__${pin.id}`

    // 핀 머리 (구체)
    const sphereGeo = new THREE.SphereGeometry(r, 12, 8)
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x6c7cff, depthTest: false })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    sphere.name = `__pin_sphere__${pin.id}`
    sphere.renderOrder = 999
    group.add(sphere)
    this.pinSpheres.set(pin.id, sphere)

    // 줄기 선
    const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, stemH, 0)]
    const stemGeo = new THREE.BufferGeometry().setFromPoints(points)
    const stemMat = new THREE.LineBasicMaterial({ color: 0x6c7cff, depthTest: false })
    const stem = new THREE.Line(stemGeo, stemMat)
    stem.renderOrder = 999
    group.add(stem)

    // CSS2D 레이블
    const labelDiv = document.createElement('div')
    labelDiv.className = 'pin-label'
    labelDiv.dataset.pinId = pin.id
    labelDiv.textContent = pin.label || `Pin`
    const labelObj = new CSS2DObject(labelDiv)
    labelObj.position.set(0, stemH + r, 0)
    group.add(labelObj)

    group.position.set(pin.position.x, pin.position.y, pin.position.z)
    this.scene.add(group)
    this.pins.set(pin.id, group)
  }

  removePin(id: string): void {
    const group = this.pins.get(id)
    if (group) { this.scene.remove(group); this.pins.delete(id) }
    this.pinSpheres.delete(id)
  }

  clearPins(): void {
    for (const id of [...this.pins.keys()]) this.removePin(id)
  }

  updatePinLabel(id: string, label: string): void {
    const group = this.pins.get(id)
    if (!group) return
    for (const child of group.children) {
      if (child instanceof CSS2DObject) {
        ;(child.element as HTMLElement).textContent = label
        break
      }
    }
  }

  highlightPin(id: string | null): void {
    for (const [pinId, group] of this.pins) {
      const sphere = this.pinSpheres.get(pinId)
      if (sphere) {
        ;(sphere.material as THREE.MeshBasicMaterial).color.set(pinId === id ? 0xff6b00 : 0x6c7cff)
      }
      for (const child of group.children) {
        if (child instanceof CSS2DObject) {
          ;(child.element as HTMLElement).classList.toggle('selected', pinId === id)
          break
        }
      }
    }
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
    this.camera.position.set(center.x + distance * 0.6, center.y + distance * 0.4, center.z + distance)
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
    this.labelRenderer.setSize(width, height)
  }

  // ── 내부 ───────────────────────────────────────────────────

  private getSceneSize(): number {
    if (this.meshes.size === 0) return 100
    const box = new THREE.Box3()
    for (const mesh of this.meshes.values()) box.expandByObject(mesh)
    const size = box.getSize(new THREE.Vector3())
    return Math.max(size.x, size.y, size.z)
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.28))

    const fill = new THREE.DirectionalLight(0x8899cc, 0.55)
    fill.position.set(0.5, 0.8, 1)
    this.scene.add(fill)

    this.spot = new THREE.SpotLight(0xfff8f0, 5)
    this.spot.angle = Math.PI / 7
    this.spot.penumbra = 0.4
    this.spot.decay = 0
    this.spot.castShadow = true
    this.spot.shadow.mapSize.set(2048, 2048)
    this.spot.shadow.bias = -0.0005
    this.scene.add(this.spot)
    this.scene.add(this.spot.target)

    const rim = new THREE.DirectionalLight(0x2233aa, 0.3)
    rim.position.set(-1, 0.3, -2)
    this.scene.add(rim)
  }

  private setupStage(): void {
    const floorMat = new THREE.MeshPhongMaterial({
      color: 0x141428, shininess: 8,
      polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
    })
    this.stageFloor = new THREE.Mesh(new THREE.PlaneGeometry(100000, 100000), floorMat)
    this.stageFloor.rotation.x = -Math.PI / 2
    this.stageFloor.receiveShadow = true
    this.stageFloor.visible = false
    this.scene.add(this.stageFloor)

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

    const floorY = box.min.y - maxDim * 0.12
    if (this.stageFloor) { this.stageFloor.position.set(center.x, floorY, center.z); this.stageFloor.visible = true }
    if (this.stageWall)  { this.stageWall.position.set(center.x, center.y, center.z - maxDim * 2.5); this.stageWall.visible = true }

    if (this.spot) {
      const h = maxDim * 2.2
      this.spot.position.set(center.x + maxDim * 0.15, center.y + h, center.z + h)
      this.spot.target.position.copy(center)
      this.spot.target.updateMatrixWorld()
      const distToTarget = this.spot.position.distanceTo(center)
      this.spot.angle = Math.atan2(maxDim * 1.0, distToTarget) + 0.12
      this.spot.distance = distToTarget * 4
      this.spot.shadow.camera.near = distToTarget * 0.05
      this.spot.shadow.camera.far  = distToTarget * 5
      this.spot.shadow.camera.updateProjectionMatrix()
      this.spot.intensity = 5
    }
  }

  private buildEdgePair(name: string, mesh: THREE.Mesh) {
    const copyT = (src: THREE.Mesh, dst: THREE.LineSegments) => {
      dst.position.copy(src.position)
      dst.quaternion.copy(src.quaternion)
      dst.scale.copy(src.scale)
    }
    const featureGeo = new THREE.EdgesGeometry(mesh.geometry, EDGE_THRESHOLD_ANGLE)
    const feature = new THREE.LineSegments(featureGeo, new THREE.LineBasicMaterial({ color: 0x39ff14 }))
    feature.name = `__edge__${name}`
    copyT(mesh, feature)

    const gridGeo = new THREE.WireframeGeometry(mesh.geometry)
    const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x39ff14, opacity: 0.1, transparent: true }))
    grid.name = `__grid__${name}`
    copyT(mesh, grid)

    return { feature, grid }
  }

  private rebuildEdgeLinesFor(name: string): void {
    const old = this.edgeLines.get(name)
    if (old) { this.scene.remove(old.feature); this.scene.remove(old.grid); this.edgeLines.delete(name) }
    if (this.renderMode === 'shaded') return
    const mesh = this.meshes.get(name)
    if (!mesh) return
    const pair = this.buildEdgePair(name, mesh)
    this.scene.add(pair.feature); this.scene.add(pair.grid)
    this.edgeLines.set(name, pair)
  }

  private rebuildAllEdgeLines(): void {
    for (const pair of this.edgeLines.values()) { this.scene.remove(pair.feature); this.scene.remove(pair.grid) }
    this.edgeLines.clear()
    if (this.renderMode === 'shaded') return
    for (const [name, mesh] of this.meshes) {
      const pair = this.buildEdgePair(name, mesh)
      this.scene.add(pair.feature); this.scene.add(pair.grid)
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

      let meshVisible = true, meshOpacity = 1, meshTransparent = false

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
        mat.colorWrite = false; mat.depthWrite = false; mat.transparent = false; mat.opacity = 1
      } else {
        mat.colorWrite = true; mat.depthWrite = true
        mesh.visible = meshVisible; mat.opacity = meshOpacity; mat.transparent = meshTransparent
      }

      if (pair) {
        const fMat = pair.feature.material as THREE.LineBasicMaterial
        const gMat = pair.grid.material as THREE.LineBasicMaterial
        const dimEdge = this.viewMode === 'ghost' && !isSelected && sel !== null
        const edgeColor = isSelected ? 0xff8844 : 0x39ff14

        if (isWireframe) {
          pair.feature.visible = meshVisible
          pair.grid.visible    = false
          fMat.color.set(edgeColor); fMat.opacity = dimEdge ? 0.12 : 1; fMat.transparent = dimEdge
        } else {
          pair.feature.visible = meshVisible
          pair.grid.visible    = false
          fMat.color.set(edgeColor)
          fMat.opacity = meshOpacity < 1 ? meshOpacity * 0.5 : 0.75
          fMat.transparent = meshTransparent || true
        }
        gMat.color.set(edgeColor)
      }
    }
  }

  private startAnimation(): void {
    const animate = (): void => {
      this.animationId = requestAnimationFrame(animate)
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
      this.labelRenderer.render(this.scene, this.camera)
    }
    animate()
  }

  dispose(): void {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId)
    for (const pair of this.edgeLines.values()) { this.scene.remove(pair.feature); this.scene.remove(pair.grid) }
    this.edgeLines.clear()
    this.clearPins()
    if (this.labelRenderer.domElement.parentNode) {
      this.labelRenderer.domElement.parentNode.removeChild(this.labelRenderer.domElement)
    }
    this.controls.dispose()
    this.renderer.dispose()
  }
}
