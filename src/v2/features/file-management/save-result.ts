export type PerformanceCheckSaveStatus = 'saved' | 'missing' | 'not_requested'

export interface TruckSaveResult {
  performanceCheckImageCount: number
  performanceCheckStatus: PerformanceCheckSaveStatus
  vehicleFolderName: string
  vehicleNumber: string
}
