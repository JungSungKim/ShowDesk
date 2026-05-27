import * as XLSX from 'xlsx'

export function xlsxToCsv(buffer: ArrayBuffer): string {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_csv(sheet)
}
