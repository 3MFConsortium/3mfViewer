import { useEffect, useRef } from "react";

export const useDragDrop = (handleLoadFile, setDragActive) => {
  const dragDepthRef = useRef(0);

  useEffect(() => {
    const prevent = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const handleDragEnter = (event) => {
      prevent(event);
      dragDepthRef.current += 1;
      if (event.dataTransfer?.types?.includes("Files")) {
        setDragActive(true);
      }
    };

    const handleDragOver = (event) => {
      prevent(event);
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setDragActive(true);
    };

    const handleDragLeave = (event) => {
      prevent(event);
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setDragActive(false);
      }
    };

    const handleDrop = (event) => {
      prevent(event);
      dragDepthRef.current = 0;
      setDragActive(false);
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        handleLoadFile(files[0]);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleLoadFile, setDragActive]);
};
