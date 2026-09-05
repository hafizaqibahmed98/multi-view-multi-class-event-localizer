"use client";

import { useEffect } from "react";

export function protectBeforeUnload(event: BeforeUnloadEvent): void {
  event.preventDefault();
  event.returnValue = "";
}

export function useDirtyBeforeUnload(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    window.addEventListener("beforeunload", protectBeforeUnload);
    return () => window.removeEventListener("beforeunload", protectBeforeUnload);
  }, [dirty]);
}
