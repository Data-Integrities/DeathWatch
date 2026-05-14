import { useState, useEffect, useCallback, useRef } from 'react';

let initialized = false;

function loadPaddleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Paddle) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paddle.js'));
    document.head.appendChild(script);
  });
}

// Global listener so Initialize is only called once
let eventListener: ((event: any) => void) | null = null;

export function usePaddle(onCheckoutComplete?: () => void) {
  const [paddle, setPaddle] = useState<any>(null);
  const callbackRef = useRef(onCheckoutComplete);
  callbackRef.current = onCheckoutComplete;

  useEffect(() => {
    eventListener = (event: any) => {
      console.log('[Paddle] Event:', event?.name, event);
      if (event?.name === 'checkout.completed') {
        callbackRef.current?.();
      }
    };
  }, []);

  useEffect(() => {
    loadPaddleScript()
      .then(() => {
        const w = window as any;
        if (!initialized) {
          w.Paddle.Initialize({
            token: 'live_02f3d8e429900a20bc27d8a3b64',
            eventCallback: (event: any) => eventListener?.(event),
          });
          initialized = true;
        }
        setPaddle(w.Paddle);
      })
      .catch((err) => console.error(err.message));
  }, []);

  return paddle;
}
