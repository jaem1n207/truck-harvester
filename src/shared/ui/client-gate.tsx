'use client'

import { useSyncExternalStore, type ReactNode } from 'react'

const emptySubscribe = () => () => {}

/**
 * useSyncExternalStore를 사용하여 클라이언트에서만 자식 컴포넌트를 렌더링
 */
export function ClientGate({ children }: { children: ReactNode }) {
  const isServer = useSyncExternalStore(
    emptySubscribe,
    () => false,
    () => true
  )

  return isServer ? null : children
}
