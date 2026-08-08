import React from 'react';
import { Compass } from 'lucide-react';

interface CompassRoseProps {
  headingAngle: number | null;
  cardinalDirection: string;
  isAvailable?: boolean;
  needsPermission?: boolean;
  onRequestPermission?: () => void;
}

export const CompassRose: React.FC<CompassRoseProps> = ({
  headingAngle,
  cardinalDirection,
  isAvailable: _isAvailable = false,
  needsPermission = false,
  onRequestPermission,
}) => {
  const displayDegrees = headingAngle !== null ? Math.round(headingAngle) : 0;

  if (needsPermission && onRequestPermission) {
    return (
      <button
        onClick={onRequestPermission}
        className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-cyan-400 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xl backdrop-blur-sm transition-all"
        title="Enable Compass Orientation"
      >
        <Compass className="w-3.5 h-3.5" />
        <span>Enable Compass</span>
      </button>
    );
  }

  return (
    <div
      className="bg-slate-950/90 border border-slate-800 text-slate-100 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-xl backdrop-blur-sm pointer-events-auto"
      title="Current Device Compass Heading"
    >
      <div
        className="relative w-4 h-4 flex items-center justify-center transition-transform duration-300 ease-out"
        style={{ transform: `rotate(${displayDegrees}deg)` }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-cyan-400 text-cyan-400">
          <path d="M12 2L15 9H9L12 2Z" fill="#22d3ee" />
          <path d="M12 22L9 15H15L12 22Z" fill="#64748b" />
        </svg>
      </div>

      <div className="flex items-baseline gap-1 text-xs font-bold font-mono">
        <span className="text-cyan-400">{cardinalDirection}</span>
        <span className="text-slate-300 text-[11px] font-normal">
          {headingAngle !== null ? `${displayDegrees}°` : '---'}
        </span>
      </div>
    </div>
  );
};
