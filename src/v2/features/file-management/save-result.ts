export type PerformanceCheckSaveStatus = 'saved' | 'missing' | 'not_requested'
export type VehicleImageSaveStatus = 'complete' | 'partial'

export interface TruckSaveResult {
  performanceCheckImageCount: number
  performanceCheckStatus: PerformanceCheckSaveStatus
  sourceUrl: string
  vehicleImageCount: number
  vehicleImageStatus: VehicleImageSaveStatus
  vehicleImageTotalCount: number
  vehicleFolderName: string
  vehicleNumber: string
}
