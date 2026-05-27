import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

export interface LoadedSTL {
  geometry: THREE.BufferGeometry
  name: string
  mesh: THREE.Mesh
}

export function loadSTLFromBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  { center = false }: { center?: boolean } = {}
): LoadedSTL {
  const loader = new STLLoader()
  const geometry = loader.parse(buffer)

  geometry.computeVertexNormals()
  // center=true 는 STL-only 단독 뷰에서만 사용
  // BOM-first 어셈블리 모드에서는 원래 좌표 유지
  if (center) geometry.center()

  const name = fileName.replace(/\.stl$/i, '')

  const material = new THREE.MeshPhongMaterial({
    color: 0xb0b8c8,
    specular: 0x333344,
    shininess: 50,
    side: THREE.DoubleSide
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true

  return { geometry, name, mesh }
}
