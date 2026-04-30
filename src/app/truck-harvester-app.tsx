'use client'

import { useTruckHarvesterWorkflow } from '@/v2/application'
import { CompletionNotificationToggle } from '@/v2/features/completion-notification'
import {
  HelpMenuButton,
  TourOverlay,
  tourSteps,
} from '@/v2/features/onboarding'
import { DirectorySelector } from '@/v2/widgets/directory-selector'
import { PreparedListingStatusPanel } from '@/v2/widgets/processing-status'
import { ListingChipInput } from '@/v2/widgets/url-input'

export function TruckHarvesterApp() {
  const workflow = useTruckHarvesterWorkflow()

  return (
    <main
      className="bg-background text-foreground min-h-dvh"
      data-tour="v2-page"
    >
      <section
        className="mx-auto grid min-h-dvh w-full max-w-6xl gap-6 px-6 py-8 md:px-10"
        data-tour-background="true"
        inert={workflow.isTourOpen ? true : undefined}
      >
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm font-medium">
              새 작업 화면
            </p>
            <h1 className="text-foreground text-2xl font-semibold tracking-normal">
              트럭 매물 수집기
            </h1>
          </div>
          <HelpMenuButton
            disabled={workflow.isTourOpen}
            onRestartTour={workflow.onboardingState.restartTour}
          />
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="grid content-start gap-5">
            <div data-tour="url-input">
              <ListingChipInput
                canRemoveItem={workflow.canRemovePreparedItem}
                disabled={workflow.isSaving || workflow.isTourOpen}
                duplicateMessage={workflow.duplicateMessage}
                items={workflow.inputListings}
                onPasteText={workflow.handlePasteText}
                onRemove={workflow.removePreparedItem}
                onStart={() => void workflow.startSavingReadyListings()}
              />
            </div>
          </div>

          <div className="grid content-start gap-5">
            <DirectorySelector
              disabled={workflow.isTourOpen}
              isSupported={workflow.fileSystemSupported}
              onSelectDirectory={workflow.selectDirectory}
              permissionState={workflow.directoryPermissionState}
              pickerStartIn={workflow.pickerStartIn}
              selectedDirectoryName={workflow.directory?.name}
            />
            <CompletionNotificationToggle
              disabled={workflow.isTourOpen}
              isAvailable={workflow.notificationAvailable}
              onEnable={workflow.requestNotificationPermission}
              permission={workflow.notificationPermission}
            />
            <div data-tour="processing-status">
              <PreparedListingStatusPanel items={workflow.preparedItems} />
            </div>
          </div>
        </div>
      </section>

      <TourOverlay
        currentStep={workflow.onboardingState.currentStep}
        isOpen={workflow.onboardingState.isTourOpen}
        onClose={workflow.onboardingState.completeTour}
        onNext={() => workflow.onboardingState.goToNextStep(tourSteps.length)}
        onPrevious={workflow.onboardingState.goToPreviousStep}
      />
    </main>
  )
}
