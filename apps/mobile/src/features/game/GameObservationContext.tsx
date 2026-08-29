import { createContext, type ReactNode, useContext } from "react";

export type GameObservation =
  | { type: "attempt"; stepId: string; correct: boolean }
  | { type: "completed"; stepId: string }
  | { type: "retry"; stepId: string }
  | { type: "help"; stepId: string }
  | { type: "wait"; stepId: string; waitMs: number };

type Reporter = (observation: GameObservation) => void;

const GameObservationContext = createContext<Reporter>(() => undefined);

export function GameObservationProvider({
  children,
  report,
}: {
  children: ReactNode;
  report: Reporter;
}) {
  return (
    <GameObservationContext.Provider value={report}>{children}</GameObservationContext.Provider>
  );
}

export function useGameObservation(): Reporter {
  return useContext(GameObservationContext);
}
