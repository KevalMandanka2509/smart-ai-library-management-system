import { useEffect, useRef } from 'react';

const useHardwareScanner = (onScan, active = true) => {
  const buffer = useRef('');
  const lastKeyTime = useRef(Date.now());

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e) => {
      // Ignore if user is holding down a key or typing in an input/textarea 
      // where they specifically want to use the Enter key.
      if (e.repeat) return;

      const currentTime = Date.now();
      
      // Hardware scanners type very fast. Usually < 20ms per character. 
      // If the delay is > 50ms, it's likely human typing, so clear the buffer.
      if (currentTime - lastKeyTime.current > 50) {
        buffer.current = '';
      }
      
      lastKeyTime.current = currentTime;

      if (e.key === 'Enter') {
        if (buffer.current.length > 3) { // Valid barcode should have some length
          // Prevent default to avoid form submission if focused on another input
          e.preventDefault(); 
          const scannedCode = buffer.current;
          buffer.current = '';
          onScan(scannedCode);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Printable character
        buffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, active]);
};

export default useHardwareScanner;
