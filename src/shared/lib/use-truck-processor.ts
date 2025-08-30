import { useCallback } from 'react'

import {
  checkAndRequestPermission,
  downloadAsZip,
  downloadTruckData,
  isFileSystemAccessSupported,
  selectDirectory,
  storeDirectoryHandle,
} from '@/shared/lib/file-system'
import {
  addTruckProcessingBreadcrumb,
  captureException,
  measureOperation,
  setTruckProcessingContext,
} from '@/shared/lib/sentry-utils'
import { getValidUrls, validateUrlsFromText } from '@/shared/lib/url-validator'
import { useAppStore } from '@/shared/model/store'
import {
  ParseResponse,
  getValidTruckData,
  isValidTruckData,
} from '@/shared/model/truck'

export const useTruckProcessor = () => {
  const {
    urlsText,
    config,
    updateConfig,
    directoryHandle,
    setDirectoryHandle,
    currentStep,
    setTruckData,
    setParseResult,
    setCurrentStep,
    setIsProcessing,
    setDownloadStatus,
    resetDownloadStatuses,
    abortController,
    setAbortController,
  } = useAppStore()

  const processUrls = useCallback(async () => {
    const urlResults = validateUrlsFromText(urlsText)
    const validUrls = getValidUrls(urlResults)

    if (validUrls.length === 0) {
      addTruckProcessingBreadcrumb('url_validation', {
        error: 'no_valid_urls',
        totalUrls: urlResults.length,
      })
      return
    }

    // Create abort controller
    const controller = new AbortController()
    setAbortController(controller)
    setIsProcessing(true)
    setCurrentStep('parsing')

    // Sentry 컨텍스트 설정
    setTruckProcessingContext({
      operation: 'parse',
      urlCount: validUrls.length,
    })

    addTruckProcessingBreadcrumb('url_validation', {
      validUrls: validUrls.length,
      totalUrls: urlResults.length,
    })

    try {
      // Step 1: Parse URLs with performance tracking
      const parseResult = (await measureOperation(
        'truck-processing-parse',
        async () => {
          const parseResponse = await fetch('/api/parse-truck', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              urls: validUrls,
              rateLimitMs: config.rateLimitMs,
              timeoutMs: config.timeoutMs,
            }),
            signal: controller.signal,
          })

          if (!parseResponse.ok) {
            throw new Error(`API 요청 실패: ${parseResponse.status}`)
          }

          return await parseResponse.json()
        },
        {
          urlCount: validUrls.length,
          rateLimitMs: config.rateLimitMs,
          timeoutMs: config.timeoutMs,
        }
      )) as ParseResponse

      setParseResult(parseResult)

      if (!parseResult.success || !parseResult.data) {
        throw new Error(parseResult.error || '파싱 실패')
      }

      const truckDataList = parseResult.data
      setTruckData(truckDataList)

      // Filter out invalid truck data (Error values) for downloads
      const validTruckData = getValidTruckData(truckDataList)
      const invalidTruckData = truckDataList.filter(
        (truck) => !isValidTruckData(truck)
      )

      addTruckProcessingBreadcrumb('parsing_success', {
        successCount: validTruckData.length,
        failedCount: invalidTruckData.length,
        totalCount: truckDataList.length,
      })

      // Step 2: Download files with tracking (only for valid data)
      setCurrentStep('downloading')
      resetDownloadStatuses()

      // 컨텍스트 업데이트
      setTruckProcessingContext({
        operation: 'download',
        urlCount: validTruckData.length,
      })

      addTruckProcessingBreadcrumb('download_start', {
        downloadMode:
          config.selectedDirectory === 'ZIP_DOWNLOAD' ? 'zip' : 'filesystem',
        vehicleCount: validTruckData.length,
      })

      // Initialize download statuses for valid data only
      validTruckData.forEach((truck) => {
        setDownloadStatus(truck.vnumber, {
          vehicleNumber: truck.vnumber,
          status: 'pending',
          progress: 0,
          downloadedImages: 0,
          totalImages: truck.images.length,
        })
      })

      // Mark invalid data as failed without processing
      invalidTruckData.forEach((truck) => {
        setDownloadStatus(truck.vnumber, {
          vehicleNumber: truck.vnumber,
          status: 'failed',
          progress: 0,
          downloadedImages: 0,
          totalImages: 0,
          error: truck.error || '파싱 실패',
        })
      })

      console.log('[use-truck-processor] Starting download phase', {
        selectedDirectory: config.selectedDirectory,
        validTruckDataCount: validTruckData.length,
      })

      await measureOperation(
        'truck-processing-download',
        async () => {
          // 다운로드 방식 결정
          let shouldUseZipMode =
            config.selectedDirectory === 'ZIP_DOWNLOAD' ||
            !isFileSystemAccessSupported()
          let permissionCheckResult = false

          // File System Access API 모드에서 directoryHandle 권한 확인
          if (!shouldUseZipMode && directoryHandle) {
            try {
              console.log(
                '[use-truck-processor] Checking directory permissions...'
              )
              permissionCheckResult =
                await checkAndRequestPermission(directoryHandle)
              console.log(
                '[use-truck-processor] Permission check result:',
                permissionCheckResult
              )

              if (!permissionCheckResult) {
                console.log(
                  '[use-truck-processor] Permission denied, falling back to ZIP mode'
                )
                shouldUseZipMode = true
              }
            } catch (error) {
              console.warn(
                '[use-truck-processor] Permission check failed:',
                error
              )
              shouldUseZipMode = true
            }
          } else if (!shouldUseZipMode && !directoryHandle) {
            shouldUseZipMode = true
          }

          if (shouldUseZipMode) {
            console.log('[use-truck-processor] Using ZIP download mode', {
              reason:
                config.selectedDirectory === 'ZIP_DOWNLOAD'
                  ? 'user_selected_zip'
                  : !isFileSystemAccessSupported()
                    ? 'api_not_supported'
                    : !directoryHandle
                      ? 'no_directory_handle'
                      : 'permission_denied',
            })

            // ZIP download mode (only process valid data)
            await downloadAsZip(
              validTruckData,
              (progress) => {
                console.log(`ZIP 진행률: ${progress}%`)
              },
              controller.signal
            )

            // Mark valid data as completed
            validTruckData.forEach((truck) => {
              setDownloadStatus(truck.vnumber, {
                status: 'completed',
                progress: 100,
                downloadedImages: truck.images.length + 1,
              })
            })
          } else {
            console.log(
              '[use-truck-processor] Using File System Access API mode'
            )
            // File System Access API mode - directoryHandle이 확실히 존재함
            const dirHandle = directoryHandle!

            // Process each valid truck sequentially
            for (const truck of validTruckData) {
              if (controller.signal.aborted) {
                throw new Error('작업이 취소되었습니다.')
              }

              setDownloadStatus(truck.vnumber, {
                status: 'downloading',
                progress: 0,
              })

              try {
                await downloadTruckData(
                  dirHandle,
                  truck,
                  (progress, downloaded, total) => {
                    setDownloadStatus(truck.vnumber, {
                      status: 'downloading',
                      progress,
                      downloadedImages: downloaded,
                      totalImages: total,
                    })
                  },
                  controller.signal
                )

                setDownloadStatus(truck.vnumber, {
                  status: 'completed',
                  progress: 100,
                })

                addTruckProcessingBreadcrumb('download_complete', {
                  vehicleNumber: truck.vnumber,
                  imageCount: truck.images.length,
                })
              } catch (error) {
                const errorMessage =
                  error instanceof Error ? error.message : '다운로드 실패'

                setDownloadStatus(truck.vnumber, {
                  status: 'failed',
                  error: errorMessage,
                })

                // 개별 차량 다운로드 실패는 로깅만 하고 계속 진행
                addTruckProcessingBreadcrumb('download_error', {
                  vehicleNumber: truck.vnumber,
                  error: errorMessage,
                })
              }
            }
          }
        },
        {
          downloadMode:
            config.selectedDirectory === 'ZIP_DOWNLOAD' ? 'zip' : 'filesystem',
          vehicleCount: validTruckData.length,
        }
      )

      addTruckProcessingBreadcrumb('download_complete', {
        totalVehicles: validTruckData.length,
        invalidVehicles: invalidTruckData.length,
      })

      setCurrentStep('completed')
    } catch (error) {
      // 에러 처리 및 Sentry 리포팅
      const isAbortError = controller.signal.aborted
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      console.log('[use-truck-processor] Error occurred:', {
        isAbortError,
        errorMessage,
        currentStep,
        config,
      })

      if (isAbortError) {
        addTruckProcessingBreadcrumb('processing_cancelled', {
          step: 'user_cancelled',
        })
      } else {
        // 실제 에러인 경우 Sentry에 리포팅
        captureException(error as Error, {
          tags: {
            operation: 'truck_processing',
            step: 'client_processing',
          },
          extra: {
            urlCount: validUrls.length,
            config,
            currentStep,
          },
        })

        addTruckProcessingBreadcrumb('processing_error', {
          error: errorMessage,
          currentStep,
        })

        console.log(
          '[use-truck-processor] Setting currentStep back to input due to error'
        )
        // 에러 상태로 돌아가기
        setCurrentStep('input')
      }
    } finally {
      setIsProcessing(false)
      setAbortController(null)
    }
  }, [
    urlsText,
    setAbortController,
    setIsProcessing,
    setCurrentStep,
    config,
    directoryHandle,
    setParseResult,
    setTruckData,
    resetDownloadStatuses,
    setDownloadStatus,
    currentStep,
  ])

  const cancelProcessing = useCallback(() => {
    if (abortController) {
      abortController.abort()
    }
  }, [abortController])

  const selectAndStoreDirectory = useCallback(async () => {
    try {
      const dirHandle = await selectDirectory()
      if (dirHandle) {
        // 디렉토리 핸들을 별도 상태로 저장
        setDirectoryHandle(dirHandle)
        updateConfig({
          selectedDirectory: dirHandle.name,
        })

        // Persistent Permissions를 위해 IndexedDB에 저장
        await storeDirectoryHandle(dirHandle)
        console.log(
          '[use-truck-processor] Directory handle stored for persistent permissions'
        )

        return true
      }
      return false
    } catch (error) {
      console.error('Directory selection failed:', error)
      return false
    }
  }, [updateConfig, setDirectoryHandle])

  return {
    processUrls,
    cancelProcessing,
    selectAndStoreDirectory,
  }
}
