const unsafeFileNameCharacters = /[<>:"/\\|?*]/g
const emptyVehicleNumberFallback = '차량번호_없음'

export function buildImageFileName(index: number) {
  return `K-${String(index + 1).padStart(3, '0')}.jpg`
}

export function buildTruckFolderName(vehicleNumber: string) {
  const sanitized = vehicleNumber.trim().replace(unsafeFileNameCharacters, '_')
  return sanitized || emptyVehicleNumberFallback
}

export function buildTextFileName(vehicleNumber: string) {
  return `${buildTruckFolderName(vehicleNumber)} 원고.txt`
}
