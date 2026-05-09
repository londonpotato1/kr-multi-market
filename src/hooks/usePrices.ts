import useSWR from 'swr';
import type { PricesResponse } from '@shared/types/prices.js';

const fetcher = async (url: string): Promise<PricesResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export function usePrices() {
  const { data, error, isLoading } = useSWR<PricesResponse>(
    '/api/prices',
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: false,
      dedupingInterval: 4000,
    },
  );
  return { data, error, isLoading };
}
