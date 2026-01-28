import { useEffect } from "react";

export const useDockBehavior = ({
  showSceneTree,
  showScene,
  showBottomBar,
  isCoarsePointer,
  showTouchFab,
  showTouchTabletFull,
  dockVisited,
  tabletDockCollapsed,
  mobileDockOpen,
  setMobileNavOpen,
  setMobileDockOpen,
  setTabletDockCollapsed,
  setDockHintActive,
  setDockCueActive,
}) => {
  useEffect(() => {
    if (!showSceneTree) {
      setMobileNavOpen(false);
    }
  }, [showSceneTree, setMobileNavOpen]);

  useEffect(() => {
    if (!showScene) {
      setMobileNavOpen(false);
    }
  }, [showScene, setMobileNavOpen]);

  useEffect(() => {
    if (!showBottomBar || !isCoarsePointer) {
      setMobileDockOpen(false);
    }
  }, [showBottomBar, isCoarsePointer, setMobileDockOpen]);

  useEffect(() => {
    if (!showTouchFab) {
      setMobileDockOpen(false);
    }
  }, [showTouchFab, setMobileDockOpen]);

  useEffect(() => {
    if (!showTouchTabletFull) {
      setTabletDockCollapsed(false);
    }
  }, [showTouchTabletFull, setTabletDockCollapsed]);

  useEffect(() => {
    if (!mobileDockOpen) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") setMobileDockOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mobileDockOpen, setMobileDockOpen]);

  useEffect(() => {
    if (dockVisited) {
      setDockHintActive(false);
      return undefined;
    }
    if (showTouchFab || (showTouchTabletFull && tabletDockCollapsed)) {
      setDockHintActive(true);
    } else {
      setDockHintActive(false);
    }
    return undefined;
  }, [
    showTouchFab,
    showTouchTabletFull,
    tabletDockCollapsed,
    dockVisited,
    setDockHintActive,
  ]);

  useEffect(() => {
    if (mobileDockOpen) {
      setDockCueActive(true);
      const timer = window.setTimeout(() => setDockCueActive(false), 2000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [mobileDockOpen, setDockCueActive]);

  useEffect(() => {
    if (showTouchTabletFull && !tabletDockCollapsed) {
      setDockCueActive(true);
      const timer = window.setTimeout(() => setDockCueActive(false), 2000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [showTouchTabletFull, tabletDockCollapsed, setDockCueActive]);
};
