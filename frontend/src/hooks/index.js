import { useState, useEffect, useCallback, useRef } from "react";

export function useFetch(fetchFn, deps = [], interval = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    try {
      const res = await fetchFn();
      if (mountedRef.current) setData(res.data);
    } catch (err) {
      if (mountedRef.current) setError(err?.response?.data?.error || err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, deps); // eslint-disable-line

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);
    fetch();
    let timer;
    if (interval) timer = setInterval(fetch, interval * 1000);
    return () => { mountedRef.current = false; clearInterval(timer); };
  }, [fetch, interval]);

  return { data, loading, error, refetch: fetch };
}

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : initial; }
    catch { return initial; }
  });
  const set = (v) => { setValue(v); localStorage.setItem(key, JSON.stringify(v)); };
  return [value, set];
}

export function useDebounce(value, delay = 300) {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}
