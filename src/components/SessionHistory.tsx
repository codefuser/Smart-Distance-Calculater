import React, { useState, useMemo } from 'react';
import { Search, Download, Trash2, Eye, Calendar, Clock, Activity, AlertTriangle } from 'lucide-react';
import { MeasurementSession } from '../types';
import { exportSessionJSON } from '../utils/storage';
import { SessionDetailModal } from './SessionDetailModal';

interface SessionHistoryProps {
  sessions: MeasurementSession[];
  onDeleteSession: (id: string) => void;
  onClearAllSessions: () => void;
}

type SortOption = 'newest' | 'oldest' | 'longest' | 'shortest';

export const SessionHistory: React.FC<SessionHistoryProps> = ({
  sessions,
  onDeleteSession,
  onClearAllSessions,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [selectedSession, setSelectedSession] = useState<MeasurementSession | null>(null);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState<boolean>(false);

  // Filter and Sort Sessions efficiently
  const processedSessions = useMemo(() => {
    let result = [...sessions];

    // Search Filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(term) || s.date.toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortOption === 'newest') return b.endTime - a.endTime;
      if (sortOption === 'oldest') return a.endTime - b.endTime;
      if (sortOption === 'longest') return b.totalDistanceMeters - a.totalDistanceMeters;
      if (sortOption === 'shortest') return a.totalDistanceMeters - b.totalDistanceMeters;
      return 0;
    });

    return result;
  }, [sessions, searchTerm, sortOption]);

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  return (
    <div className="w-full space-y-4">
      {/* Search, Sort & Clear All Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Sort Select */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="bg-slate-950 border border-slate-800 text-xs text-slate-200 py-2 px-3 rounded-lg focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="longest">Sort: Longest Distance</option>
            <option value="shortest">Sort: Shortest Distance</option>
          </select>

          {/* Delete All Button */}
          {sessions.length > 0 && (
            <button
              onClick={() => setShowConfirmDeleteAll(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/50 rounded-lg text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Session Cards List */}
      {processedSessions.length === 0 ? (
        <div className="w-full py-12 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center text-center p-6 space-y-2">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
            <Activity className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-300">No Measurement Sessions Found</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            {searchTerm
              ? 'No sessions match your search query.'
              : 'Complete a tracking measurement and press STOP to automatically save sessions here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {processedSessions.map((session) => (
            <div
              key={session.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm group"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-sm text-slate-100 group-hover:text-emerald-400 transition-colors truncate">
                    {session.name}
                  </h3>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold shrink-0 bg-emerald-950/60 border border-emerald-900/80 px-2 py-0.5 rounded">
                    {session.totalDistanceMeters.toFixed(1)} m
                  </span>
                </div>

                {/* Sub Metadata */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 my-3 font-mono">
                  <div className="flex items-center gap-1.5 truncate">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{session.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{formatTime(session.durationSeconds)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Activity className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{(session.totalDistanceMeters / 1000).toFixed(3)} km</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-indigo-400 font-bold">±</span>
                    <span>Acc: {session.averageAccuracyMeters.toFixed(1)}m</span>
                  </div>
                </div>
              </div>

              {/* Card Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80 mt-2">
                <button
                  onClick={() => setSelectedSession(session)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-400" /> View
                </button>

                <button
                  onClick={() => exportSessionJSON(session)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" /> Export
                </button>

                <button
                  onClick={() => onDeleteSession(session.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-medium border border-rose-900/40 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Session Details Modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}

      {/* Confirmation Modal for Delete All */}
      {showConfirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-950 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-100">Clear All Saved Sessions?</h3>
            <p className="text-xs text-slate-400">
              Are you sure you want to permanently delete all {sessions.length} saved measurement sessions from LocalStorage? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowConfirmDeleteAll(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearAllSessions();
                  setShowConfirmDeleteAll(false);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md"
              >
                Yes, Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
