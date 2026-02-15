'use client';

import { useEffect } from 'react';

export function StoragePersist(): React.ReactNode {
  useEffect(() => {
    if (navigator.storage?.persist) {
      navigator.storage.persist().then((granted) => {
        if (granted) {
          console.log('Storage persistence granted');
        }
      }).catch(() => {
        // Non-fatal — browser may not support or may deny
      });
    }
  }, []);

  return null;
}
