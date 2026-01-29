'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { LocalCapture } from '@/lib/db';
import StatusBadge from './StatusBadge';

interface CaptureCardProps {
  capture: LocalCapture;
}

export default function CaptureCard({ capture }: CaptureCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (capture.imageBlob) {
      const url = URL.createObjectURL(capture.imageBlob);
      setThumbnailUrl(url); // eslint-disable-line react-hooks/set-state-in-effect -- syncing blob URL from IndexedDB
      return () => URL.revokeObjectURL(url);
    }
    setThumbnailUrl(null);
  }, [capture.imageBlob]);

  const formattedTime = useMemo(() => {
    const date = new Date(capture.createdAt);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [capture.createdAt]);

  return (
    <Link href={`/captures/${capture.id}`} aria-label={`View capture${capture.name ? `: ${capture.name}` : ` ${formattedTime}`}`} className="block active:scale-[0.98] transition-transform">
      <div className="bg-[#2d331f] border border-[#3d4a2a] rounded-lg overflow-hidden hover:border-[#4a5d23] active:bg-[#353d25] transition-colors">
        <div className="flex gap-3 p-4">
          {thumbnailUrl ? (
            <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-[#1a1f16]">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob URL from IndexedDB */}
              <img
                src={thumbnailUrl}
                alt="Capture thumbnail"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-14 h-14 flex-shrink-0 rounded-lg bg-[#1a1f16] flex items-center justify-center">
              <span className="text-[#8b956d] text-2xl">📷</span>
            </div>
          )}

          <div className="flex-1 min-w-0 py-0.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {capture.name && (
                  <p className="text-[#c8d5a3] font-medium text-[0.9375rem] leading-snug truncate">
                    {capture.name}
                  </p>
                )}
                {capture.event && (
                  <p className="text-[#8b956d] text-xs truncate mt-0.5">
                    {capture.event}
                  </p>
                )}
              </div>
              <StatusBadge status={capture.status} />
            </div>

            <p className="text-[#8b956d] text-xs mt-1">{formattedTime}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
