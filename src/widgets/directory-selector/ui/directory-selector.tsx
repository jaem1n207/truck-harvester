import React from 'react'

import { AlertCircle, Download, Folder } from 'lucide-react'
import { motion } from 'motion/react'

import {
  trackDirectorySelect,
  trackDownloadMethod,
  trackFeatureUsage,
} from '@/shared/lib/analytics'
import {
  checkAndRequestPermission,
  isFileSystemAccessSupported,
  requestPersistentPermissionAndStore,
} from '@/shared/lib/file-system'
import { useTruckProcessor } from '@/shared/lib/use-truck-processor'
import { useAppStore } from '@/shared/model/store'
import { ShineBorder } from '@/shared/ui/animated-ui/shine-border'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ClientGate } from '@/shared/ui/client-gate'

export const DirectorySelector = () => {
  const {
    config,
    updateConfig,
    directoryHandle,
    hasTriedRestore,
    isRehydrated,
    restorePersistedDirectoryHandle,
  } = useAppStore()
  const { selectAndStoreDirectory } = useTruckProcessor()
  const [isSelecting, setIsSelecting] = React.useState(false)
  const [hasPermission, setHasPermission] = React.useState<boolean | null>(null)
  const [isCheckingPermission, setIsCheckingPermission] = React.useState(false)

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

  // localStorage 디버깅
  React.useEffect(() => {
    const storedData = localStorage.getItem('truck-harvester-storage')
    console.log(
      '[directory-selector] localStorage data:',
      storedData ? JSON.parse(storedData) : 'none'
    )
  }, [])

  // Zustand rehydration 완료 후 저장된 directoryHandle 복원 시도
  React.useEffect(() => {
    console.log('[directory-selector] useEffect triggered with state:', {
      isRehydrated,
      hasTriedRestore,
      isSupported,
      isZipMode,
      selectedDirectory: config.selectedDirectory,
      hasDirectoryHandle: !!directoryHandle,
      fullConfig: config,
    })

    // 더 스마트한 복원 조건: directoryHandle이 없고 selectedDirectory가 있으면 항상 복원 시도
    const shouldAttemptRestore =
      isRehydrated && // rehydration 완료 대기
      isSupported &&
      !isZipMode &&
      config.selectedDirectory &&
      config.selectedDirectory !== 'ZIP_DOWNLOAD' &&
      !directoryHandle // directoryHandle이 없으면 hasTriedRestore 상관없이 복원 시도

    if (shouldAttemptRestore) {
      console.log(
        '[directory-selector] ✅ All conditions met! Attempting to restore directory handle...',
        {
          selectedDirectory: config.selectedDirectory,
          hasTriedRestore,
          isRehydrated,
          fullConfig: config,
        }
      )
      restorePersistedDirectoryHandle()
    } else {
      console.log('[directory-selector] ❌ Skipping restore attempt', {
        isRehydrated,
        hasTriedRestore,
        isSupported,
        isZipMode,
        selectedDirectory: config.selectedDirectory,
        hasDirectoryHandle: !!directoryHandle,
        reasons: {
          needsRehydration: !isRehydrated,
          notSupported: !isSupported,
          isZipMode: isZipMode,
          noSelectedDirectory: !config.selectedDirectory,
          isZipDirectory: config.selectedDirectory === 'ZIP_DOWNLOAD',
          alreadyHasHandle: !!directoryHandle,
          // hasTriedRestore는 더 이상 차단 조건이 아님
        },
      })
    }
  }, [
    isRehydrated, // rehydration 상태 추가
    hasTriedRestore,
    isSupported,
    isZipMode,
    config, // 전체 config 객체 추가
    directoryHandle,
    restorePersistedDirectoryHandle,
  ])

  // directoryHandle 변경 시 권한 확인
  React.useEffect(() => {
    const checkPermission = async () => {
      if (!directoryHandle || isZipMode) {
        setHasPermission(null)
        return
      }

      setIsCheckingPermission(true)
      try {
        console.log(
          '[directory-selector] Checking permissions for directory handle'
        )
        const permission = await checkAndRequestPermission(directoryHandle)
        setHasPermission(permission)

        // 권한이 확인되면 핸들을 다시 저장하여 영구성 보장
        if (permission) {
          console.log(
            '[directory-selector] Re-storing directory handle to ensure persistence'
          )
          const { storeDirectoryHandle } = await import(
            '@/shared/lib/file-system'
          )
          await storeDirectoryHandle(directoryHandle)
        }
      } catch (error) {
        console.warn('[directory-selector] Permission check failed:', error)
        setHasPermission(false)
      } finally {
        setIsCheckingPermission(false)
      }
    }

    checkPermission()
  }, [directoryHandle, isZipMode])

  // File System Access API 모드에서 directoryHandle이 없거나 권한이 없는 경우 감지
  const needsReselection =
    !isZipMode &&
    config.selectedDirectory &&
    config.selectedDirectory !== 'ZIP_DOWNLOAD' &&
    (!directoryHandle || hasPermission === false)

  const handleSelectDirectory = async () => {
    // 이미 선택 중이면 중복 호출 방지
    if (isSelecting) {
      console.log(
        '[directory-selector] Directory selection already in progress'
      )
      return
    }

    try {
      setIsSelecting(true)
      await selectAndStoreDirectory()

      // Analytics: 디렉토리 선택 추적
      trackDirectorySelect()
      trackDownloadMethod('file_system_api')
    } catch (error) {
      console.error('디렉토리 선택 오류:', error)

      // NotAllowedError (File picker already active) 처리
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        console.warn(
          '[directory-selector] File picker already active or permission denied'
        )
        // 사용자에게 알림 없이 조용히 처리 (이미 다이얼로그가 열려있음을 의미)
      }
    } finally {
      setIsSelecting(false)
    }
  }

  const handleUseZipFallback = () => {
    updateConfig({ selectedDirectory: 'ZIP_DOWNLOAD' })

    // Analytics: ZIP 모드 선택 추적
    trackDownloadMethod('zip_download')
    trackFeatureUsage('zip_mode_selected')
  }

  const handleRequestPermission = async () => {
    if (!directoryHandle) return

    setIsCheckingPermission(true)
    try {
      // 권한 재요청 및 저장
      const permission =
        await requestPersistentPermissionAndStore(directoryHandle)
      setHasPermission(permission)

      // Analytics: 권한 재요청 추적
      trackFeatureUsage('permission_recheck')

      if (permission) {
        console.log(
          '[directory-selector] Persistent permissions granted and stored'
        )
      } else {
        console.log('[directory-selector] Permission denied by user')
      }
    } catch (error) {
      console.error('[directory-selector] Failed to request permission:', error)
      setHasPermission(false)
    } finally {
      setIsCheckingPermission(false)
    }
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
              className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-600" />
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* File System Access API 방식 */}
            <div
              className={`relative space-y-3 rounded-lg p-4 ${
                !isZipMode && config.selectedDirectory
                  ? 'border'
                  : isSupported
                    ? 'border-primary/50 border'
                    : 'border-muted bg-muted/50 border opacity-60'
              }`}
            >
              {!isZipMode && config.selectedDirectory && (
                <ShineBorder
                  className="rounded-lg"
                  borderWidth={2}
                  shineColor={['#3b82f6', '#06b6d4', '#8b5cf6']}
                />
              )}
              <motion.div
                whileHover={isSupported ? { scale: 1.02 } : undefined}
              >
                <div className="flex items-center gap-2">
                  <Folder className="text-primary h-5 w-5" />
                  <span className="font-medium">폴더 직접 저장</span>
                  {isSupported && <Badge variant="default">권장</Badge>}
                  {!isSupported && <Badge variant="secondary">지원 안됨</Badge>}
                </div>

                {displayName && !isZipMode ? (
                  <div className="space-y-2">
                    <div className="text-muted-foreground text-sm">
                      선택된 폴더:
                    </div>
                    <div className="bg-muted rounded p-2 font-mono text-sm">
                      {displayName}
                    </div>
                    {needsReselection && (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-2 dark:border-orange-800 dark:bg-orange-900/20">
                          <AlertCircle className="mt-0.5 h-4 w-4 text-orange-600" />
                          <div className="flex-1">
                            <div className="text-xs text-orange-700 dark:text-orange-300">
                              {!directoryHandle
                                ? '폴더 액세스가 만료되었습니다.'
                                : '폴더 액세스 권한을 확인 중입니다.'}
                            </div>
                          </div>
                        </div>
                        {directoryHandle && hasPermission === false && (
                          <div className="space-y-2">
                            <div className="text-muted-foreground rounded bg-blue-50 p-2 text-xs dark:bg-blue-900/20">
                              💡 <strong>영구 권한 설정 팁:</strong>
                              <br />
                              권한 요청 시 &ldquo;매번 허용&rdquo;을 선택하시면
                              다음에 페이지를 방문할 때도 자동으로 같은 폴더에
                              접근할 수 있습니다.
                            </div>
                            <Button
                              onClick={handleRequestPermission}
                              disabled={isCheckingPermission}
                              variant="outline"
                              size="sm"
                              className="w-full text-xs"
                            >
                              {isCheckingPermission
                                ? '권한 확인 중...'
                                : '폴더 권한 재요청'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-muted-foreground text-sm">
                      각 매물별로 폴더를 생성하고 이미지와 텍스트 파일을 직접
                      저장합니다.
                    </div>
                    {isSupported && (
                      <div className="rounded bg-blue-50 p-2 text-xs text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                        💡 권한 요청 시 <strong>&ldquo;매번 허용&rdquo;</strong>
                        을 선택하면 다음 방문 시에도 동일한 폴더에 자동으로
                        접근할 수 있습니다.
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleSelectDirectory}
                  disabled={!isSupported || isSelecting}
                  className="mt-2 w-full"
                  variant={
                    displayName && !isZipMode && !needsReselection
                      ? 'outline'
                      : 'default'
                  }
                  aria-label={
                    needsReselection
                      ? '폴더 다시 선택 (권한 만료)'
                      : displayName && !isZipMode
                        ? '다른 폴더 선택'
                        : '저장할 폴더 선택'
                  }
                >
                  {isSelecting
                    ? '선택 중...'
                    : needsReselection
                      ? '다시 선택'
                      : displayName && !isZipMode
                        ? '다시 선택'
                        : '폴더 선택'}
                </Button>
              </motion.div>
            </div>

            {/* ZIP 다운로드 방식 */}
            <div className="relative">
              {isZipMode && (
                <ShineBorder
                  className="rounded-lg"
                  borderWidth={2}
                  shineColor={['#f59e0b', '#f97316', '#dc2626']}
                />
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                className={`w-full cursor-pointer space-y-3 rounded-lg p-4 text-left ${
                  isZipMode
                    ? 'bg-primary/5 border'
                    : 'border-muted hover:border-primary/50 border'
                }`}
                onClick={handleUseZipFallback}
                aria-pressed={isZipMode}
                aria-label="ZIP 파일로 다운로드 방식 선택"
              >
                <div className="flex items-center gap-2">
                  <Download className="text-primary h-5 w-5" />
                  <span className="font-medium">ZIP 다운로드</span>
                  <Badge variant="outline">대체 방식</Badge>
                </div>

                <div className="text-muted-foreground text-sm">
                  모든 파일을 ZIP으로 압축하여 다운로드 폴더에 저장합니다.
                </div>

                {isZipMode && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-primary text-sm font-medium"
                  >
                    ✓ ZIP 다운로드 방식 선택됨
                  </motion.div>
                )}
              </motion.button>
            </div>
          </div>

          {config.selectedDirectory &&
            !needsReselection &&
            hasPermission !== false && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20"
                role="status"
                aria-live="polite"
              >
                <div className="text-sm text-green-800 dark:text-green-200">
                  ✓ 저장 방식이 설정되었습니다. 이제 URL을 입력하고 처리를
                  시작할 수 있습니다.
                  {!isZipMode && hasPermission === true && (
                    <span className="mt-1 block text-xs opacity-75">
                      {hasTriedRestore && directoryHandle
                        ? '✨ 영구 권한으로 폴더 권한이 자동으로 복원되었습니다! 다음에도 동일한 폴더에 저장됩니다.'
                        : '폴더 권한이 확인되었습니다. 자동으로 해당 폴더에 저장됩니다.'}
                    </span>
                  )}
                </div>
              </motion.div>
            )}

          {needsReselection && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-900/20"
              role="status"
              aria-live="polite"
            >
              <div className="text-sm text-orange-800 dark:text-orange-200">
                ⚠️ 폴더 권한을 다시 확인해주세요.
                {directoryHandle && hasPermission === false
                  ? ' 위의 "폴더 권한 재요청" 버튼을 클릭하거나'
                  : ''}{' '}
                폴더를 다시 선택하거나 ZIP 다운로드 방식을 사용할 수 있습니다.
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </ClientGate>
  )
}
