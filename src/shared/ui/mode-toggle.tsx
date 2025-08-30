'use client'

import { useRef } from 'react'

import { flushSync } from 'react-dom'

import { Moon, SunDim } from 'lucide-react'
import { useTheme } from 'next-themes'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

export function ModeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const isDarkMode = resolvedTheme === 'dark'

  const changeTheme = async () => {
    if (!buttonRef.current) {
      // Fallback for when View Transition API is not supported
      setTheme(theme === 'light' ? 'dark' : 'light')
      return
    }

    // Check if View Transition API is supported
    if (!document.startViewTransition) {
      setTheme(theme === 'light' ? 'dark' : 'light')
      return
    }

    await document.startViewTransition(() => {
      flushSync(() => {
        setTheme(theme === 'light' ? 'dark' : 'light')
      })
    }).ready

    const { top, left, width, height } =
      buttonRef.current.getBoundingClientRect()
    const y = top + height / 2
    const x = left + width / 2

    const right = window.innerWidth - left
    const bottom = window.innerHeight - top
    const maxRad = Math.hypot(Math.max(left, right), Math.max(top, bottom))

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRad}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 700,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      }
    )
  }

  return (
    <Button
      ref={buttonRef}
      variant="outline"
      size="icon"
      onClick={changeTheme}
      className={cn('transition-transform hover:scale-105')}
    >
      {isDarkMode ? (
        <SunDim className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">테마 변경</span>
    </Button>
  )
}
