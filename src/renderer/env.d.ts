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
      writeFile: (filePath: string, data: string | ArrayBuffer) => Promise<void>
      openDirectoryDialog: () => Promise<string | null>
      readDir: (dirPath: string) => Promise<{ name: string; fullPath: string }[]>
    }
  }
}

export {}
