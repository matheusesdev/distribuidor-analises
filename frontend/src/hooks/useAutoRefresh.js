import { useState, useEffect } from 'react';
import { AUTO_REFRESH_SECONDS } from '../constants';

export function useAutoRefresh(fetchData) {
  const [refreshCountdown, setRefreshCountdown] = useState(AUTO_REFRESH_SECONDS);
  const [nextRefreshAt, setNextRefreshAt] = useState(() => Date.now() + AUTO_REFRESH_SECONDS * 1000);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), AUTO_REFRESH_SECONDS * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const timer = setInterval(() => {
      const secondsLeft = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
      setRefreshCountdown(secondsLeft);
    }, 1000);
    return () => clearInterval(timer);
  }, [nextRefreshAt]);

  return { refreshCountdown, nextRefreshAt, setNextRefreshAt };
}
