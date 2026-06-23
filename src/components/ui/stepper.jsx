import React, { useState, Children } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function Stepper({
  children,
  initialStep = 1, // 💡 Default kembali ke 1
  activeStep, // 💡 TAMBAHKAN PROPERTI INI
  onStepChange = () => { },
  onFinalStepCompleted = () => { },
  stepCircleContainerClassName = '',
  stepContainerClassName = '',
  contentClassName = '',
  footerClassName = '',
  backButtonProps = {},
  nextButtonProps = {},
  backButtonText = 'Back',
  nextButtonText = 'Continue',
  disableStepIndicators = true, // 💡 Otomatis kunci klik lingkaran agar user wajib pakai tombol
  errorSteps = [], // 💡 Array baru untuk menampung step mana saja yang error, misal: [2]
  renderStepIndicator,
  ...rest
}) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(0);
  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const isCompleted = currentStep > totalSteps;
  const isLastStep = currentStep === totalSteps;

  React.useEffect(() => {
    if (activeStep !== undefined && activeStep !== currentStep && activeStep >= 1 && activeStep <= totalSteps + 1) {
      // Jika ada instruksi lompat halaman dari tombol edit eksternal, set halaman internalnya
      setDirection(activeStep > currentStep ? 1 : -1);
      setCurrentStep(activeStep);
    }
  }, [activeStep]);

  const updateStep = newStep => {
    setCurrentStep(newStep);
    if (newStep > totalSteps) onFinalStepCompleted();
    else onStepChange(newStep);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      updateStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (!isLastStep) {
      setDirection(1);
      updateStep(currentStep + 1);
    }
  };

  const handleComplete = () => {
    setDirection(1);
    updateStep(totalSteps + 1);
  };

  return (
    <div className="flex h-auto w-full flex-col items-center justify-center p-2" {...rest}>
      <div
        className={`mx-auto w-full rounded-4xl shadow-xl bg-transparent ${stepCircleContainerClassName}`}
        style={{ border: '1px solid rgba(255, 255, 255, 0.05)' }}
      >
        {/* Step Indicators */}
        <div className={`${stepContainerClassName} flex w-full items-center p-6`}>
          {stepsArray.map((_, index) => {
            const stepNumber = index + 1;
            const isNotLastStep = index < totalSteps - 1;
            const hasError = errorSteps.includes(stepNumber); // 💡 Cek apakah step ini ada error

            return (
              <React.Fragment key={stepNumber}>
                {renderStepIndicator ? (
                  renderStepIndicator({
                    step: stepNumber,
                    currentStep,
                    onStepClick: clicked => {
                      if (!disableStepIndicators) {
                        setDirection(clicked > currentStep ? 1 : -1);
                        updateStep(clicked);
                      }
                    }
                  })
                ) : (
                  <StepIndicator
                    step={stepNumber}
                    disableStepIndicators={disableStepIndicators}
                    currentStep={currentStep}
                    hasError={hasError} // 💡 Kirim status error ke komponen indikator lingkaran
                    onClickStep={clicked => {
                      setDirection(clicked > currentStep ? 1 : -1);
                      updateStep(clicked);
                    }}
                  />
                )}
                {isNotLastStep && <StepConnector isComplete={currentStep > stepNumber} />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Wrapper Konten */}
        <StepContentWrapper
          isCompleted={isCompleted}
          currentStep={currentStep}
          direction={direction}
          className={`w-full px-6 overflow-visible ${contentClassName}`}
        >
          {stepsArray[currentStep - 1]}
        </StepContentWrapper>

        {/* Navigasi Tombol Footer */}
        {!isCompleted && (
          <div className={`px-6 pb-6 ${footerClassName}`}>
            <div className={`mt-6 flex ${currentStep !== 1 ? 'justify-between' : 'justify-end'}`}>
              {currentStep !== 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="duration-350 rounded px-3 py-1.5 transition text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-white"
                  {...backButtonProps}
                >
                  {backButtonText}
                </button>
              )}
              <button
                type="button"
                onClick={isLastStep ? handleComplete : handleNext}
                className="duration-350 flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 py-2.5 px-5 text-xs font-black tracking-widest uppercase text-white transition hover:opacity-90 active:scale-95"
                {...nextButtonProps}
              >
                {isLastStep ? 'Selesai & Kirim OTP' : nextButtonText}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepContentWrapper({ isCompleted, currentStep, direction, children, className }) {
  return (
    <motion.div style={{ position: 'relative', overflow: 'visible' }} className={className}>
      <AnimatePresence initial={false} mode="wait" custom={direction}>
        {!isCompleted && (
          <SlideTransition key={currentStep} direction={direction}>
            {children}
          </SlideTransition>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SlideTransition({ children, direction }) {
  return (
    <motion.div
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      style={{ position: 'relative', width: '100%', height: 'auto' }}
    >
      {children}
    </motion.div>
  );
}

const stepVariants = {
  enter: dir => ({ x: dir >= 0 ? '20px' : '-20px', opacity: 0 }),
  center: { x: '0px', opacity: 1 },
  exit: dir => ({ x: dir >= 0 ? '-20px' : '20px', opacity: 0 })
};

export function Step({ children }) {
  return <div className="w-full">{children}</div>;
}

function StepIndicator({ step, currentStep, onClickStep, disableStepIndicators, hasError }) {
  // 💡 Atur status 'error' jika properti hasError bernilai true
  const status = hasError ? 'error' : currentStep === step ? 'active' : currentStep < step ? 'inactive' : 'complete';

  const handleClick = () => {
    if (step !== currentStep && !disableStepIndicators) onClickStep(step);
  };

  return (
    <motion.div
      onClick={handleClick}
      className={`relative outline-none focus:outline-none ${disableStepIndicators ? 'pointer-events-none' : 'cursor-pointer'}`}
      animate={status}
      initial={false}
    >
      <motion.div
        variants={{
          inactive: { scale: 1, backgroundColor: '#1e293b', color: '#64748b' },
          active: { scale: 1, backgroundColor: '#06b6d4', color: '#ffffff' },
          complete: { scale: 1, backgroundColor: '#10b981', color: '#ffffff' },
          error: { scale: 1, backgroundColor: '#ef4444', color: '#ffffff' } // 💡 Warna merah menyala untuk step bermasalah
        }}
        transition={{ duration: 0.3 }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black"
      >
        {status === 'error' ? (
          <span className="text-xs font-black">!</span> // 💡 Tanda seru untuk error
        ) : status === 'complete' ? (
          <CheckIcon className="h-4 w-4 text-white" />
        ) : (
          <span className="text-xs">{step}</span>
        )}
      </motion.div>
    </motion.div>
  );
}

function StepConnector({ isComplete }) {
  return (
    <div className="relative mx-1 h-0.5 flex-1 overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
      <motion.div
        className="absolute left-0 top-0 h-full"
        variants={{
          incomplete: { width: 0, backgroundColor: 'rgba(6, 182, 212, 0)' },
          complete: { width: '100%', backgroundColor: '#06b6d4' }
        }}
        initial={false}
        animate={isComplete ? 'complete' : 'incomplete'}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
}

function CheckIcon(props) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.05, type: 'tween', ease: 'easeOut', duration: 0.2 }}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}