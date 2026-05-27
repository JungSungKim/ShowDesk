import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

export interface LoadedSTL {
  geometry: THREE.BufferGeometry
  name: string
  mesh: THREE.Mesh
}

export function loadSTLFromBuffer(buffer: ArrayBuffer, fileName: string): LoadedSTL {
  const loader = new STLLoader()
  const geometry = loader.parse(buffer)

  geometry.computeVertexNormals()
  geometry.center()

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
