// CAD 파일(STEP/IGES) → binary STL 변환
// occt-import-js: Node.js CJS, WASM 기반 STEP/IGES 메시 임포터

/* eslint-disable @typescript-eslint/no-var-requires */
import { dirname, resolve } from 'path'

let ocInstance: any = null

async function getOC(): Promise<any> {
  if (ocInstance) return ocInstance

  const occtImportJs = require('occt-import-js')
  const modPath: string = require.resolve('occt-import-js')
  const modDir: string = dirname(modPath)
  const wasmPath: string = resolve(modDir, 'occt-import-js.wasm')

  ocInstance = await occtImportJs({
    locateFile(p: string) {
      if (p.endsWith('.wasm')) return wasmPath
      return resolve(modDir, p)
    }
  })
  return ocInstance
}

// occt-import-js 결과 메시 → binary STL Buffer
function meshesToSTLBuffer(meshes: any[]): Buffer {
  // 전체 삼각형 수 집계
  let totalTri = 0
  for (const mesh of meshes) {
    const idx = mesh.index?.array
    if (idx) totalTri += idx.length / 3
    else totalTri += (mesh.attributes?.position?.array?.length ?? 0) / 9
  }

  const buf = Buffer.alloc(84 + totalTri * 50)
  Buffer.from('ShowDesk STEP/IGES').copy(buf, 0)
  buf.writeUInt32LE(totalTri, 80)

  let off = 84
  for (const mesh of meshes) {
    const pos: Float32Array = mesh.attributes?.position?.array
    const norm: Float32Array = mesh.attributes?.normal?.array
    const idx: Uint32Array | null = mesh.index?.array ?? null

    if (!pos) continue

    const triCount = idx ? idx.length / 3 : pos.length / 9

    for (let t = 0; t < triCount; t++) {
      let i0: number, i1: number, i2: number
      if (idx) {
        i0 = idx[t * 3]; i1 = idx[t * 3 + 1]; i2 = idx[t * 3 + 2]
      } else {
        i0 = t * 3; i1 = t * 3 + 1; i2 = t * 3 + 2
      }

      // 법선 (있으면 첫 번째 정점 법선 사용, 없으면 계산)
      let nx = 0, ny = 0, nz = 1
      if (norm) {
        nx = norm[i0 * 3]; ny = norm[i0 * 3 + 1]; nz = norm[i0 * 3 + 2]
      } else {
        const ax = pos[i1*3]-pos[i0*3], ay = pos[i1*3+1]-pos[i0*3+1], az = pos[i1*3+2]-pos[i0*3+2]
        const bx = pos[i2*3]-pos[i0*3], by = pos[i2*3+1]-pos[i0*3+1], bz = pos[i2*3+2]-pos[i0*3+2]
        nx = ay*bz - az*by; ny = az*bx - ax*bz; nz = ax*by - ay*bx
        const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1
        nx /= len; ny /= len; nz /= len
      }

      buf.writeFloatLE(nx, off);     buf.writeFloatLE(ny, off+4);   buf.writeFloatLE(nz, off+8)
      buf.writeFloatLE(pos[i0*3],   off+12); buf.writeFloatLE(pos[i0*3+1], off+16); buf.writeFloatLE(pos[i0*3+2], off+20)
      buf.writeFloatLE(pos[i1*3],   off+24); buf.writeFloatLE(pos[i1*3+1], off+28); buf.writeFloatLE(pos[i1*3+2], off+32)
      buf.writeFloatLE(pos[i2*3],   off+36); buf.writeFloatLE(pos[i2*3+1], off+40); buf.writeFloatLE(pos[i2*3+2], off+44)
      buf.writeUInt16LE(0, off+48)
      off += 50
    }
  }

  // 실제 기록된 크기로 자르기
  return buf.slice(0, off)
}

export async function loadSTEPAsSTL(fileData: Buffer, _fileName: string): Promise<Buffer> {
  const oc = await getOC()
  const content = new Uint8Array(fileData.buffer, fileData.byteOffset, fileData.byteLength)
  const result = oc.ReadStepFile(content, null)

  if (!result.success || !result.meshes?.length) {
    throw new Error('STEP 파일에서 메시를 읽을 수 없습니다')
  }

  return meshesToSTLBuffer(result.meshes)
}

export async function loadIGESAsSTL(fileData: Buffer, _fileName: string): Promise<Buffer> {
  const oc = await getOC()
  const content = new Uint8Array(fileData.buffer, fileData.byteOffset, fileData.byteLength)
  const result = oc.ReadIgesFile(content, null)

  if (!result.success || !result.meshes?.length) {
    throw new Error('IGES 파일에서 메시를 읽을 수 없습니다')
  }

  return meshesToSTLBuffer(result.meshes)
}
