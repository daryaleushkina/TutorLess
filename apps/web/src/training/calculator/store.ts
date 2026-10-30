import { initialCalculator, type CalculatorState } from './engine';

export interface Position { x: number; y: number }
export interface SessionCalculator { calculator: CalculatorState; position?: Position }
// Состояние живёт до конца сессии только в этой странице; перезагрузка очищает Map.
const sessions = new Map<string, SessionCalculator>();
export function sessionCalculator(id: string): SessionCalculator {
  let state = sessions.get(id);
  if (!state) { state = { calculator: initialCalculator() }; sessions.set(id, state); }
  return state;
}
export function saveSessionCalculator(id: string, state: SessionCalculator): void { sessions.set(id, state); }
export function clearSessionCalculator(id: string): void { sessions.delete(id); }
