import { useEffect, useRef } from "react";

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.muted = false;

    const retry = () => {
      el.play().catch(() => {});
      document.removeEventListener("click", retry);
      document.removeEventListener("keydown", retry);
    };

    const play = () => {
      const result = el.play();
      if (!result || typeof result.catch !== "function") return;
      result.catch(() => {
        // Autoplay may stay blocked until the page is interacted with. Keep
        // trying on the next click / key press so remote audio is not lost.
        document.addEventListener("click", retry);
        document.addEventListener("keydown", retry);
      });
    };

    play();
    const track = stream.getAudioTracks()[0];
    if (track) track.addEventListener("unmute", play);
    return () => {
      document.removeEventListener("click", retry);
      document.removeEventListener("keydown", retry);
      if (track) track.removeEventListener("unmute", play);
    };
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline />;
}

export default function MeetingAudio({
  participantStreams,
  selfSocketId,
}: {
  participantStreams: Record<string, MediaStream>;
  selfSocketId: string | null;
}) {
  return (
    <div aria-hidden className="sr-only">
      {Object.entries(participantStreams).map(([socketId, stream]) =>
        socketId === selfSocketId ? null : (
          <RemoteAudio key={socketId} stream={stream} />
        )
      )}
    </div>
  );
}
