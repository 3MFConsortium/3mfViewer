import { useEffect, useRef } from "react";

export const useDragDrop = (handleLoadFile, setDragActive) => {
  const dragDepthRef = useRef(0);

  useEffect(() => {
    const prevent = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const isFileDrag = (event) => event.dataTransfer?.types?.includes("Files") === true;

    const handleDragEnter = (event) => {
      prevent(event);
      if (!isFileDrag(event)) return;
      dragDepthRef.current += 1;
      setDragActive(true);
    };

    const handleDragOver = (event) => {
      prevent(event);
      if (!isFileDrag(event)) return;
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

    const resetDrag = () => {
      dragDepthRef.current = 0;
      setDragActive(false);
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragend", resetDrag);
    window.addEventListener("blur", resetDrag);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragend", resetDrag);
      window.removeEventListener("blur", resetDrag);
    };
  }, [handleLoadFile, setDragActive]);
};
