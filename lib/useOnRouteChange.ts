"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export function useOnRouteChange(onLeave: () => void) {
    const pathname = usePathname();
    const search = useSearchParams();

    // keep latest handler without re-subscribing
    const onLeaveRef = useRef(onLeave);
    useEffect(() => { onLeaveRef.current = onLeave; }, [onLeave]);

    // 1) Fire when this component unmounts (leaving the route boundary)
    useEffect(() => {
        return () => { onLeaveRef.current?.(); };
    }, []);

    // 2) Fire on internal URL changes even if this component persists
    useEffect(() => {
        // Return a cleanup that runs **before** deps change next time (i.e., leaving current URL)
        return () => { onLeaveRef.current?.(); };
    }, [pathname, search]);

    // 3) Fire on refresh/close/external nav
    useEffect(() => {
        const onPageHide = () => onLeaveRef.current?.();
        const onBeforeUnload = () => onLeaveRef.current?.();

        window.addEventListener("pagehide", onPageHide);
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => {
            window.removeEventListener("pagehide", onPageHide);
            window.removeEventListener("beforeunload", onBeforeUnload);
        };
    }, []);
}