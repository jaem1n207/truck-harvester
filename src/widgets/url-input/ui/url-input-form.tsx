import { useState } from 'react'

import { Check, X, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import {
  validateUrlsFromText,
  getValidUrls,
  UrlValidationResult,
} from '@/shared/lib/url-validator'
import { useAppStore } from '@/shared/model/store'
import { Badge } from '@/shared/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card'
import { Textarea } from '@/shared/ui/textarea'

export const UrlInputForm = () => {
  const { urlsText, setUrlsText } = useAppStore()
  const [urlResults, setUrlResults] = useState<UrlValidationResult[]>([])

  const handleUrlsChange = (value: string) => {
    setUrlsText(value)
    const results = validateUrlsFromText(value)
    setUrlResults(results)
  }

  const validUrls = getValidUrls(urlResults)

  const getVariantForResult = (result: UrlValidationResult) => {
    if (result.error) {
      return result.isDuplicate ? 'outline' : 'destructive'
    }
    return 'default'
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          중고트럭 매물 주소 입력
          {validUrls.length > 0 && (
            <Badge variant="default">{validUrls.length}개 유효</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="urls" className="text-sm font-medium">
            중고트럭 매물 주소 (한 줄에 하나씩)
          </label>
          <Textarea
            id="urls"
            placeholder={`예시:\nhttps://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789\nhttps://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=54321&MemberNo=09876&OnCarNo=2024987654321\n\n중고트럭 매물 주소를 한 줄씩 입력하세요.`}
            value={urlsText}
            onChange={(e) => handleUrlsChange(e.target.value)}
            className="min-h-[120px] font-mono text-sm"
            rows={6}
            aria-describedby="url-input-description url-validation-results"
            aria-invalid={urlResults.some(
              (result) => result.error && !result.isDuplicate
            )}
          />
          <div
            id="url-input-description"
            className="text-xs text-muted-foreground"
          >
            지원 사이트: www.truck-no1.co.kr - 한 줄에 하나씩 URL을
            입력해주세요.
          </div>
        </div>

        <AnimatePresence>
          {urlResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
              id="url-validation-results"
              aria-live="polite"
              aria-atomic="false"
            >
              <div className="text-sm font-medium">입력한 주소 확인 결과:</div>
              <div
                className="max-h-40 overflow-y-auto space-y-1"
                role="list"
                aria-label="URL 유효성 검사 결과 목록"
              >
                {urlResults.map((result, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-2 p-2 rounded-md border bg-muted/50"
                    role="listitem"
                    aria-label={`주소 ${index + 1}: ${result.error ? `오류 - ${result.error}` : '유효한 URL'}`}
                  >
                    {result.error ? (
                      result.isDuplicate ? (
                        <AlertTriangle
                          className="h-4 w-4 text-yellow-600"
                          aria-hidden="true"
                        />
                      ) : (
                        <X
                          className="h-4 w-4 text-red-600"
                          aria-hidden="true"
                        />
                      )
                    ) : (
                      <Check
                        className="h-4 w-4 text-green-600"
                        aria-hidden="true"
                      />
                    )}
                    <span className="flex-1 text-sm font-mono truncate">
                      {result.url}
                    </span>
                    <Badge
                      variant={getVariantForResult(result)}
                      className="text-xs"
                    >
                      {result.error ? result.error : '유효'}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {validUrls.length > 0 && (
          <div
            className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg"
            role="status"
            aria-live="polite"
          >
            <div className="text-sm text-green-700 dark:text-green-300 font-medium">
              ✅ {validUrls.length}개의 중고트럭 매물 주소가 준비되었습니다
            </div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-2">
              아래 &apos;처리 시작&apos; 버튼을 눌러 매물 정보를 수집하세요
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1" role="note">
          <div className="flex items-center gap-1">
            <span aria-hidden="true">📋</span>
            <span>지원 사이트: www.truck-no1.co.kr</span>
          </div>
          <div className="flex items-center gap-1">
            <span aria-hidden="true">⚠️</span>
            <span>해당 사이트의 이용 규칙을 준수하여 사용해주세요</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
