'use client'

import { useEffect, useState } from 'react'

import { useStore } from 'zustand'

import { type TruckListing } from '@/v2/entities/truck'
import {
  downloadTruckZip,
  isFileSystemAccessAvailable,
  pickWritableDirectory,
  saveTruckToDirectory,
  type WritableDirectoryHandle,
} from '@/v2/features/file-management'
import {
  HelpMenuButton,
  TourOverlay,
  tourSteps,
} from '@/v2/features/onboarding'
import { processTruckBatch } from '@/v2/features/truck-processing'
import {
  createOnboardingStore,
  createTruckBatchStore,
  selectAttentionNeeded,
} from '@/v2/shared/model'
import { DirectorySelector } from '@/v2/widgets/directory-selector'
import {
  AttentionPanel,
  ProcessingStatus,
} from '@/v2/widgets/processing-status'
import { UrlInputForm, UrlList } from '@/v2/widgets/url-input'

const defaultSkipReason = '직원이 건너뛰었습니다.'

export function TruckHarvesterV2App() {
  const [batchStore] = useState(() => createTruckBatchStore())
  const [onboardingStore] = useState(() =>
    createOnboardingStore({ deferInitialTour: true })
  )
  const [enteredUrls, setEnteredUrls] = useState<string[]>([])
  const [directory, setDirectory] = useState<WritableDirectoryHandle | null>(
    null
  )

  const batchState = useStore(batchStore, (state) => state)
  const onboardingState = useStore(onboardingStore, (state) => state)
  const attentionItems = selectAttentionNeeded(batchState)

  useEffect(() => {
    onboardingStore.getState().initializeTour()
  }, [onboardingStore])

  const saveTruck = async (
    id: string,
    listing: TruckListing,
    signal: AbortSignal,
    targetDirectory: WritableDirectoryHandle | null
  ) => {
    if (!targetDirectory) {
      return
    }

    batchStore.getState().setDownloading(id, {
      downloadedImages: 0,
      totalImages: listing.images.length,
      progress: 0,
    })
    await saveTruckToDirectory(targetDirectory, listing, {
      signal,
      onProgress: (progress, downloadedImages, totalImages) => {
        batchStore.getState().setDownloading(id, {
          progress,
          downloadedImages,
          totalImages,
        })
      },
    })
    batchStore.getState().setDownloaded(id)
  }

  const resolveSaveDirectoryForRun = async () => {
    if (directory) {
      return directory
    }

    if (!isFileSystemAccessAvailable()) {
      return null
    }

    const nextDirectory = await pickWritableDirectory()

    if (!nextDirectory) {
      return undefined
    }

    setDirectory(nextDirectory)
    return nextDirectory
  }

  const startBatch = async (urls: string[]) => {
    const controller = new AbortController()
    const runDirectory = await resolveSaveDirectoryForRun()

    if (runDirectory === undefined) {
      return
    }

    setEnteredUrls(urls)
    batchStore.getState().reset()
    batchStore.getState().addUrls(urls)
    batchStore
      .getState()
      .items.forEach((item) => batchStore.getState().setParsing(item.id))

    const results = await processTruckBatch({
      urls,
      signal: controller.signal,
      onResult: (result) => {
        if (result.status === 'success') {
          batchStore.getState().setParsed(result.id, result.listing)
          return
        }

        if (result.status === 'failed') {
          batchStore.getState().setFailed(result.id, {
            reason: result.reason,
            message: result.message,
          })
        }
      },
    })

    for (const result of results) {
      if (result.status === 'success') {
        await saveTruck(
          result.id,
          result.listing,
          controller.signal,
          runDirectory
        )
      }
    }

    if (!runDirectory) {
      const parsedTrucks = results.flatMap((result) =>
        result.status === 'success' ? [result.listing] : []
      )

      if (parsedTrucks.length > 0) {
        await downloadTruckZip(parsedTrucks, { signal: controller.signal })
      }
    }
  }

  const retryItem = async (id: string) => {
    const item = batchState.items.find((candidate) => candidate.id === id)

    if (!item) {
      return
    }

    const controller = new AbortController()
    const runDirectory = await resolveSaveDirectoryForRun()

    if (runDirectory === undefined) {
      return
    }

    batchStore.getState().retry(id)
    batchStore.getState().setParsing(id)

    const [result] = await processTruckBatch({
      urls: [item.url],
      signal: controller.signal,
    })

    if (result.status === 'success') {
      batchStore.getState().setParsed(id, result.listing)
      await saveTruck(id, result.listing, controller.signal, runDirectory)

      if (!runDirectory) {
        await downloadTruckZip([result.listing], { signal: controller.signal })
      }
      return
    }

    if (result.status === 'failed') {
      batchStore.getState().setFailed(id, {
        reason: result.reason,
        message: result.message,
      })
    }
  }

  const skipItem = (id: string) => {
    batchStore.getState().setSkipped(id, defaultSkipReason)
  }

  return (
    <main
      className="bg-background text-foreground min-h-dvh"
      data-tour="v2-page"
    >
      <section className="mx-auto grid min-h-dvh w-full max-w-6xl gap-6 px-6 py-8 md:px-10">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm font-medium">
              새 작업 화면
            </p>
            <h1 className="text-foreground text-2xl font-semibold tracking-normal">
              트럭 매물 수집기
            </h1>
          </div>
          <HelpMenuButton onRestartTour={onboardingState.restartTour} />
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="grid content-start gap-5">
            <UrlInputForm onSubmit={(urls) => void startBatch(urls)} />
            <DirectorySelector
              isSupported
              onSelectDirectory={(nextDirectory) => setDirectory(nextDirectory)}
              selectedDirectoryName={directory?.name}
            />
            <UrlList
              urls={enteredUrls}
              onRemove={(url) =>
                setEnteredUrls((currentUrls) =>
                  currentUrls.filter((currentUrl) => currentUrl !== url)
                )
              }
            />
          </div>

          <div className="grid content-start gap-5">
            <ProcessingStatus items={batchState.items} />
            <AttentionPanel
              items={attentionItems}
              onRetry={(id) => void retryItem(id)}
              onSkip={skipItem}
            />
          </div>
        </div>
      </section>

      <TourOverlay
        currentStep={onboardingState.currentStep}
        isOpen={onboardingState.isTourOpen}
        onClose={onboardingState.completeTour}
        onNext={() => onboardingState.goToNextStep(tourSteps.length)}
      />
    </main>
  )
}
