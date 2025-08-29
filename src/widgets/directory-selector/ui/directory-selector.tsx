import React from 'react'

import { Folder, Download, AlertCircle } from 'lucide-react'
import { motion } from 'motion/react'

import {
  selectDirectory,
  isFileSystemAccessSupported,
} from '@/shared/lib/file-system'
import { useAppStore } from '@/shared/model/store'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card'
import { ClientGate } from '@/shared/ui/client-gate'

export const DirectorySelector = () => {
  const { config, updateConfig } = useAppStore()
  const [isSelecting, setIsSelecting] = React.useState(false)

  // UI 표시용 디렉토리명 변환
  const getDisplayName = (selectedDirectory: string | undefined) => {
    if (!selectedDirectory) return null
    return selectedDirectory === 'ZIP_DOWNLOAD'
      ? 'ZIP 다운로드'
      : selectedDirectory
  }

  const displayName = getDisplayName(config.selectedDirectory)
  const isZipMode = config.selectedDirectory === 'ZIP_DOWNLOAD'

  const isSupported = isFileSystemAccessSupported()

  const handleSelectDirectory = async () => {
    try {
      setIsSelecting(true)
      const dirHandle = await selectDirectory()

      if (dirHandle) {
        updateConfig({ selectedDirectory: dirHandle.name })
      }
    } catch (error) {
      console.error('디렉토리 선택 오류:', error)
    } finally {
      setIsSelecting(false)
    }
  }

  const handleUseZipFallback = () => {
    updateConfig({ selectedDirectory: 'ZIP_DOWNLOAD' })
  }

  return (
    <ClientGate>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            저장 위치 선택
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupported && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-4 border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 rounded-lg"
            >
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  브라우저 호환성 안내
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  현재 브라우저에서는 File System Access API가 지원되지
                  않습니다. ZIP 파일로 다운로드하는 방식을 사용합니다.
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File System Access API 방식 */}
            <div
              className={`p-4 border rounded-lg space-y-3 ${
                isSupported
                  ? 'border-primary/50'
                  : 'border-muted bg-muted/50 opacity-60'
              }`}
            >
              <motion.div
                whileHover={isSupported ? { scale: 1.02 } : undefined}
              >
                <div className="flex items-center gap-2">
                  <Folder className="h-5 w-5 text-primary" />
                  <span className="font-medium">폴더 직접 저장</span>
                  {isSupported && <Badge variant="default">권장</Badge>}
                  {!isSupported && <Badge variant="secondary">지원 안됨</Badge>}
                </div>

                {displayName && !isZipMode ? (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      선택된 폴더:
                    </div>
                    <div className="p-2 bg-muted rounded text-sm font-mono">
                      {displayName}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    각 매물별로 폴더를 생성하고 이미지와 텍스트 파일을 직접
                    저장합니다.
                  </div>
                )}

                <Button
                  onClick={handleSelectDirectory}
                  disabled={!isSupported || isSelecting}
                  className="w-full mt-2"
                  variant={displayName && !isZipMode ? 'outline' : 'default'}
                  aria-label={
                    displayName && !isZipMode
                      ? '다른 폴더 선택'
                      : '저장할 폴더 선택'
                  }
                >
                  {isSelecting
                    ? '선택 중...'
                    : displayName && !isZipMode
                      ? '다시 선택'
                      : '폴더 선택'}
                </Button>
              </motion.div>
            </div>

            {/* ZIP 다운로드 방식 */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              className={`w-full p-4 border rounded-lg space-y-3 text-left cursor-pointer ${
                isZipMode
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary/50'
              }`}
              onClick={handleUseZipFallback}
              aria-pressed={isZipMode}
              aria-label="ZIP 파일로 다운로드 방식 선택"
            >
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                <span className="font-medium">ZIP 다운로드</span>
                <Badge variant="outline">대체 방식</Badge>
              </div>

              <div className="text-sm text-muted-foreground">
                모든 파일을 ZIP으로 압축하여 다운로드 폴더에 저장합니다.
              </div>

              {isZipMode && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-primary font-medium"
                >
                  ✓ ZIP 다운로드 방식 선택됨
                </motion.div>
              )}
            </motion.button>
          </div>

          {config.selectedDirectory && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
              role="status"
              aria-live="polite"
            >
              <div className="text-sm text-green-800 dark:text-green-200">
                ✓ 저장 방식이 설정되었습니다. 이제 URL을 입력하고 처리를 시작할
                수 있습니다.
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </ClientGate>
  )
}
