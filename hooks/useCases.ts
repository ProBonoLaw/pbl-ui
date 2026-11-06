import { useAccountCases } from './useAccountCases';

export function useCases() {
  const { cases, error, loading, refresh } = useAccountCases();

  return {
    data: cases,
    error,
    loading,
    refresh,
  };
}
