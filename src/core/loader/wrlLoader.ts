import * as THREE from 'three'
import { VRMLLoader } from 'three/examples/jsm/loaders/VRMLLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export interface LoadedModel {
  geometry: THREE.BufferGeometry
  name: string
  mesh: THREE.Mesh
}

export function loadWRLFromBuffer(buffer: ArrayBuffer, partName: string): LoadedModel {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  const loader = new VRMLLoader()
  const group = loader.parse(text, '')

  // 그룹에서 모든 Mesh 수집, 월드 매트릭스 적용
  const geos: THREE.BufferGeometry[] = []
  let hasVertexColors = false

  group.updateWorldMatrix(true, true)
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const geo = child.geometry.clone()
    child.updateWorldMatrix(true, false)
    geo.applyMatrix4(child.matrixWorld)

    // vertex color 속성 유지 여부 확인
    if (geo.attributes.color) hasVertexColors = true

    // color 속성이 없는 경우 더미로 채워 merge 가능하게
    geos.push(geo)
  })

  if (geos.length === 0) throw new Error('WRL 파일에서 메시를 찾을 수 없습니다.')

  // 모든 지오메트리에 color 속성 통일 (merge 조건 맞추기)
  if (hasVertexColors) {
    for (const geo of geos) {
      if (!geo.attributes.color) {
        const pos = geo.attributes.position
        const colors = new Float32Array(pos.count * 3).fill(0.69) // 기본 회색
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      }
    }
  }

  const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
  merged.computeVertexNormals()

  const material = new THREE.MeshPhongMaterial({
    specular: 0x333344,
    shininess: 50,
    side: THREE.DoubleSide,
    ...(hasVertexColors
      ? { vertexColors: true }
      : { color: 0xb0b8c8 }),
  })

  const mesh = new THREE.Mesh(merged, material)
  mesh.name = partName
  mesh.castShadow = true
  mesh.receiveShadow = true

  return { geometry: merged, name: partName, mesh }
}
