import { useCallback } from 'react'
import { useAppStore } from '@/shared/model/store'
import { validateUrlsFromText, getValidUrls } from '@/shared/lib/url-validator'
import { downloadTruckData, downloadAsZip, selectDirectory } from '@/shared/lib/file-system'
import { ParseResponse } from '@/shared/model/truck'

export const useTruckProcessor = () => {
  const {
    urlsText,
    config,
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
      return
    }
    
    // Create abort controller
    const controller = new AbortController()
    setAbortController(controller)
    setIsProcessing(true)
    setCurrentStep('parsing')
    
    try {
      // Step 1: Parse URLs
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
      
      const parseResult: ParseResponse = await parseResponse.json()
      setParseResult(parseResult)
      
      if (!parseResult.success || !parseResult.data) {
        throw new Error(parseResult.error || '파싱 실패')
      }
      
      const truckDataList = parseResult.data
      setTruckData(truckDataList)
      
      // Step 2: Download files
      setCurrentStep('downloading')
      resetDownloadStatuses()
      
      // Initialize download statuses
      truckDataList.forEach(truck => {
        setDownloadStatus(truck.vehicleNumber, {
          vehicleNumber: truck.vehicleNumber,
          status: 'pending',
          progress: 0,
          downloadedImages: 0,
          totalImages: truck.images.length,
        })
      })
      
      if (config.selectedDirectory === 'ZIP_DOWNLOAD') {
        // ZIP download mode
        await downloadAsZip(
          truckDataList,
          (progress) => {
            // Update overall progress (simplified)
            console.log(`ZIP 진행률: ${progress}%`)
          },
          controller.signal
        )
        
        // Mark all as completed
        truckDataList.forEach(truck => {
          setDownloadStatus(truck.vehicleNumber, {
            status: 'completed',
            progress: 100,
            downloadedImages: truck.images.length + 1, // +1 for text file
          })
        })
      } else {
        // File System Access API mode
        const dirHandle = await selectDirectory()
        if (!dirHandle) {
          throw new Error('디렉토리가 선택되지 않았습니다.')
        }
        
        // Process each truck sequentially
        for (const truck of truckDataList) {
          if (controller.signal.aborted) {
            throw new Error('작업이 취소되었습니다.')
          }
          
          setDownloadStatus(truck.vehicleNumber, {
            status: 'downloading',
            progress: 0,
          })
          
          try {
            await downloadTruckData(
              dirHandle,
              truck,
              (progress, downloaded, total) => {
                setDownloadStatus(truck.vehicleNumber, {
                  status: 'downloading',
                  progress,
                  downloadedImages: downloaded,
                  totalImages: total,
                })
              },
              controller.signal
            )
            
            setDownloadStatus(truck.vehicleNumber, {
              status: 'completed',
              progress: 100,
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '다운로드 실패'
            setDownloadStatus(truck.vehicleNumber, {
              status: 'failed',
              error: errorMessage,
            })
          }
        }
      }
      
      setCurrentStep('completed')
    } catch (error) {
      console.error('처리 중 오류:', error)
      
      if (controller.signal.aborted) {
        console.log('작업이 사용자에 의해 취소되었습니다.')
      } else {
        // Handle error - you might want to show error state
        setCurrentStep('input')
      }
    } finally {
      setIsProcessing(false)
      setAbortController(null)
    }
  }, [
    urlsText,
    config,
    setTruckData,
    setParseResult,
    setCurrentStep,
    setIsProcessing,
    setDownloadStatus,
    resetDownloadStatuses,
    setAbortController,
  ])
  
  const cancelProcessing = useCallback(() => {
    if (abortController) {
      abortController.abort()
    }
  }, [abortController])
  
  return {
    processUrls,
    cancelProcessing,
  }
}