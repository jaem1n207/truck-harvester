'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

import { AlertTriangle, RefreshCw } from 'lucide-react'

import { captureException } from '@/shared/lib/sentry-utils'

import { Button } from './button'
import { Card } from './card'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    // 다음 렌더링에서 폴백 UI를 표시하도록 상태 업데이트
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Sentry에 에러 보고
    captureException(error, {
      tags: {
        boundary: 'react-error-boundary',
        component: this.constructor.name,
      },
      extra: {
        errorInfo: {
          componentStack: errorInfo.componentStack,
        },
        errorBoundary: true,
      },
    })

    // 사용자 정의 에러 핸들러 호출
    this.props.onError?.(error, errorInfo)

    // 개발 환경에서 콘솔에 로그
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error')
      console.error('Error:', error)
      console.error('Component Stack:', errorInfo.componentStack)
      console.groupEnd()
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      // 커스텀 폴백 UI가 있다면 사용
      if (this.props.fallback) {
        return this.props.fallback
      }

      // 기본 에러 UI
      return (
        <Card className="mx-auto mt-8 max-w-md p-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="bg-destructive/10 text-destructive rounded-full p-3">
              <AlertTriangle className="h-8 w-8" />
            </div>
          </div>

          <h2 className="mb-2 text-xl font-semibold">문제가 발생했습니다</h2>

          <p className="text-muted-foreground mb-4 text-sm">
            예상치 못한 오류가 발생했습니다. 문제가 지속되면 새로고침을
            시도해주세요.
          </p>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="text-destructive mb-4 rounded bg-gray-50 p-2 text-left text-xs dark:bg-gray-900">
              <summary className="cursor-pointer font-mono">개발 정보</summary>
              <pre className="mt-2 overflow-auto">
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}

          <Button onClick={this.handleReset} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            다시 시도
          </Button>
        </Card>
      )
    }

    return this.props.children
  }
}

// 함수형 래퍼 컴포넌트 (optional)
interface ErrorBoundaryWrapperProps extends Props {
  identifier?: string
}

export function ErrorBoundaryWrapper({
  children,
  identifier,
  ...props
}: ErrorBoundaryWrapperProps) {
  return (
    <ErrorBoundary
      {...props}
      onError={(error, errorInfo) => {
        // identifier와 함께 에러 추가 컨텍스트 제공
        if (identifier) {
          captureException(error, {
            tags: {
              boundary: 'react-error-boundary',
              identifier,
            },
            extra: {
              errorInfo,
              identifier,
            },
          })
        }
        props.onError?.(error, errorInfo)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
