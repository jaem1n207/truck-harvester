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
import { Button } from '@/shared/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card'
import { Textarea } from '@/shared/ui/textarea'

export const UrlInputForm = () => {
  const { urlsText, setUrlsText, setCurrentStep, config } = useAppStore()
  const [urlResults, setUrlResults] = useState<UrlValidationResult[]>([])

  const handleUrlsChange = (value: string) => {
    setUrlsText(value)
    const results = validateUrlsFromText(value)
    setUrlResults(results)
  }

  const validUrls = getValidUrls(urlResults)
  const hasErrors = urlResults.some((result) => result.error)
  const canProceed = validUrls.length > 0 && !hasErrors

  const getVariantForResult = (result: UrlValidationResult) => {
    if (result.error) {
      return result.isDuplicate ? 'outline' : 'destructive'
    }
    return 'default'
  }

  const handleProceed = () => {
    if (canProceed) {
      setCurrentStep('parsing')
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          트럭 매물 URL 입력
          {validUrls.length > 0 && (
            <Badge variant="default">{validUrls.length}개 유효</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="urls" className="text-sm font-medium">
            URL 목록 (한 줄에 하나씩)
          </label>
          <Textarea
            id="urls"
            placeholder={`예시:\nhttps://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=12345&MemberNo=67890&OnCarNo=2025123456789\nhttps://www.truck-no1.co.kr/model/DetailView.asp?ShopNo=54321&MemberNo=09876&OnCarNo=2024987654321\n\n트럭매매NO1 매물 URL을 한 줄씩 입력하세요.`}
            value={urlsText}
            onChange={(e) => handleUrlsChange(e.target.value)}
            className="min-h-[120px] font-mono text-sm"
            rows={6}
          />
        </div>

        <AnimatePresence>
          {urlResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="text-sm font-medium">URL 유효성 검사 결과:</div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {urlResults.map((result, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-2 p-2 rounded-md border bg-muted/50"
                  >
                    {result.error ? (
                      result.isDuplicate ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      ) : (
                        <X className="h-4 w-4 text-red-600" />
                      )
                    ) : (
                      <Check className="h-4 w-4 text-green-600" />
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

        <div className="flex justify-between items-start">
          <div className="text-sm text-muted-foreground">
            <div>
              처리 설정: 지연 {config.rateLimitMs}ms, 타임아웃{' '}
              {config.timeoutMs}ms
            </div>
            <div className="text-xs text-blue-600 mt-1">
              📋 허용된 도메인: www.truck-no1.co.kr
            </div>
            <div className="text-xs text-orange-600 mt-1">
              ⚠️ 웹사이트의 robots.txt와 이용약관을 확인하고 준수해주세요
            </div>
          </div>
          <Button
            onClick={handleProceed}
            disabled={!canProceed}
            className="min-w-[120px]"
          >
            {validUrls.length > 0
              ? `${validUrls.length}개 처리하기`
              : '처리하기'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
