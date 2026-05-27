export const PROJECT_VERSION = '1.0'
export const PROJECT_EXT = '.showdesk'

export interface AnnotationPin {
  id: string
  position: { x: number; y: number; z: number }
  label: string
  partNumber: string | null
}

export interface ShowDeskProject {
  version: typeof PROJECT_VERSION
  bomFilePath: string
  parts: Array<{
    partNumber: string
    stlFilePath: string
  }>
  pins?: AnnotationPin[]
}

export function serializeProject(project: ShowDeskProject): string {
  return JSON.stringify(project, null, 2)
}

export function deserializeProject(json: string): ShowDeskProject {
  const data = JSON.parse(json) as ShowDeskProject
  if (!data.version || !Array.isArray(data.parts)) {
    throw new Error('올바른 ShowDesk 프로젝트 파일이 아닙니다.')
  }
  return data
}
