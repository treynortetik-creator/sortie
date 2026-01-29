'use client';

type CaptureStatus = 'captured' | 'processing' | 'ready' | 'needs_review' | 'error';

interface StatusBadgeProps {
  status: CaptureStatus;
}

const statusConfig: Record<CaptureStatus, { emoji: string; label: string; className: string }> = {
  captured: {
    emoji: '📷',
    label: 'Captured',
    className: 'bg-[#2d331f] text-[#c8d5a3] border border-[#3d4a2a]',
  },
  processing: {
    emoji: '⏳',
    label: 'Processing',
    className: 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/50',
  },
  ready: {
    emoji: '✅',
    label: 'Ready',
    className: 'bg-green-900/30 text-green-400 border border-green-800/50',
  },
  needs_review: {
    emoji: '⚠️',
    label: 'Needs Review',
    className: 'bg-orange-900/30 text-orange-400 border border-orange-800/50',
  },
  error: {
    emoji: '❌',
    label: 'Error',
    className: 'bg-red-900/30 text-red-400 border border-red-800/50',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      role="status"
      aria-label={`Status: ${config.label}`}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}
