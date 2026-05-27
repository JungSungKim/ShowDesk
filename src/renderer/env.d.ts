interface FileFilter {
  name: string
  extensions: string[]
}

declare global {
  interface Window {
    api: {
      openFileDialog: (filters: FileFilter[]) => Promise<string | null>
      saveFileDialog: (filters: FileFilter[], defaultName?: string) => Promise<string | null>
      readFile: (filePath: string) => Promise<ArrayBuffer>
      writeFile: (filePath: string, data: string) => Promise<void>
    }
  }
}

export {}
