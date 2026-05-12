import useSWR from 'swr';
import { useEffect } from 'react';
import type { PricesResponse } from '@shared/types/prices.js';
import { appendPremium } from '../lib/signal';

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
      refreshInterval: 2000,
      revalidateOnFocus: false,
      dedupingInterval: 1500,
    },
  );

  useEffect(() => {
    if (!data?.tickers) return;

    for (const [ticker, payload] of Object.entries(data.tickers)) {
      const pct = payload.premium?.pctUsd;
      if (typeof pct === 'number' && Number.isFinite(pct)) {
        appendPremium(ticker, pct, data.ts);
      }
    }
  }, [data]);

  return { data, error, isLoading };
}
