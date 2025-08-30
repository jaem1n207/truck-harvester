'use client'

import React from 'react'

import { AnimatePresence, motion } from 'motion/react'

import { cn } from '@/shared/lib/utils'

interface UrlListAnimationProps {
  children: React.ReactNode
  className?: string
}

export function UrlListAnimation({
  children,
  className,
}: UrlListAnimationProps) {
  return (
    <div className={className}>
      <AnimatePresence initial={false} mode="popLayout">
        {children}
      </AnimatePresence>
    </div>
  )
}

interface UrlItemAnimationProps {
  children: React.ReactNode
  index: number
  listItemLength: number
}

export function UrlItemAnimation({
  children,
  index,
  listItemLength,
}: UrlItemAnimationProps) {
  return (
    <motion.div
      layout
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div
        className={cn([
          'py-1',
          index === 0 && 'pt-0',
          index === listItemLength - 1 && 'pb-0',
        ])}
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
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </div>
    </motion.div>
  )
}
