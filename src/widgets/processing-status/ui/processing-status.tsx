import { useEffect, useRef } from 'react'

import {
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Loader2,
  XCircle,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import {
  trackError,
  trackProcessingComplete,
  ProcessingMetrics,
} from '@/shared/lib/analytics'
import { useTimeEstimation } from '@/shared/lib/use-time-estimation'
import { useAppStore } from '@/shared/model/store'
import { DownloadStatus } from '@/shared/model/truck'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Progress } from '@/shared/ui/progress'

interface ProcessingStatusProps {
  onCancel: () => void
}

const getStatusIcon = (status: DownloadStatus['status']) => {
  switch (status) {
    case 'pending':
      return (
        <div
          className="border-muted h-4 w-4 rounded-full border-2"
          aria-hidden="true"
        />
      )
    case 'downloading':
      return (
        <Loader2
          className="text-primary h-4 w-4 animate-spin"
          aria-hidden="true"
        />
      )
    case 'completed':
      return (
        <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
      )
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
  }
}

const getStatusBadge = (status: DownloadStatus['status']) => {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary">대기중</Badge>
    case 'downloading':
      return <Badge variant="outline">다운로드중</Badge>
    case 'completed':
      return <Badge variant="default">완료</Badge>
    case 'failed':
      return <Badge variant="destructive">실패</Badge>
  }
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  onCancel,
}) => {
  const { downloadStatuses, currentStep, isProcessing } = useAppStore()
  const timeEstimation = useTimeEstimation()
  const hasTrackedCompletion = useRef(false)

  const completedCount = downloadStatuses.filter(
    (s) => s.status === 'completed'
  ).length
  const failedCount = downloadStatuses.filter(
    (s) => s.status === 'failed'
  ).length
  const totalCount = downloadStatuses.length
  const overallProgress =
    totalCount > 0
      ? Math.round(((completedCount + failedCount) / totalCount) * 100)
      : 0

  const isCompleted = currentStep === 'completed'
  const canCancel = isProcessing && !isCompleted

  // Analytics: 처리 완료 및 에러 추적
  useEffect(() => {
    if (isCompleted && !hasTrackedCompletion.current && totalCount > 0) {
      hasTrackedCompletion.current = true

      const processingMetrics: ProcessingMetrics = {
        urlCount: totalCount,
        processingTime: 0, // 실제 처리 시간은 useTruckProcessor에서 계산됨
        successCount: completedCount,
        failureCount: failedCount,
      }

      trackProcessingComplete(processingMetrics)
    }
  }, [isCompleted, totalCount, completedCount, failedCount])

  // Analytics: 에러 추적
  useEffect(() => {
    downloadStatuses.forEach((status) => {
      if (status.status === 'failed' && status.error) {
        trackError({
          errorType: 'download_failure',
          errorMessage: status.error,
          step: 'downloading',
        })
      }
    })
  }, [downloadStatuses])

  return (
    <div className="relative w-full max-w-4xl">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle
              className="flex items-center gap-2"
              role="status"
              aria-live="polite"
            >
              {currentStep === 'parsing' && (
                <>
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                  URL 파싱 중...
                </>
              )}
              {currentStep === 'downloading' && (
                <>
                  <Download className="h-5 w-5" aria-hidden="true" />
                  파일 다운로드 중...
                </>
              )}
              {currentStep === 'completed' && (
                <>
                  {completedCount > 0 ? (
                    <>
                      <CheckCircle
                        className="h-5 w-5 text-green-600"
                        aria-hidden="true"
                      />
                      처리 완료
                    </>
                  ) : (
                    <>
                      <XCircle
                        className="h-5 w-5 text-red-600"
                        aria-hidden="true"
                      />
                      처리 실패
                    </>
                  )}
                </>
              )}
            </CardTitle>

            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                aria-describedby="cancel-description"
                aria-label="현재 진행중인 처리 작업 취소"
              >
                취소
              </Button>
            )}
          </div>

          {totalCount > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>전체 진행률</span>
                <span>
                  {completedCount + failedCount} / {totalCount}
                </span>
              </div>
              <Progress
                value={overallProgress}
                className="h-2"
                aria-label={`전체 진행률 ${overallProgress}%, ${completedCount + failedCount}개 완료, 총 ${totalCount}개`}
              />
              <div className="text-muted-foreground flex gap-4 text-sm">
                <span className="text-green-600">완료: {completedCount}</span>
                <span className="text-red-600">실패: {failedCount}</span>
                <span>총 {totalCount}개</span>
              </div>

              {/* 예상 시간 표시 */}
              {!isCompleted && timeEstimation.friendlyTimeMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-900/20"
                  role="status"
                  aria-live="polite"
                >
                  <Clock
                    className="h-4 w-4 text-blue-600 dark:text-blue-400"
                    aria-hidden="true"
                  />
                  <div className="text-sm">
                    <span className="font-medium text-blue-700 dark:text-blue-300">
                      {timeEstimation.friendlyTimeMessage}
                    </span>
                    {timeEstimation.formattedEndTime && (
                      <span className="ml-2 text-blue-600 dark:text-blue-400">
                        ({timeEstimation.formattedEndTime}경)
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {currentStep === 'parsing' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center py-8"
            >
              <div
                className="space-y-2 text-center"
                role="status"
                aria-live="polite"
              >
                <Loader2
                  className="text-primary mx-auto h-8 w-8 animate-spin"
                  aria-hidden="true"
                />
                <div className="text-lg font-medium">웹페이지 분석 중...</div>
                <div className="text-muted-foreground text-sm">
                  매물 정보와 이미지를 추출하고 있습니다
                </div>
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {downloadStatuses.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-h-96 space-y-3 overflow-y-auto"
                role="list"
                aria-label="매물별 처리 상태 목록"
              >
                {downloadStatuses.map((status, index) => (
                  <motion.div
                    key={status.vehicleNumber}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-4 rounded-lg border p-4"
                    role="listitem"
                    aria-label={`차량번호 ${status.vehicleNumber}, 상태: ${status.status === 'pending' ? '대기중' : status.status === 'downloading' ? '다운로드중' : status.status === 'completed' ? '완료' : '실패'}`}
                  >
                    {getStatusIcon(status.status)}

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {status.vehicleNumber}
                        </span>
                        {getStatusBadge(status.status)}
                      </div>

                      {status.status === 'downloading' && (
                        <div className="space-y-1">
                          <Progress
                            value={status.progress}
                            className="h-1.5"
                            aria-label={`${status.vehicleNumber} 다운로드 진행률 ${status.progress}%, ${status.downloadedImages}/${status.totalImages} 이미지`}
                          />
                          <div className="text-muted-foreground flex justify-between text-xs">
                            <span>
                              {status.downloadedImages} / {status.totalImages}{' '}
                              이미지
                            </span>
                            <span>{status.progress}%</span>
                          </div>
                        </div>
                      )}

                      {status.error && (
                        <div
                          className="flex items-start gap-2 text-sm text-red-600"
                          role="alert"
                        >
                          <AlertCircle
                            className="mt-0.5 h-4 w-4 flex-shrink-0"
                            aria-hidden="true"
                          />
                          <span className="break-all">{status.error}</span>
                        </div>
                      )}
                    </div>

                    {status.status === 'completed' && (
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        <span>{status.downloadedImages}개 파일</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {isCompleted && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`mt-6 rounded-lg border p-4 ${
                  completedCount > 0
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                }`}
                role="status"
                aria-live="polite"
                onAnimationComplete={() => {
                  // 완료 UI 애니메이션이 끝나면 Confetti 트리거를 위한 상태 변경
                }}
              >
                <div
                  className={`flex items-center gap-2 ${
                    completedCount > 0
                      ? 'text-green-800 dark:text-green-200'
                      : 'text-red-800 dark:text-red-200'
                  }`}
                >
                  {completedCount > 0 ? (
                    <CheckCircle className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-5 w-5" aria-hidden="true" />
                  )}
                  <div>
                    <div className="font-medium">
                      {completedCount > 0
                        ? '처리가 완료되었습니다!'
                        : '처리가 실패했습니다!'}
                    </div>
                    <div className="text-sm">
                      총 {totalCount}개 중 {completedCount}개 성공,{' '}
                      {failedCount}개 실패
                    </div>
                    {completedCount === 0 && (
                      <div className="mt-1 text-sm">
                        모든 URL에서 파싱에 실패했습니다. URL을 확인하고 다시
                        시도해주세요.
                      </div>
                    )}
                  </div>
                </div>
                <div id="cancel-description" className="sr-only">
                  처리가 완료되었으므로 취소할 수 없습니다.
                </div>
              </motion.div>

              {/* Confetti 효과 - 성공 완료 UI가 표시된 후 전체 화면에 렌더링 */}
              {/* {completedCount > 0 &&
                typeof window !== 'undefined' &&
                createPortal(
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0 }}
                    className="pointer-events-none fixed inset-0 z-[9999] h-screen w-screen"
                  >
                    <Confetti
                      className="size-full"
                      options={{
                        particleCount: 200,
                        spread: 150,
                        origin: { x: 0.5, y: 0.4 },
                        colors: [
                          '#22c55e',
                          '#16a34a',
                          '#15803d',
                          '#fbbf24',
                          '#f59e0b',
                          '#3b82f6',
                          '#1d4ed8',
                        ],
                        startVelocity: 60,
                        decay: 0.9,
                        gravity: 0.8,
                        ticks: 400,
                        scalar: 0.9,
                        shapes: ['square'],
                      }}
                    />
                    </motion.div>,
                    document.body
                  )} */}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
