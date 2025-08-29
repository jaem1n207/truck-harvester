import { useState, useEffect, useCallback } from 'react'

import { addMilliseconds, format, differenceInMilliseconds } from 'date-fns'
import { ko } from 'date-fns/locale'

import { useAppStore } from '@/shared/model/store'

// 단계별 평균 소요 시간 상수 (밀리초)
const AVERAGE_TIMES = {
  PARSING_PER_URL: 3000, // URL당 3초
  DOWNLOADING_PER_IMAGE: 2000, // 이미지당 2초
  PROCESSING_OVERHEAD: 5000, // 전체 처리 오버헤드 5초
  ESTIMATED_IMAGES_PER_URL: 8, // URL당 평균 이미지 개수 추정
} as const

interface TimeEstimation {
  startTime: Date | null
  estimatedDuration: number // 예상 총 소요 시간 (밀리초)
  estimatedEndTime: Date | null
  remainingTime: number // 남은 시간 (밀리초)
  formattedEndTime: string
  friendlyTimeMessage: string
}

/**
 * 함수형 프로그래밍 스타일의 시간 계산 유틸리티
 */
const timeCalculators = {
  // 초기 예상 시간 계산 (순수 함수)
  calculateInitialEstimation: (urlCount: number): number => {
    const parsingTime = urlCount * AVERAGE_TIMES.PARSING_PER_URL
    const downloadingTime =
      urlCount *
      AVERAGE_TIMES.ESTIMATED_IMAGES_PER_URL *
      AVERAGE_TIMES.DOWNLOADING_PER_IMAGE

    return parsingTime + downloadingTime + AVERAGE_TIMES.PROCESSING_OVERHEAD
  },

  // 진행률 기반 남은 시간 계산 (순수 함수)
  calculateRemainingTime: (
    startTime: Date,
    currentTime: Date,
    progressRatio: number
  ): number => {
    if (progressRatio <= 0) return 0
    if (progressRatio >= 1) return 0

    const elapsedTime = differenceInMilliseconds(currentTime, startTime)
    const totalEstimatedTime = elapsedTime / progressRatio

    return Math.max(0, totalEstimatedTime - elapsedTime)
  },

  // 친근한 시간 메시지 생성 (순수 함수)
  generateFriendlyMessage: (remainingMs: number): string => {
    const minutes = Math.ceil(remainingMs / 60000)

    if (remainingMs < 30000) return '곧 완료됩니다'
    if (minutes === 1) return '약 1분 후 완료 예정'
    if (minutes <= 5) return `약 ${minutes}분 후 완료 예정`
    if (minutes <= 10) return `약 ${Math.ceil(minutes / 5) * 5}분 후 완료 예정`

    return '처리 중입니다'
  },

  // 한국 시간 포맷팅 (순수 함수)
  formatKoreanTime: (date: Date): string => {
    return format(date, 'aa h:mm', { locale: ko })
  },
}

export const useTimeEstimation = (): TimeEstimation => {
  const { currentStep, downloadStatuses, truckData, startTime, setStartTime } =
    useAppStore()

  const [currentTime, setCurrentTime] = useState(new Date())

  // 1초마다 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // 처리 시작 시간 기록
  useEffect(() => {
    if (
      (currentStep === 'parsing' || currentStep === 'downloading') &&
      !startTime
    ) {
      setStartTime(new Date())
    }
  }, [currentStep, startTime, setStartTime])

  // 진행률 계산
  const calculateProgress = useCallback((): number => {
    if (currentStep === 'completed') return 1
    if (currentStep === 'input') return 0

    if (currentStep === 'parsing') {
      // 파싱 단계에서는 truckData 길이 기반으로 진행률 계산
      return Math.min(0.3, (truckData.length / (truckData.length + 1)) * 0.3)
    }

    if (currentStep === 'downloading') {
      const totalItems = downloadStatuses.length
      const completedItems = downloadStatuses.filter(
        (s) => s.status === 'completed' || s.status === 'failed'
      ).length

      // 파싱 30% + 다운로드 70%
      return 0.3 + (completedItems / Math.max(1, totalItems)) * 0.7
    }

    return 0
  }, [currentStep, truckData.length, downloadStatuses])

  // 시간 추정 계산
  const estimation = useCallback((): TimeEstimation => {
    const progress = calculateProgress()
    const urlCount = Math.max(truckData.length, 1)

    // 초기 예상 시간 계산
    const estimatedDuration =
      timeCalculators.calculateInitialEstimation(urlCount)

    // 시작 시간이 없으면 기본값 반환
    if (!startTime) {
      const estimatedEndTime = addMilliseconds(currentTime, estimatedDuration)

      return {
        startTime: null,
        estimatedDuration,
        estimatedEndTime,
        remainingTime: estimatedDuration,
        formattedEndTime: timeCalculators.formatKoreanTime(estimatedEndTime),
        friendlyTimeMessage:
          timeCalculators.generateFriendlyMessage(estimatedDuration),
      }
    }

    // 실제 진행률 기반 남은 시간 계산
    const remainingTime = timeCalculators.calculateRemainingTime(
      startTime,
      currentTime,
      progress
    )

    const estimatedEndTime = addMilliseconds(currentTime, remainingTime)

    return {
      startTime,
      estimatedDuration,
      estimatedEndTime,
      remainingTime,
      formattedEndTime: timeCalculators.formatKoreanTime(estimatedEndTime),
      friendlyTimeMessage:
        timeCalculators.generateFriendlyMessage(remainingTime),
    }
  }, [startTime, currentTime, calculateProgress, truckData.length])

  return estimation()
}
