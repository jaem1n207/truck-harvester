import { useCallback, useEffect, useRef, useState } from 'react'

import { AlertTriangle, Check, Plus, Trash2, X } from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'

import { trackFeatureUsage, trackUrlInput } from '@/shared/lib/analytics'
import {
  getValidUrls,
  UrlValidationResult,
  validateUrlsFromText,
} from '@/shared/lib/url-validator'
import { useAppStore } from '@/shared/model/store'
import {
  UrlItemAnimation,
  UrlListAnimation,
} from '@/shared/ui/animated-ui/url-list-animation'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'

// Natural animation configurations inspired by chat apps
const smoothSpring = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 25,
  mass: 0.8,
}

const quickSpring = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  mass: 1,
}

const smoothTransition = {
  duration: 0.2,
  ease: 'easeOut' as const,
}

export const UrlInputForm = () => {
  const { urlsText, setUrlsText } = useAppStore()
  const [urls, setUrls] = useState<string[]>([])
  const [currentInput, setCurrentInput] = useState('')
  const [urlResults, setUrlResults] = useState<UrlValidationResult[]>([])
  const [inputError, setInputError] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Callback ref로 더 확실한 포커스 제어
  const inputCallbackRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      inputRef.current = node
      // DOM에 요소가 추가되자마자 포커스 (지연 없이)
      requestAnimationFrame(() => {
        node.focus()
      })
    }
  }, [])

  // 초기화 시 urlsText에서 urls 배열 생성
  useEffect(() => {
    if (urlsText && urls.length === 0) {
      const initialUrls = urlsText
        .split('\n')
        .map((url) => url.trim())
        .filter((url) => url.length > 0)
      setUrls(initialUrls)
    }
  }, [urlsText, urls.length])

  // urls 배열이 변경될 때마다 urlsText 업데이트
  useEffect(() => {
    const newUrlsText = urls.join('\n')
    if (newUrlsText !== urlsText) {
      setUrlsText(newUrlsText)
    }
    const results = validateUrlsFromText(newUrlsText)
    setUrlResults(results)
  }, [urls, setUrlsText, urlsText])

  // 페이지 로드 시 자동 포커스 (애니메이션 종료 후 확실히 실행)
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 250)

    return () => clearTimeout(timer)
  }, [])

  // 탭 전환 및 윈도우 포커스 시 자동 포커스
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && inputRef.current) {
        setTimeout(() => {
          inputRef.current?.focus()
        }, 150)
      }
    }

    const handleWindowFocus = () => {
      if (inputRef.current && !document.hidden) {
        setTimeout(() => {
          inputRef.current?.focus()
        }, 150)
      }
    }

    const handlePageShow = () => {
      if (inputRef.current) {
        setTimeout(() => {
          inputRef.current?.focus()
        }, 150)
      }
    }

    // 여러 이벤트로 포커스 보장
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [])

  const handleAddUrl = () => {
    const trimmedInput = currentInput.trim()
    setInputError('') // 기존 오류 메시지 클리어

    if (!trimmedInput) {
      setInputError('URL을 입력해주세요.')
      return
    }

    // 중복 체크
    if (urls.includes(trimmedInput)) {
      setInputError('이미 추가된 URL입니다.')
      return
    }

    // URL 유효성 검증 (간단한 체크)
    const urlValidation = validateUrlsFromText(trimmedInput)
    if (urlValidation.length > 0 && urlValidation[0].error) {
      setInputError(urlValidation[0].error)
      return
    }

    // 성공적으로 추가
    const newUrls = [...urls, trimmedInput]
    setUrls(newUrls)
    setCurrentInput('')

    // Analytics: URL 추가 추적
    trackFeatureUsage('url_added')
    trackUrlInput(newUrls.length)
  }

  const handleRemoveUrl = (index: number) => {
    const newUrls = urls.filter((_, i) => i !== index)
    setUrls(newUrls)
    // 즉시 urlsText도 업데이트하여 상태 동기화
    const newUrlsText = newUrls.join('\n')
    setUrlsText(newUrlsText)

    // Analytics: URL 제거 추적
    trackFeatureUsage('url_removed')
    trackUrlInput(newUrls.length)

    // URL 제거 후 인풋으로 자동 포커스
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  const handleInputChange = (value: string) => {
    setCurrentInput(value)
    if (inputError) {
      setInputError('') // 입력값이 변경되면 오류 메시지 클리어
    }
  }

  const validUrls = getValidUrls(urlResults)

  return (
    <LayoutGroup>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={smoothSpring}
        layout
      >
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              중고트럭 매물 주소 입력
              <AnimatePresence>
                {validUrls.length > 0 && (
                  <motion.div
                    layoutId="url-count-badge"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={quickSpring}
                  >
                    <Badge variant="default">{validUrls.length}개 유효</Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <motion.div layout transition={smoothSpring}>
              <label
                htmlFor="url-input"
                className="mb-2 block text-sm font-medium"
              >
                중고트럭 매물 주소 추가
              </label>
              <motion.div
                layout
                transition={smoothSpring}
                className="mb-1 flex gap-2"
              >
                <Input
                  ref={inputCallbackRef}
                  id="url-input"
                  placeholder="예시: https://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789"
                  value={currentInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddUrl()
                    }
                  }}
                  className={`font-mono text-sm ${inputError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  aria-describedby="url-input-description"
                  aria-invalid={!!inputError}
                />
                <Button
                  onClick={handleAddUrl}
                  disabled={
                    !currentInput.trim() || urls.includes(currentInput.trim())
                  }
                  size="icon"
                  aria-label="URL 추가"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </motion.div>

              <AnimatePresence>
                {inputError && (
                  <motion.div
                    layoutId="input-error-message"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={smoothTransition}
                    style={{ overflow: 'hidden' }}
                    className=""
                  >
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: -8,
                        scale: 0.98,
                        filter: 'blur(4px)',
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        filter: 'blur(0px)',
                      }}
                      exit={{
                        opacity: 0,
                        y: 8,
                        scale: 0.98,
                        filter: 'blur(4px)',
                      }}
                      transition={smoothTransition}
                      className="flex items-center gap-2 text-xs text-red-600"
                      role="alert"
                    >
                      <X className="h-3 w-3 flex-shrink-0" />
                      <span>{inputError}</span>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                layout
                transition={smoothSpring}
                id="url-input-description"
                className="text-muted-foreground text-xs"
              >
                지원 사이트: www.truck-no1.co.kr - <strong>Enter</strong> 키
                또는 <strong>+</strong> 버튼을 눌러 URL을 추가하세요.
              </motion.div>

              {/* URL 목록 */}
              <AnimatePresence>
                {urls.length > 0 && (
                  <motion.div
                    layoutId="url-list-section"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={smoothTransition}
                    style={{ overflow: 'hidden' }}
                  >
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: -8,
                        scale: 0.98,
                        filter: 'blur(4px)',
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        filter: 'blur(0px)',
                      }}
                      exit={{
                        opacity: 0,
                        y: 8,
                        scale: 0.98,
                        filter: 'blur(4px)',
                      }}
                      transition={smoothTransition}
                    >
                      <motion.div
                        layout
                        transition={smoothSpring}
                        className="my-2 text-sm font-medium"
                      >
                        추가된 URL 목록 ({urls.length}개)
                      </motion.div>
                      <UrlListAnimation>
                        {urls.map((url, index) => {
                          const result = urlResults[index]

                          return (
                            <UrlItemAnimation
                              key={url}
                              index={index}
                              listItemLength={urls.length}
                            >
                              <div className="bg-muted/50 flex items-center gap-4 rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shadow-sm">
                                    {index + 1}
                                  </div>
                                  <div className="text-muted-foreground text-xs font-medium">
                                    순서
                                  </div>
                                </div>

                                <div className="flex-1">
                                  <div className="font-mono text-sm break-all">
                                    {url}
                                  </div>
                                  {result && (
                                    <div className="flex items-center gap-2">
                                      {result.error ? (
                                        result.isDuplicate ? (
                                          <>
                                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              {result.error}
                                            </Badge>
                                          </>
                                        ) : (
                                          <>
                                            <X className="h-4 w-4 text-red-600" />
                                            <Badge
                                              variant="destructive"
                                              className="text-xs"
                                            >
                                              {result.error}
                                            </Badge>
                                          </>
                                        )
                                      ) : (
                                        <>
                                          <Check className="h-4 w-4 text-green-600" />
                                          <Badge
                                            variant="default"
                                            className="text-xs"
                                          >
                                            유효
                                          </Badge>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <Button
                                  onClick={() => handleRemoveUrl(index)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground h-9 w-9 p-0 hover:bg-red-50 hover:text-red-600"
                                  aria-label={`${index + 1}번째 URL 제거`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </UrlItemAnimation>
                          )
                        })}
                      </UrlListAnimation>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <AnimatePresence mode="popLayout">
              {validUrls.length > 0 && (
                <motion.div
                  layoutId="success-message-section"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: -16, opacity: 0 }}
                  transition={{
                    ...smoothTransition,
                    delay: 0.05,
                  }}
                  style={{ overflow: 'hidden' }}
                  role="status"
                  aria-live="polite"
                  className="mt-4 rounded-lg bg-green-50 p-4 dark:bg-green-900/20"
                >
                  <motion.div
                    layout
                    transition={smoothSpring}
                    className="text-sm font-medium text-green-700 dark:text-green-300"
                  >
                    ✅ {validUrls.length}개의 매물 주소가 준비되었습니다
                  </motion.div>
                  <motion.div
                    layout
                    transition={smoothSpring}
                    className="mt-2 text-xs text-green-600 dark:text-green-400"
                  >
                    아래 &apos;{validUrls.length}개 매물 정보 수집하기&apos;
                    버튼을 눌러 매물 정보를 수집하세요
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </LayoutGroup>
  )
}
