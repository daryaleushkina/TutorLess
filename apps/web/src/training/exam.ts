import { useAccount } from '../session/session';

/** AppGate открывает тренировку только после выбора экзамена аккаунта. */
export function useActiveExam() {
  const account = useAccount();
  if (account.activeExam === null) throw new Error('training without an active exam');
  return account.activeExam;
}
