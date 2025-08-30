'use client'

import React from 'react'

import { AnimatePresence, LayoutGroup, motion } from 'motion/react'

interface UrlListAnimationProps {
  children: React.ReactNode
  className?: string
}

interface UrlItemAnimationProps {
  children: React.ReactNode
  itemKey: string
  index: number
}

export function UrlListAnimation({
  children,
  className,
}: UrlListAnimationProps) {
  return (
    <LayoutGroup id="url-list">
      <div className={className}>
        <AnimatePresence mode="popLayout">{children}</AnimatePresence>
      </div>
    </LayoutGroup>
  )
}

export function UrlItemAnimation({
  children,
  itemKey,
  index,
}: UrlItemAnimationProps) {
  return (
    <motion.div
      key={itemKey}
      initial={{
        opacity: 0,
        y: -20,
        scale: 0.95,
        height: 0,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        height: 'auto',
        transition: {
          type: 'spring',
          stiffness: 300,
          damping: 30,
          delay: index * 0.05,
        },
      }}
      exit={{
        opacity: 0,
        y: -20,
        scale: 0.9,
        height: 0,
        transition: {
          type: 'spring',
          stiffness: 400,
          damping: 40,
          duration: 0.3,
        },
      }}
      layout
      className="overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { delay: 0.1 },
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
