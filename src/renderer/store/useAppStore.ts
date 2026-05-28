import { create } from 'zustand'
import type { BOMNode } from '@core/bom/types'
import type { AnnotationPin } from '@core/bom/project'

export type { AnnotationPin }
export type AppMode = 'landing' | 'bom-first' | 'stl-only'
export type RenderMode = 'shaded' | 'wireframe' | 'shaded+edge'
export interface Orientation { x: number; y: number; z: number }

export interface AssignedPart {
  buffer: ArrayBuffer
  filePath: string
  decimated?: boolean
  originalTriangles?: number
}

interface AppState {
  mode: AppMode
  renderMode: RenderMode
  bomTree: BOMNode[]
  bomWarnings: string[]
  bomFilePath: string | null
  assignedParts: Record<string, AssignedPart>
  stlOnlyFileName: string | null
  selectedPartNumber: string | null
  projectPath: string | null
  isDirty: boolean
  isLoading: boolean
  pins: AnnotationPin[]
  globalOrientation: Orientation

  enterBomFirst: (tree: BOMNode[], warnings: string[], filePath: string) => void
  enterStlOnly: (buffer: ArrayBuffer, filePath: string, decimated?: boolean, originalTriangles?: number) => void
  assignPart: (partNumber: string, buffer: ArrayBuffer, filePath: string, decimated?: boolean, originalTriangles?: number) => void
  unassignPart: (partNumber: string) => void
  selectPart: (partNumber: string | null) => void
  setRenderMode: (mode: RenderMode) => void
  setProjectPath: (path: string) => void
  markClean: () => void
  setLoading: (v: boolean) => void
  reset: () => void
  addPin: (pin: AnnotationPin) => void
  updatePin: (id: string, label: string) => void
  removePin: (id: string) => void
  setPins: (pins: AnnotationPin[]) => void
  setGlobalOrientation: (o: Orientation) => void
}

export const useAppStore = create<AppState>((set) => ({
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
  isLoading: false,
  pins: [],
  globalOrientation: { x: 0, y: 0, z: 0 },

  enterBomFirst: (bomTree, bomWarnings, bomFilePath) =>
    set({ mode: 'bom-first', bomTree, bomWarnings, bomFilePath, assignedParts: {}, selectedPartNumber: null, isDirty: false, pins: [] }),

  enterStlOnly: (buffer, filePath, decimated, originalTriangles) => {
    const fileName = filePath.split(/[\\/]/).pop() ?? 'model.stl'
    const partNumber = fileName.replace(/\.stl$/i, '')
    set({
      mode: 'stl-only',
      stlOnlyFileName: fileName,
      assignedParts: { [partNumber]: { buffer, filePath, decimated, originalTriangles } },
      bomTree: [],
      selectedPartNumber: null,
      isDirty: false,
      pins: []
    })
  },

  assignPart: (partNumber, buffer, filePath, decimated, originalTriangles) =>
    set((s) => ({
      assignedParts: { ...s.assignedParts, [partNumber]: { buffer, filePath, decimated, originalTriangles } },
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

  reset: () => set({
    mode: 'landing', renderMode: 'shaded', bomTree: [], bomWarnings: [],
    bomFilePath: null, assignedParts: {}, stlOnlyFileName: null,
    selectedPartNumber: null, projectPath: null, isDirty: false, isLoading: false, pins: []
  }),

  addPin: (pin) => set((s) => ({ pins: [...s.pins, pin], isDirty: true })),
  updatePin: (id, label) =>
    set((s) => ({ pins: s.pins.map(p => p.id === id ? { ...p, label } : p), isDirty: true })),
  removePin: (id) => set((s) => ({ pins: s.pins.filter(p => p.id !== id), isDirty: true })),
  setPins: (pins) => set({ pins }),
  setGlobalOrientation: (globalOrientation) => set({ globalOrientation }),
}))
