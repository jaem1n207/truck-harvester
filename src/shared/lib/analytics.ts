'use client'

import { track } from '@vercel/analytics'

export interface AnalyticsEvent {
  action: string
  category: string
  label?: string
  value?: number
}

export interface ProcessingMetrics {
  urlCount: number
  processingTime: number
  successCount: number
  failureCount: number
}

export interface ErrorMetrics {
  errorType: string
  errorMessage?: string
  step?: string
}

export const trackEvent = (event: AnalyticsEvent) => {
  try {
    const trackingData: Record<string, string | number> = {
      category: event.category,
    }

    if (event.label) {
      trackingData.label = event.label
    }

    if (event.value !== undefined) {
      trackingData.value = event.value
    }

    track(event.action, trackingData)
  } catch (error) {
    console.warn('Analytics tracking failed:', error)
  }
}

export const trackUrlInput = (urlCount: number) => {
  trackEvent({
    action: 'url_input',
    category: 'user_interaction',
    label: 'url_count',
    value: urlCount,
  })
}

export const trackDirectorySelect = () => {
  trackEvent({
    action: 'directory_select',
    category: 'user_interaction',
    label: 'file_system_api',
  })
}

export const trackProcessingStart = (urlCount: number) => {
  trackEvent({
    action: 'processing_start',
    category: 'processing',
    label: 'url_count',
    value: urlCount,
  })
}

export const trackProcessingComplete = (metrics: ProcessingMetrics) => {
  trackEvent({
    action: 'processing_complete',
    category: 'processing',
    label: 'success',
    value: metrics.successCount,
  })

  trackEvent({
    action: 'processing_time',
    category: 'performance',
    label: 'total_time_seconds',
    value: Math.round(metrics.processingTime / 1000),
  })

  trackEvent({
    action: 'processing_efficiency',
    category: 'performance',
    label: 'success_rate',
    value: Math.round((metrics.successCount / metrics.urlCount) * 100),
  })
}

export const trackProcessingCancel = (step: string) => {
  trackEvent({
    action: 'processing_cancel',
    category: 'user_interaction',
    label: step,
  })
}

export const trackError = (errorMetrics: ErrorMetrics) => {
  trackEvent({
    action: 'error_occurred',
    category: 'error',
    label: errorMetrics.errorType,
  })

  if (errorMetrics.step) {
    trackEvent({
      action: 'error_by_step',
      category: 'error_analysis',
      label: errorMetrics.step,
    })
  }
}

export const trackApiCall = (
  endpoint: string,
  duration: number,
  success: boolean
) => {
  trackEvent({
    action: 'api_call',
    category: 'api',
    label: endpoint,
    value: duration,
  })

  trackEvent({
    action: success ? 'api_success' : 'api_failure',
    category: 'api_performance',
    label: endpoint,
  })
}

export const trackDownloadMethod = (
  method: 'file_system_api' | 'zip_download'
) => {
  trackEvent({
    action: 'download_method',
    category: 'user_behavior',
    label: method,
  })
}

export const trackStepTransition = (fromStep: string, toStep: string) => {
  trackEvent({
    action: 'step_transition',
    category: 'user_flow',
    label: `${fromStep}_to_${toStep}`,
  })
}

export const trackFeatureUsage = (feature: string) => {
  trackEvent({
    action: 'feature_usage',
    category: 'engagement',
    label: feature,
  })
}
