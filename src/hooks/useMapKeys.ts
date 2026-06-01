import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMapKeys } from "@/lib/nearby-search.functions";

let cached: { googleMapsKey: string; mapboxToken: string } | null = null;

export function useMapKeys() {
  const fetchKeys = useServerFn(getMapKeys);
  const [keys, setKeys] = useState(cached);

  useEffect(() => {
    if (cached) return;
    fetchKeys().then((k) => {
      cached = k;
      setKeys(k);
    });
  }, [fetchKeys]);

  return keys;
}
