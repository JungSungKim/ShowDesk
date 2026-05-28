import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  openFileDialog: (filters: Electron.FileFilter[]) =>
    ipcRenderer.invoke('dialog:openFile', filters),
  saveFileDialog: (filters: Electron.FileFilter[], defaultName?: string) =>
    ipcRenderer.invoke('dialog:saveFile', filters, defaultName),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  loadSTL: (filePath: string) => ipcRenderer.invoke('stl:load', filePath),
  writeFile: (filePath: string, data: string | ArrayBuffer) =>
    ipcRenderer.invoke('fs:writeFile', filePath, data),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
