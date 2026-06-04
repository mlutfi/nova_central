'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for polling an API endpoint at regular intervals.
 */
export function usePolling<T>(
  fetcher: () => Promise<{ data: T | null; error: string | null }>,
  intervalMs: number = 5000,
  enabled: boolean = true
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcher();
      if (result.data) {
        setData(result.data);
        setError(null);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'Fetch failed');
    } finally {
      setIsLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (!enabled) return;

    fetchData();
    intervalRef.current = setInterval(fetchData, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, intervalMs, enabled]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  return { data, error, isLoading, refresh };
}
