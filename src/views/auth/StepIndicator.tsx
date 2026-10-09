interface StepIndicatorProps {
  currentStep: number
  totalSteps?: number
  stepTitles?: string[]
}

export default function StepIndicator({
  currentStep,
  totalSteps = 2,
  stepTitles = ['Thông tin tài khoản', 'Thông tin bổ sung']
}: StepIndicatorProps) {
  return (
    <div className="mb-5" aria-label={`Bước ${currentStep} trên ${totalSteps}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-[#F59E0B]">
          Bước {currentStep}/{totalSteps}
        </span>
        <span className="text-xs font-medium text-stone-500">
          {stepTitles[currentStep - 1] || ''}
        </span>
      </div>

      {/* Progress track */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNum = index + 1
          const isActive = stepNum <= currentStep
          return (
            <div
              key={stepNum}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                isActive ? 'bg-[#F59E0B]' : 'bg-stone-200'
              }`}
            />
          )
        })}
      </div>
    </div>
  )
}
