'use client'

import { useEffect } from 'react'

import { Truck, Settings, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import { DirectorySelector } from '@/widgets/directory-selector/ui/directory-selector'
import { ProcessingStatus } from '@/widgets/processing-status/ui/processing-status'
import { UrlInputForm } from '@/widgets/url-input/ui/url-input-form'

import { useTruckProcessor } from '@/shared/lib/use-truck-processor'
import { useAppStore } from '@/shared/model/store'
import { Button } from '@/shared/ui/button'
import { ModeToggle } from '@/shared/ui/mode-toggle'

export const TruckHarvesterApp = () => {
  const { currentStep, setCurrentStep, reset } = useAppStore()
  const { processUrls, cancelProcessing } = useTruckProcessor()

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentStep === 'parsing' || currentStep === 'downloading') {
        e.preventDefault()
        e.returnValue = '작업이 진행 중입니다. 정말로 페이지를 떠나시겠습니까?'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [currentStep])

  const handleStartProcessing = () => {
    processUrls()
  }

  const handleCancel = () => {
    cancelProcessing()
    setCurrentStep('input')
  }

  const handleReset = () => {
    reset()
    setCurrentStep('input')
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'input':
        return (
          <div className="space-y-8">
            <DirectorySelector />
            <UrlInputForm />
            <div className="flex justify-center">
              <Button onClick={handleStartProcessing} size="lg">
                처리 시작
              </Button>
            </div>
          </div>
        )

      case 'parsing':
      case 'downloading':
        return <ProcessingStatus onCancel={handleCancel} />

      case 'completed':
        return (
          <div className="space-y-6">
            <ProcessingStatus onCancel={handleCancel} />
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleReset}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                새로 시작
              </Button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-end mb-4">
          <ModeToggle />
        </div>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-primary rounded-xl">
              <Truck className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold text-foreground">
              트럭 매물 수집기
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            중고 트럭 매물 URL을 입력하면 자동으로 정보를 추출하고 이미지와 함께
            정리된 파일로 저장해드립니다.
          </p>
        </motion.div>

        {/* Step Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center mb-8"
        >
          <div className="flex items-center gap-4">
            {[
              { key: 'input', label: '설정 & 입력', icon: Settings },
              { key: 'parsing', label: '분석', icon: Truck },
              { key: 'downloading', label: '다운로드', icon: Truck },
              { key: 'completed', label: '완료', icon: Truck },
            ].map(({ key, label, icon: Icon }, index) => {
              const isActive = currentStep === key
              const isCompleted =
                ['input', 'parsing', 'downloading'].indexOf(currentStep) > index

              return (
                <div key={key} className="flex items-center">
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : isCompleted
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  {index < 3 && (
                    <div
                      className={`w-8 h-0.5 mx-2 transition-all ${
                        isCompleted ? 'bg-green-300' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex justify-center"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center text-sm text-muted-foreground"
        >
          <div className="space-y-2">
            <p>트럭 매물 수집기 v1.0</p>
            <p className="text-xs">
              웹사이트의 이용약관과 robots.txt를 준수하여 사용해주세요.
            </p>
          </div>
        </motion.footer>
      </div>
    </main>
  )
}
