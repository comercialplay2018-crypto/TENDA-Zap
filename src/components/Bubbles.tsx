import { useState, useRef } from "react";
import { Play, Pause, FileText, Volume2, CheckCheck } from "lucide-react";
import type { ChatMessage } from "@/types/balcao";
import { formatStamp } from "@/utils/time";

export function Bubbles({
  messages,
  timeZone,
}: {
  messages: ChatMessage[];
  timeZone: string;
}) {
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRefs = useRef<Record<number, HTMLAudioElement | null>>({});

  function toggleAudioPlay(id: number) {
    const el = audioRefs.current[id];
    if (!el) {
      setPlayingId((prev) => (prev === id ? null : id));
      return;
    }

    if (playingId === id) {
      el.pause();
      setPlayingId(null);
    } else {
      // Pause any previously playing audio
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId]?.pause();
      }
      el.play()
        .then(() => setPlayingId(id))
        .catch((err) => {
          console.warn("Could not play audio element:", err);
          setPlayingId(id);
        });
    }
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted">
        <p className="text-sm font-medium">Nenhuma mensagem nesta conversa ainda.</p>
        <p className="mt-1 text-xs">As mensagens e áudios enviados pelo cliente no WhatsApp aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 py-2">
      {messages.map((message) => {
        const isNote = message.kind === "nota";
        const isOut = message.direction === "out" && !isNote;

        if (isNote) {
          return (
            <div key={message.id} className="mx-auto my-1 max-w-[85%]">
              <div className="rounded-lg border border-warn/30 bg-warn-bg px-3 py-1.5 text-center text-xs leading-5 text-warn font-medium shadow-2xs">
                {message.body}
              </div>
            </div>
          );
        }

        return (
          <div
            key={message.id}
            className={`flex flex-col ${isOut ? "items-end ml-10" : "items-start mr-10"}`}
          >
            <div
              className={`group relative max-w-[92%] rounded-2xl p-3 shadow-2xs transition ${
                isOut
                  ? "rounded-tr-xs bg-moss text-ink border border-pine/20"
                  : "rounded-tl-xs bg-surface text-ink border border-line"
              }`}
            >
              {/* Audio Player for Real WhatsApp Voice Notes */}
              {message.kind === "audio" && (
                <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-black/5 p-2.5">
                  {message.mediaUrl && (
                    <audio
                      ref={(el) => {
                        audioRefs.current[message.id] = el;
                      }}
                      src={message.mediaUrl}
                      onEnded={() => setPlayingId(null)}
                      onError={() => setPlayingId(null)}
                      preload="none"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => toggleAudioPlay(message.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine text-pine-ink shadow-xs transition hover:scale-105 active:scale-95"
                    title={playingId === message.id ? "Pausar áudio" : "Ouvir áudio do cliente"}
                  >
                    {playingId === message.id ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
                  </button>
                  <div className="flex-1 min-w-[150px]">
                    <div className="flex items-center justify-between text-[11px] text-muted">
                      <span className="flex items-center gap-1 font-semibold text-ink">
                        <Volume2 size={13} className="text-pine" /> Áudio do cliente
                      </span>
                      <span className="text-[10px]">
                        {message.audioDuration ? `${message.audioDuration}s` : "Voz"}
                      </span>
                    </div>
                    {/* Dynamic waveform visualizer */}
                    <div className="mt-1.5 flex items-center gap-0.5 h-3">
                      {[30, 60, 40, 85, 55, 95, 70, 45, 65, 80, 35, 50, 75, 40, 60, 80, 50].map((h, i) => (
                        <span
                          key={i}
                          style={{ height: `${h}%` }}
                          className={`w-1 rounded-full transition-all duration-300 ${
                            playingId === message.id ? "bg-pine animate-pulse" : "bg-muted/40"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Image attachment */}
              {message.kind === "image" && message.mediaUrl && (
                <div className="mb-2 overflow-hidden rounded-xl border border-line">
                  <img
                    src={message.mediaUrl}
                    alt="Foto enviada"
                    className="max-h-60 w-full object-cover"
                  />
                </div>
              )}

              {/* Document/PDF attachment */}
              {message.kind === "pdf" && (
                <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-line bg-sand/60 p-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-clay text-clay-ink">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">
                      {message.filename || "documento.pdf"}
                    </p>
                    <p className="text-[11px] text-muted">Documento PDF recebido no WhatsApp</p>
                  </div>
                </div>
              )}

              {/* Message text / transcription */}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink select-text">
                {message.body}
              </p>

              {/* Timestamp & double checkmark for sent messages */}
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted/70">
                <span>{formatStamp(message.createdAt, timeZone)}</span>
                {isOut && <CheckCheck size={13} className="text-pine" />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
