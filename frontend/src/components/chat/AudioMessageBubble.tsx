import { Mic, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface AudioMessageBubbleProps {
  audioUrl?: string | null;
  audioDuration?: number | null;
  transcriptionText?: string;
  isUser: boolean;
}

function formatSeconds(sec: number): string {
  const safe = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function AudioMessageBubble({
  audioUrl,
  audioDuration,
  transcriptionText,
  isUser,
}: AudioMessageBubbleProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(audioDuration ?? 0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5>(1);

  useEffect(() => {
    if (audioDuration && audioDuration > 0) {
      setDuration(audioDuration);
    }
  }, [audioDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      } else if (audioDuration && audioDuration > 0) {
        setDuration(audioDuration);
      }
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (
        Number.isFinite(audio.duration) &&
        audio.duration > 0 &&
        audio.duration !== duration
      ) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onPause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
    };
  }, [audioDuration, audioUrl, duration]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        audio.playbackRate = playbackRate;
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const toggleRate = () => {
    const nextRate: 1 | 1.5 = playbackRate === 1 ? 1.5 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const effectiveTotal = duration > 0 ? duration : audioDuration ?? 1;
  const progressPercent =
    effectiveTotal > 0 ? Math.min(100, Math.round((currentTime / effectiveTotal) * 100)) : 0;

  const hasCustomTranscription =
    Boolean(transcriptionText) &&
    transcriptionText !== '[Mensagem de voz enviada — desabafo em áudio]';

  return (
    <div className="space-y-2">
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" playsInline />}

      <div className="flex items-center gap-3 min-w-[210px] sm:min-w-[250px]">
        <button
          type="button"
          onClick={() => void togglePlay()}
          disabled={!audioUrl}
          aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm transition ${
            isUser
              ? 'bg-white text-calm-700 hover:bg-calm-50'
              : 'bg-calm-600 text-white hover:bg-calm-700'
          } disabled:opacity-50`}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>

        <div className="flex-1">
          <div
            className={`h-2 w-full overflow-hidden rounded-full ${
              isUser ? 'bg-white/30' : 'bg-slate-200'
            }`}
          >
            <div
              className={`h-full transition-all ${
                isUser ? 'bg-white' : 'bg-calm-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-1 flex items-center justify-between text-[11px] opacity-90">
            <span className="inline-flex items-center gap-1">
              <Mic className="h-3 w-3" />
              {formatSeconds(isPlaying ? currentTime : effectiveTotal)}
            </span>

            {audioUrl && (
              <button
                type="button"
                onClick={toggleRate}
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  isUser
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {playbackRate}x
              </button>
            )}
          </div>
        </div>
      </div>

      {hasCustomTranscription && (
        <p
          className={`border-t pt-1.5 text-xs italic ${
            isUser ? 'border-white/20 text-calm-50' : 'border-slate-200 text-slate-600'
          }`}
        >
          “{transcriptionText}”
        </p>
      )}
    </div>
  );
}
