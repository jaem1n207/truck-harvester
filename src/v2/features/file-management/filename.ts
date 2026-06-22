const unsafeFileNameCharacters = /[<>:"/\\|?*]/g
const emptyVehicleNumberFallback = '차량번호_없음'

export function buildVehicleImagesFolderName() {
  return '차량 이미지'
}

export function buildPerformanceCheckFolderName() {
  return '성능점검기록부'
}

export function buildManuscriptFolderName() {
  return '원고'
}

export function buildVehicleImageFileName(index: number) {
  return `사진_${index + 1}.jpg`
}

export function buildPerformanceCheckImageFileName(index: number) {
  return `성능점검기록부_${index + 1}.jpg`
}

export function buildManuscriptFileName() {
  return '차량정보.txt'
}

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
