import { useEffect, useState } from 'react';

type BreathPhase = {
  label: 'Inspire' | 'Segure' | 'Expire';
  instruction: string;
  durationSeconds: number;
  scaleClass: string;
};

const PHASES: BreathPhase[] = [
  {
    label: 'Inspire',
    instruction: 'Puxe o ar devagar pelo nariz',
    durationSeconds: 4,
    scaleClass: 'scale-110 bg-calm-400/40',
  },
  {
    label: 'Segure',
    instruction: 'Mantenha o ar com suavidade',
    durationSeconds: 4,
    scaleClass: 'scale-110 bg-teal-300/45',
  },
  {
    label: 'Expire',
    instruction: 'Solte o ar lentamente pela boca',
    durationSeconds: 4,
    scaleClass: 'scale-75 bg-calm-600/30',
  },
];

export function BreathingGuide() {
  const [cycle, setCycle] = useState({
    phaseIndex: 0,
    secondsLeft: PHASES[0].durationSeconds,
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCycle((prev) => {
        if (prev.secondsLeft > 1) {
          return { ...prev, secondsLeft: prev.secondsLeft - 1 };
        }
        const nextIndex = (prev.phaseIndex + 1) % PHASES.length;
        return {
          phaseIndex: nextIndex,
          secondsLeft: PHASES[nextIndex].durationSeconds,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const phase = PHASES[cycle.phaseIndex];
  const secondsLeft = cycle.secondsLeft;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative flex h-52 w-52 items-center justify-center">
        <div
          className={`absolute inset-0 rounded-full transition-transform duration-[4000ms] ease-in-out ${phase.scaleClass}`}
        />
        <div className="relative z-10 flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white/15 backdrop-blur-md border border-white/25">
          <span className="text-2xl font-bold tracking-wide text-white">
            {phase.label}
          </span>
          <span className="mt-1 text-3xl font-light text-calm-100 tabular-nums">
            {secondsLeft}s
          </span>
        </div>
      </div>

      <p className="mt-5 text-base font-medium text-calm-100">
        {phase.instruction}
      </p>
    </div>
  );
}
