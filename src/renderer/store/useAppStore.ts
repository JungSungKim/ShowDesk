import { create } from 'zustand'
import type { BOMNode } from '@core/bom/types'

export type AppMode = 'landing' | 'bom-first' | 'stl-only'
export type RenderMode = 'shaded' | 'wireframe' | 'shaded+edge'

export interface AssignedPart {
  buffer: ArrayBuffer
  filePath: string
}

interface AppState {
  mode: AppMode
  renderMode: RenderMode

  // BOM
  bomTree: BOMNode[]
  bomWarnings: string[]
  bomFilePath: string | null

  // 파트별 STL (partNumber → 할당 정보)
  assignedParts: Record<string, AssignedPart>

  // STL-only 모드에서의 단일 파일명
  stlOnlyFileName: string | null

  // 선택된 파트
  selectedPartNumber: string | null

  // 프로젝트
  projectPath: string | null
  isDirty: boolean

  // 로딩
  isLoading: boolean

  // Actions
  enterBomFirst: (tree: BOMNode[], warnings: string[], filePath: string) => void
  enterStlOnly: (buffer: ArrayBuffer, filePath: string) => void
  assignPart: (partNumber: string, buffer: ArrayBuffer, filePath: string) => void
  unassignPart: (partNumber: string) => void
  selectPart: (partNumber: string | null) => void
  setRenderMode: (mode: RenderMode) => void
  setProjectPath: (path: string) => void
  markClean: () => void
  setLoading: (v: boolean) => void
  reset: () => void
}

const initialState: Omit<AppState, keyof Omit<AppState, keyof {
  mode: AppMode; renderMode: RenderMode; bomTree: BOMNode[]; bomWarnings: string[];
  bomFilePath: null; assignedParts: Record<string, AssignedPart>; stlOnlyFileName: null;
  selectedPartNumber: null; projectPath: null; isDirty: boolean; isLoading: boolean;
}>> = {
  mode: 'landing',
  renderMode: 'shaded',
  bomTree: [],
  bomWarnings: [],
  bomFilePath: null,
  assignedParts: {},
  stlOnlyFileName: null,
  selectedPartNumber: null,
  projectPath: null,
  isDirty: false,
  isLoading: false
}

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  enterBomFirst: (bomTree, bomWarnings, bomFilePath) =>
    set({ mode: 'bom-first', bomTree, bomWarnings, bomFilePath, assignedParts: {}, selectedPartNumber: null, isDirty: false }),

  enterStlOnly: (buffer, filePath) => {
    const fileName = filePath.split(/[\\/]/).pop() ?? 'model.stl'
    const partNumber = fileName.replace(/\.stl$/i, '')
    set({
      mode: 'stl-only',
      stlOnlyFileName: fileName,
      assignedParts: { [partNumber]: { buffer, filePath } },
      bomTree: [],
      selectedPartNumber: null,
      isDirty: false
    })
  },

  assignPart: (partNumber, buffer, filePath) =>
    set((s) => ({
      assignedParts: { ...s.assignedParts, [partNumber]: { buffer, filePath } },
      isDirty: true
    })),

  unassignPart: (partNumber) =>
    set((s) => {
      const next = { ...s.assignedParts }
      delete next[partNumber]
      return { assignedParts: next, isDirty: true }
    }),

  selectPart: (selectedPartNumber) => set({ selectedPartNumber }),
  setRenderMode: (renderMode) => set({ renderMode }),
  setProjectPath: (projectPath) => set({ projectPath }),
  markClean: () => set({ isDirty: false }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ ...initialState })
}))
