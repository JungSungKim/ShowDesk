import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFile, writeFile, readdir, stat, open } from 'fs/promises'
import { is } from '@electron-toolkit/utils'
import { loadSTEPAsSTL, loadIGESAsSTL } from './cadLoader'

// Binary STL 샘플링 — 최대 폴리곤 수 초과 시 stride로 다운샘플
const STL_MAX_TRIANGLES = 500_000
const STL_SMALL_THRESHOLD = 50 * 1024 * 1024 // 50 MB 이하 → 직접 읽기

// ── VRML2 → binary STL 변환 (Node.js, Three.js 불필요) ──────────

function extractBracketContent(text: string, fromIdx: number): { content: string; end: number } {
  const start = text.indexOf('[', fromIdx)
  if (start === -1) return { content: '', end: fromIdx }
  let depth = 1, i = start + 1
  while (i < text.length && depth > 0) {
    const c = text[i]
    if (c === '[') depth++
    else if (c === ']') depth--
    i++
  }
  return { content: text.slice(start + 1, i - 1), end: i }
}

function parseNums(s: string): number[] {
  const result: number[] = []
  const re = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) result.push(+m[0])
  return result
}

function convertWRLToBinarySTL(text: string, maxTri: number): Buffer {
  // 1패스: 모든 삼각형 수집
  const verts: number[] = []  // flat x0 y0 z0 x1 y1 z1 x2 y2 z2 per triangle

  let pos = 0
  while (pos < text.length) {
    const ifsIdx = text.indexOf('IndexedFaceSet', pos)
    if (ifsIdx === -1) break

    // IFS 여는 중괄호 찾기
    const openBrace = text.indexOf('{', ifsIdx)
    if (openBrace === -1) { pos = ifsIdx + 14; continue }

    // IFS 닫는 중괄호 (brace 매칭)
    let depth = 1, ci = openBrace + 1
    while (ci < text.length && depth > 0) {
      if (text[ci] === '{') depth++
      else if (text[ci] === '}') depth--
      ci++
    }
    const ifsText = text.slice(openBrace + 1, ci - 1)
    pos = ci

    // point [] 추출
    const pKeyIdx = ifsText.indexOf('point')
    if (pKeyIdx === -1) continue
    const { content: pointContent } = extractBracketContent(ifsText, pKeyIdx)
    const pts = parseNums(pointContent)
    if (pts.length < 9) continue  // 최소 3개 꼭짓점

    // coordIndex [] 추출
    const ciKeyIdx = ifsText.indexOf('coordIndex')
    if (ciKeyIdx === -1) continue
    const { content: idxContent } = extractBracketContent(ifsText, ciKeyIdx)
    const indices = parseNums(idxContent)

    // 폴리곤 → 삼각형 (fan triangulation)
    const face: number[] = []
    for (const idx of indices) {
      if (idx < 0) {
        // face 완성
        for (let k = 1; k < face.length - 1; k++) {
          const i0 = face[0], i1 = face[k], i2 = face[k + 1]
          if (i0 * 3 + 2 >= pts.length || i1 * 3 + 2 >= pts.length || i2 * 3 + 2 >= pts.length) continue
          verts.push(
            pts[i0*3], pts[i0*3+1], pts[i0*3+2],
            pts[i1*3], pts[i1*3+1], pts[i1*3+2],
            pts[i2*3], pts[i2*3+1], pts[i2*3+2]
          )
        }
        face.length = 0
      } else {
        face.push(idx)
      }
    }
  }

  const totalTri = verts.length / 9
  const stride = Math.max(1, Math.ceil(totalTri / maxTri))
  const outCount = Math.ceil(totalTri / stride)

  const buf = Buffer.alloc(84 + outCount * 50)
  Buffer.from('ShowDesk WRL conversion').copy(buf, 0)
  buf.writeUInt32LE(outCount, 80)

  let outOff = 84
  for (let i = 0; i < totalTri; i += stride) {
    const b = i * 9
    const ax = verts[b+3]-verts[b],   ay = verts[b+4]-verts[b+1], az = verts[b+5]-verts[b+2]
    const bx = verts[b+6]-verts[b],   by = verts[b+7]-verts[b+1], bz = verts[b+8]-verts[b+2]
    const nx = ay*bz - az*by, ny = az*bx - ax*bz, nz = ax*by - ay*bx
    const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1
    buf.writeFloatLE(nx/len, outOff);   buf.writeFloatLE(ny/len, outOff+4); buf.writeFloatLE(nz/len, outOff+8)
    for (let j = 0; j < 9; j++) buf.writeFloatLE(verts[b+j], outOff + 12 + j*4)
    buf.writeUInt16LE(0, outOff+48)
    outOff += 50
  }

  return buf.slice(0, outOff)
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── IPC: 파일 다이얼로그 ────────────────────────────────────────

ipcMain.handle('dialog:openFile', async (_e, filters: Electron.FileFilter[]) => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:saveFile', async (_e, filters: Electron.FileFilter[], defaultName?: string) => {
  const result = await dialog.showSaveDialog({ filters, defaultPath: defaultName })
  return result.canceled ? null : result.filePath
})

// ── IPC: 파일 시스템 ────────────────────────────────────────────

ipcMain.handle('fs:readFile', async (_e, filePath: string) => {
  const buf = await readFile(filePath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
})

ipcMain.handle('fs:writeFile', async (_e, filePath: string, data: string | ArrayBuffer) => {
  if (typeof data === 'string') {
    await writeFile(filePath, data, 'utf-8')
  } else {
    await writeFile(filePath, Buffer.from(data))
  }
})

// ── IPC: STL 로드 (대용량 자동 다운샘플) ───────────────────────

export interface STLLoadResult {
  buffer: ArrayBuffer
  decimated: boolean
  originalTriangles: number
}

const CHUNK_SIZE = 10 * 1024 * 1024  // 10 MB 텍스트 청크

async function loadBinarySTLDecimated(filePath: string, size: number): Promise<STLLoadResult> {
  const fh = await open(filePath, 'r')
  try {
    const header = Buffer.alloc(84)
    await fh.read(header, 0, 84, 0)

    const triangleCount = header.readUInt32LE(80)
    const expectedSize = 84 + triangleCount * 50
    if (Math.abs(size - expectedSize) > 4096) {
      throw new Error('NOT_BINARY')
    }

    const stride = Math.max(1, Math.ceil(triangleCount / STL_MAX_TRIANGLES))
    const outCount = Math.ceil(triangleCount / stride)
    const outBuf = Buffer.alloc(84 + outCount * 50)
    header.copy(outBuf, 0, 0, 80)
    outBuf.writeUInt32LE(outCount, 80)

    const CHUNK_TRI = 200_000
    const chunkBuf = Buffer.alloc(CHUNK_TRI * 50)
    let triIndex = 0
    let outOffset = 84

    while (triIndex < triangleCount) {
      const readCount = Math.min(CHUNK_TRI, triangleCount - triIndex)
      const { bytesRead } = await fh.read(chunkBuf, 0, readCount * 50, 84 + triIndex * 50)
      const actual = Math.floor(bytesRead / 50)
      for (let j = 0; j < actual; j++) {
        if ((triIndex + j) % stride === 0) {
          chunkBuf.copy(outBuf, outOffset, j * 50, j * 50 + 50)
          outOffset += 50
        }
      }
      triIndex += readCount
    }

    const result = outBuf.slice(0, outOffset)
    return {
      buffer: result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength),
      decimated: stride > 1,
      originalTriangles: triangleCount
    }
  } finally {
    await fh.close()
  }
}

async function loadAsciiSTLDecimated(filePath: string): Promise<STLLoadResult> {
  // 1패스: 삼각형 수 카운트
  let totalTriangles = 0
  {
    const fh = await open(filePath, 'r')
    try {
      const chunk = Buffer.alloc(CHUNK_SIZE)
      let pos = 0
      let remainder = ''
      while (true) {
        const { bytesRead } = await fh.read(chunk, 0, CHUNK_SIZE, pos)
        if (bytesRead === 0) break
        const text = remainder + chunk.subarray(0, bytesRead).toString('latin1')
        const lines = text.split('\n')
        remainder = lines.pop() ?? ''
        for (const line of lines) {
          if (line.trimStart().startsWith('facet')) totalTriangles++
        }
        pos += bytesRead
      }
      if (remainder.trimStart().startsWith('facet')) totalTriangles++
    } finally {
      await fh.close()
    }
  }

  const stride = Math.max(1, Math.ceil(totalTriangles / STL_MAX_TRIANGLES))
  const outCount = Math.ceil(totalTriangles / stride)
  const outBuf = Buffer.alloc(84 + outCount * 50)
  Buffer.from('ShowDesk ASCII→Binary decimated').copy(outBuf, 0)
  outBuf.writeUInt32LE(outCount, 80)

  // 2패스: 선택된 삼각형 파싱 → binary 출력
  {
    const fh = await open(filePath, 'r')
    try {
      const chunk = Buffer.alloc(CHUNK_SIZE)
      let pos = 0
      let remainder = ''
      let triIndex = 0
      let outOffset = 84

      let nx = 0, ny = 0, nz = 0
      const verts: number[] = []
      let inFacet = false
      let keep = false

      const processLine = (raw: string): void => {
        const line = raw.trim()
        if (line.startsWith('facet normal')) {
          inFacet = true
          verts.length = 0
          keep = (triIndex % stride === 0)
          if (keep) {
            const p = line.split(/\s+/)
            nx = parseFloat(p[2]) || 0
            ny = parseFloat(p[3]) || 0
            nz = parseFloat(p[4]) || 0
          }
        } else if (line.startsWith('vertex') && keep) {
          const p = line.split(/\s+/)
          verts.push(parseFloat(p[1]) || 0, parseFloat(p[2]) || 0, parseFloat(p[3]) || 0)
        } else if (line === 'endfacet') {
          if (inFacet) {
            inFacet = false
            if (keep && verts.length === 9) {
              outBuf.writeFloatLE(nx, outOffset)
              outBuf.writeFloatLE(ny, outOffset + 4)
              outBuf.writeFloatLE(nz, outOffset + 8)
              for (let i = 0; i < 9; i++) outBuf.writeFloatLE(verts[i], outOffset + 12 + i * 4)
              outBuf.writeUInt16LE(0, outOffset + 48)
              outOffset += 50
            }
            triIndex++
          }
        }
      }

      while (true) {
        const { bytesRead } = await fh.read(chunk, 0, CHUNK_SIZE, pos)
        if (bytesRead === 0) break
        const text = remainder + chunk.subarray(0, bytesRead).toString('latin1')
        const lines = text.split('\n')
        remainder = lines.pop() ?? ''
        for (const line of lines) processLine(line)
        pos += bytesRead
      }
      if (remainder) processLine(remainder)
    } finally {
      await fh.close()
    }
  }

  const result = outBuf.slice(0, 84 + outCount * 50)
  return {
    buffer: result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength),
    decimated: stride > 1,
    originalTriangles: totalTriangles
  }
}

ipcMain.handle('stl:load', async (_e, filePath: string): Promise<STLLoadResult> => {
  const { size } = await stat(filePath)
  const lower = filePath.toLowerCase()

  // STEP/IGES — opencascade.js WASM으로 테셀레이션
  if (lower.endsWith('.step') || lower.endsWith('.stp')) {
    const buf = await readFile(filePath)
    const stlBuf = await loadSTEPAsSTL(buf, lower.split(/[\\/]/).pop()!)
    const totalTri = stlBuf.readUInt32LE(80)
    return {
      buffer: stlBuf.buffer.slice(stlBuf.byteOffset, stlBuf.byteOffset + stlBuf.byteLength),
      decimated: false,
      originalTriangles: totalTri
    }
  }

  if (lower.endsWith('.igs') || lower.endsWith('.iges')) {
    const buf = await readFile(filePath)
    const stlBuf = await loadIGESAsSTL(buf, lower.split(/[\\/]/).pop()!)
    const totalTri = stlBuf.readUInt32LE(80)
    return {
      buffer: stlBuf.buffer.slice(stlBuf.byteOffset, stlBuf.byteOffset + stlBuf.byteLength),
      decimated: false,
      originalTriangles: totalTri
    }
  }

  // WRL — Node.js에서 직접 파싱 → binary STL 변환 (renderer 크래시 방지)
  if (lower.endsWith('.wrl') || lower.endsWith('.vrml')) {
    const text = await readFile(filePath, 'latin1')
    const stlBuf = convertWRLToBinarySTL(text, STL_MAX_TRIANGLES)
    const totalTri = stlBuf.readUInt32LE(80)
    return {
      buffer: stlBuf.buffer.slice(stlBuf.byteOffset, stlBuf.byteOffset + stlBuf.byteLength),
      decimated: false,
      originalTriangles: totalTri
    }
  }

  // STL 소형 파일 — 직접 읽기
  if (size <= STL_SMALL_THRESHOLD) {
    const buf = await readFile(filePath)
    return {
      buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      decimated: false,
      originalTriangles: 0
    }
  }

  // 대형 STL — Binary 시도, 실패 시 ASCII 스트리밍
  try {
    return await loadBinarySTLDecimated(filePath, size)
  } catch (e) {
    if ((e as Error).message !== 'NOT_BINARY') throw e
    return await loadAsciiSTLDecimated(filePath)
  }
})

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('fs:readDir', async (_e, dirPath: string) => {
  const names = await readdir(dirPath)
  return names.map(name => ({ name, fullPath: join(dirPath, name) }))
})

// ── 앱 수명 주기 ────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
