import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class SceneManager {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private animationId: number | null = null
  private meshes = new Map<string, THREE.Mesh>()

  constructor(canvas: HTMLCanvasElement) {
    const { clientWidth: w, clientHeight: h } = canvas

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)
    this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.0008)

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 50000)
    this.camera.position.set(0, 80, 200)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(w, h, false)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.setupLights()
    this.setupGrid()

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
    this.meshes.set(name, mesh)
    this.scene.add(mesh)
    this.fitCamera()
  }

  removeNamedMesh(name: string): void {
    const mesh = this.meshes.get(name)
    if (mesh) {
      this.scene.remove(mesh)
      this.meshes.delete(name)
      if (this.meshes.size > 0) this.fitCamera()
    }
  }

  clearMeshes(): void {
    for (const mesh of this.meshes.values()) this.scene.remove(mesh)
    this.meshes.clear()
  }

  hasMesh(name: string): boolean {
    return this.meshes.has(name)
  }

  // ── 하이라이트 ──────────────────────────────────────────────

  highlight(name: string | null): void {
    for (const [key, mesh] of this.meshes) {
      const mat = mesh.material as THREE.MeshPhongMaterial
      mat.color.set(key === name ? 0xff6b00 : 0xb0b8c8)
      mat.opacity = 1
      mat.transparent = false
    }
  }

  // ── 렌더 모드 ───────────────────────────────────────────────

  setRenderMode(mode: 'shaded' | 'wireframe' | 'shaded+edge'): void {
    for (const mesh of this.meshes.values()) {
      const mat = mesh.material as THREE.MeshPhongMaterial
      mat.wireframe = mode === 'wireframe'
    }
  }

  // ── 레이캐스트 (3D 클릭 → 파트 감지) ─────────────────────────

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
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6))

    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.position.set(5, 10, 8)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0x8899cc, 0.4)
    fill.position.set(-5, 2, -5)
    this.scene.add(fill)

    const rim = new THREE.DirectionalLight(0xffeedd, 0.3)
    rim.position.set(0, -3, -8)
    this.scene.add(rim)
  }

  private setupGrid(): void {
    const grid = new THREE.GridHelper(1000, 50, 0x2a2a4a, 0x222240)
    ;(grid.material as THREE.Material).opacity = 0.6
    ;(grid.material as THREE.Material).transparent = true
    this.scene.add(grid)
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
    this.controls.dispose()
    this.renderer.dispose()
  }
}
