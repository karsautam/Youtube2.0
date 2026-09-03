import { useCallback, useEffect, useRef, useState } from "react";

type Args = {
  localStream: MediaStream | null;
  participantStreams: Record<string, MediaStream>;
  participants: { socketId: string; name: string }[];
};

export function useRecording({ localStream, participantStreams, participants }: Args) {
  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioNodesRef = useRef<MediaStreamAudioSourceNode[]>([]);
  const connectedAudioTracksRef = useRef<Set<string>>(new Set());
  const videoElementsRef = useRef<Record<string, HTMLVideoElement>>({});
  const recordingRef = useRef(false);

  const streamsRef = useRef({ localStream, participantStreams });
  streamsRef.current = { localStream, participantStreams };
  const participantsRef = useRef(participants);
  participantsRef.current = participants;

  const ensureElements = () => {
    const all = {
      local: streamsRef.current.localStream,
      ...streamsRef.current.participantStreams,
    };
    for (const [key, stream] of Object.entries(all)) {
      if (!stream) continue;
      if (!videoElementsRef.current[key]) {
        const v = document.createElement("video");
        v.muted = true;
        v.autoplay = true;
        v.playsInline = true;
        v.srcObject = stream;
        v.addEventListener("loadedmetadata", () => v.play().catch(() => {}));
        videoElementsRef.current[key] = v;
      }
    }
    for (const key of Object.keys(videoElementsRef.current)) {
      if (key !== "local" && !streamsRef.current.participantStreams[key]) {
        delete videoElementsRef.current[key];
      }
    }
  };

  const drawFrame = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, w, h);

    const order = [
      "local",
      ...Object.keys(streamsRef.current.participantStreams),
    ];
    const videos = order.filter((k) => videoElementsRef.current[k]);
    if (videos.length === 0) {
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Meeting recording", w / 2, h / 2);
      return;
    }
    const cols = Math.ceil(Math.sqrt(videos.length));
    const rows = Math.ceil(videos.length / cols);
    const tw = w / cols;
    const th = h / rows;
    videos.forEach((key, i) => {
      const v = videoElementsRef.current[key];
      if (!v) return;
      const cx = (i % cols) * tw;
      const cy = Math.floor(i / cols) * th;
      const name =
        key === "local"
          ? "You"
          : participantsRef.current.find((p) => p.socketId === key)?.name || "";
      const vw = v.videoWidth || 16;
      const vh = v.videoHeight || 9;
      const vr = vw / vh;
      const tr = tw / th;
      let sw: number, sh: number, sx: number, sy: number;
      if (vr > tr) {
        sh = vh;
        sw = sh * tr;
        sx = (vw - sw) / 2;
        sy = 0;
      } else {
        sw = vw;
        sh = sw / tr;
        sx = 0;
        sy = (vh - sh) / 2;
      }
      try {
        ctx.drawImage(v, sx, sy, sw, sh, cx, cy, tw, th);
      } catch {}
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(cx, cy + th - 40, tw, 40);
      ctx.fillStyle = "#ffffff";
      ctx.font = "22px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(name, cx + 14, cy + th - 12);
    });
  };

  const connectNewAudio = (
    ctx: AudioContext,
    dest: MediaStreamAudioDestinationNode
  ) => {
    const all = {
      local: streamsRef.current.localStream,
      ...streamsRef.current.participantStreams,
    };
    for (const stream of Object.values(all)) {
      if (!stream) continue;
      stream.getAudioTracks().forEach((t) => {
        if (connectedAudioTracksRef.current.has(t.id)) return;
        try {
          const src = ctx.createMediaStreamSource(new MediaStream([t]));
          src.connect(dest);
          audioNodesRef.current.push(src);
          connectedAudioTracksRef.current.add(t.id);
        } catch {}
      });
    }
  };

  const startRecording = useCallback(() => {
    if (recordingRef.current) return;
    setRecordingError(null);
    setRecordingUrl(null);

    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    canvasRef.current = canvas;
    ctxRef.current = canvas.getContext("2d");
    ensureElements();

    const canvasVideo = canvas.captureStream(15);

    let ctx: AudioContext;
    let dest: MediaStreamAudioDestinationNode;
    try {
      ctx = new AudioContext();
      dest = ctx.createMediaStreamDestination();
      ctx.resume().catch(() => {});
      audioCtxRef.current = ctx;
      audioDestRef.current = dest;
      connectNewAudio(ctx, dest);
    } catch (e) {
      console.warn("Audio mix unavailable", e);
      ctx = null as any;
      dest = null as any;
    }

    const videoTracks = canvasVideo.getVideoTracks();
    const audioTracks = dest ? dest.stream.getAudioTracks() : [];
    const combined = new MediaStream([...videoTracks, ...audioTracks]);

    let mime = "";
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
      mime = "video/webm;codecs=vp9";
    } else if (MediaRecorder.isTypeSupported("video/webm")) {
      mime = "video/webm";
    }

    try {
      const recorder = new MediaRecorder(
        combined,
        mime ? { mimeType: mime } : undefined
      );
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime || "video/webm" });
        setRecordingUrl(URL.createObjectURL(blob));
        cancelAnimationFrame(rafRef.current);
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      recordingRef.current = true;
      setRecording(true);

      const loop = () => {
        if (!recordingRef.current) return;
        drawFrame();
        if (ctx && dest) connectNewAudio(ctx, dest);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      setRecordingError("Recording could not be started in this browser.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    recordingRef.current = false;
    setRecording(false);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    recorderRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    audioDestRef.current = null;
    audioNodesRef.current = [];
    connectedAudioTracksRef.current = new Set();
    cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    return () => {
      recordingRef.current = false;
      cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    };
  }, []);

  return { recording, recordingUrl, recordingError, startRecording, stopRecording };
}
