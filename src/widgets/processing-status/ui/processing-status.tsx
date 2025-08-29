import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  FileText,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import { useAppStore } from '@/shared/model/store'
import { DownloadStatus } from '@/shared/model/truck'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card'
import { Progress } from '@/shared/ui/progress'

interface ProcessingStatusProps {
  onCancel: () => void
}

const getStatusIcon = (status: DownloadStatus['status']) => {
  switch (status) {
    case 'pending':
      return <div className="w-4 h-4 rounded-full border-2 border-muted" />
    case 'downloading':
      return <Loader2 className="w-4 h-4 animate-spin text-primary" />
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-600" />
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-600" />
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

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {currentStep === 'parsing' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                URL 파싱 중...
              </>
            )}
            {currentStep === 'downloading' && (
              <>
                <Download className="h-5 w-5" />
                파일 다운로드 중...
              </>
            )}
            {currentStep === 'completed' && (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                처리 완료
              </>
            )}
          </CardTitle>

          {canCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              취소
            </Button>
          )}
        </div>

        {totalCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>전체 진행률</span>
              <span>
                {completedCount + failedCount} / {totalCount}
              </span>
            </div>
            <Progress value={overallProgress} className="h-2" />
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span className="text-green-600">완료: {completedCount}</span>
              <span className="text-red-600">실패: {failedCount}</span>
              <span>총 {totalCount}개</span>
            </div>
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
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <div className="text-lg font-medium">웹페이지 분석 중...</div>
              <div className="text-sm text-muted-foreground">
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
              className="space-y-3 max-h-96 overflow-y-auto"
            >
              {downloadStatuses.map((status, index) => (
                <motion.div
                  key={status.vehicleNumber}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 p-4 border rounded-lg"
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
                        <Progress value={status.progress} className="h-1.5" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {status.downloadedImages} / {status.totalImages}{' '}
                            이미지
                          </span>
                          <span>{status.progress}%</span>
                        </div>
                      </div>
                    )}

                    {status.error && (
                      <div className="flex items-start gap-2 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span className="break-all">{status.error}</span>
                      </div>
                    )}
                  </div>

                  {status.status === 'completed' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>{status.downloadedImages}개 파일</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {isCompleted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
          >
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle className="h-5 w-5" />
              <div>
                <div className="font-medium">처리가 완료되었습니다!</div>
                <div className="text-sm">
                  총 {totalCount}개 중 {completedCount}개 성공, {failedCount}개
                  실패
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
