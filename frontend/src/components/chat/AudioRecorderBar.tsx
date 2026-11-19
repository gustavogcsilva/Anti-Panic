import { Mic, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface AudioRecorderBarProps {
  disabled?: boolean;
  onSendAudio: (payload: {
    audioDataUrl: string;
    durationSeconds: number;
    transcription: string;
  }) => Promise<void> | void;
  onError?: (msg: string) => void;
}

interface BrowserSpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionCtor(): (new () => BrowserSpeechRecognitionInstance) | null {
  const win = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognitionInstance;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

function selectSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/aac',
  ];

  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {
      // Ignora
    }
  }

  return '';
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao converter áudio gravado.'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function resolveFriendlyMicError(error: unknown): string {
  const errName = error instanceof DOMException || error instanceof Error ? error.name : '';

  if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
    return 'Permissão de microfone bloqueada. Toque no ícone de cadeado na barra do navegador e permita o uso do microfone.';
  }
  if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    return 'Nenhum microfone foi encontrado neste dispositivo. Conecte um fone/microfone ou digite sua mensagem.';
  }
  if (errName === 'NotReadableError' || errName === 'TrackStartError') {
    return 'Não foi possível acessar o microfone porque ele está sendo usado por outro aplicativo.';
  }

  return 'Não foi possível iniciar o microfone. Verifique as permissões do navegador ou envie por texto.';
}

export function AudioRecorderBar({
  disabled = false,
  onSendAudio,
  onError,
}: AudioRecorderBarProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const transcriptRef = useRef<string>('');
  const recognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null);
  const shouldSendOnStopRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);

  const cleanupRecordingResources = () => {
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignora
      }
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupRecordingResources();
    };
  }, []);

  const startRecording = async () => {
    if (disabled || isRecording) return;

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      onError?.(
        'Seu navegador atual não suporta gravação de áudio direta. Tente usar Chrome, Safari ou Edge atualizados.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      transcriptRef.current = '';
      shouldSendOnStopRef.current = false;

      const mimeType = selectSupportedMimeType();

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const sendRequested = shouldSendOnStopRef.current;
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - startTimeRef.current) / 1000)
        );
        const finalTranscript = transcriptRef.current.trim();
        const recordedMime = recorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(chunksRef.current, { type: recordedMime });

        cleanupRecordingResources();
        setIsRecording(false);
        setElapsedSeconds(0);

        if (!sendRequested || audioBlob.size === 0) {
          return;
        }

        try {
          const audioDataUrl = await blobToDataUrl(audioBlob);
          await onSendAudio({
            audioDataUrl,
            durationSeconds: durationSec,
            transcription: finalTranscript,
          });
        } catch {
          onError?.('Não foi possível processar o áudio gravado. Tente novamente.');
        }
      };

      // Inicia transcrição automática pelo navegador (Web Speech API) quando disponível
      const SpeechCtor = getSpeechRecognitionCtor();
      if (SpeechCtor) {
        try {
          const recognition = new SpeechCtor();
          recognition.lang = 'pt-BR';
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (event) => {
            const parts: string[] = [];
            for (let i = 0; i < event.results.length; i += 1) {
              const item = event.results[i]?.[0]?.transcript;
              if (item) parts.push(item);
            }
            transcriptRef.current = parts.join(' ').trim();
          };
          recognition.onerror = () => {
            // Silencioso: se falhar, o áudio ainda é salvo e enviado normalmente
          };
          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          // Ignora se o dispositivo móvel não permitir SpeechRecognition simultâneo
        }
      }

      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      recorder.start(250);
      setIsRecording(true);
      setElapsedSeconds(0);

      timerIntervalRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedSeconds(secs);
        // Limite seguro de 90s por áudio para garantir armazenamento rápido offline e envio leve
        if (secs >= 90 && mediaRecorderRef.current?.state === 'recording') {
          shouldSendOnStopRef.current = true;
          mediaRecorderRef.current.stop();
        }
      }, 500);
    } catch (err) {
      cleanupRecordingResources();
      onError?.(resolveFriendlyMicError(err));
    }
  };

  const cancelRecording = () => {
    shouldSendOnStopRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecordingResources();
      setIsRecording(false);
      setElapsedSeconds(0);
    }
  };

  const finishAndSendRecording = () => {
    shouldSendOnStopRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  if (!isRecording) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => void startRecording()}
        title="Gravar áudio (estilo WhatsApp) para desabafar ou extravasar"
        aria-label="Gravar mensagem de voz"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-calm-100 text-calm-700 transition hover:bg-calm-200 active:scale-95 disabled:opacity-50"
      >
        <Mic className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-between gap-2 rounded-2xl border border-rose-200 bg-rose-50/95 px-3 py-2 shadow-inner">
      <button
        type="button"
        onClick={cancelRecording}
        title="Cancelar e descartar gravação"
        aria-label="Cancelar gravação de áudio"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm transition hover:bg-rose-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2 text-xs font-semibold text-rose-700">
        <span className="h-2.5 w-2.5 animate-ping rounded-full bg-rose-600" />
        <span>Gravando {formatTimer(elapsedSeconds)}</span>
        <span className="hidden items-end gap-0.5 sm:inline-flex" aria-hidden="true">
          <span className="h-2.5 w-1 animate-pulse rounded-full bg-rose-400" />
          <span className="h-4 w-1 animate-pulse rounded-full bg-rose-500" />
          <span className="h-3 w-1 animate-pulse rounded-full bg-rose-400" />
          <span className="h-4 w-1 animate-pulse rounded-full bg-rose-600" />
        </span>
      </div>

      <button
        type="button"
        onClick={finishAndSendRecording}
        title="Enviar áudio"
        aria-label="Enviar gravação de áudio"
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
      >
        <Send className="h-3.5 w-3.5" />
        Enviar
      </button>
    </div>
  );
}
