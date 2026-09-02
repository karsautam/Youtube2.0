import { useCallback, useEffect, useRef, useState } from "react";

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 },
};

export type MediaManager = {
  localStream: MediaStream | null;
  micOn: boolean;
  camOn: boolean;
  presenting: boolean;
  permissionError: string | null;
  requesting: boolean;
  mediaReady: boolean;
  devices: { audio: MediaDeviceInfo[]; video: MediaDeviceInfo[] };
  startMedia: () => Promise<void>;
  toggleMic: () => void;
  toggleCam: () => void;
  setMic: (on: boolean) => void;
  setCam: (on: boolean) => void;
  switchCamera: () => Promise<void>;
  startScreenShare: () => Promise<boolean>;
  stopScreenShare: () => void;
  getActiveVideoTrack: () => MediaStreamTrack | null;
  canSwitchCamera: boolean;
};

export function useMedia(
  onSpeakingChange?: (speaking: boolean) => void,
  initialMicOn = true,
  initialCamOn = true
): MediaManager {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(initialMicOn);
  const [camOn, setCamOn] = useState(initialCamOn);
  const [presenting, setPresenting] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [devices, setDevices] = useState<{
    audio: MediaDeviceInfo[];
    video: MediaDeviceInfo[];
  }>({ audio: [], video: [] });
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const micRef = useRef(initialMicOn);
  const camRef = useRef(initialCamOn);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingRef = useRef(false);
  const onSpeakingRef = useRef(onSpeakingChange);
  const videoTrackListeners = useRef<((track: MediaStreamTrack | null) => void)[]>([]);

  onSpeakingRef.current = onSpeakingChange;

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const all = await navigator.mediaDevices.enumerateDevices();
    const audio = all.filter((d) => d.kind === "audioinput");
    const video = all.filter((d) => d.kind === "videoinput");
    setDevices({ audio, video });
    setCanSwitchCamera(video.length > 1);
  }, []);

  const applyTrackState = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((t) => {
      if (t.kind === "audio") t.enabled = micRef.current;
      if (t.kind === "video")
        t.enabled = camRef.current && !screenTrackRef.current;
    });
  }, []);

  const notifyVideoTrackChange = useCallback(() => {
    const track =
      screenTrackRef.current || cameraTrackRef.current || null;
    videoTrackListeners.current.forEach((cb) => cb(track));
  }, []);

  const startMedia = useCallback(async () => {
    if (streamRef.current) {
      setMediaReady(true);
      return;
    }
    setRequesting(true);
    setPermissionError(null);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { ...AUDIO_CONSTRAINTS },
          video: { ...VIDEO_CONSTRAINTS, facingMode: "user" },
        });
      } catch (firstErr: any) {
        if (
          firstErr?.name === "NotAllowedError" ||
          firstErr?.name === "SecurityError" ||
          firstErr?.name === "NotFoundError"
        ) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { ...AUDIO_CONSTRAINTS },
          });
          setPermissionError(
            "Camera access was denied. You are connected with audio only."
          );
        } else if (firstErr?.name === "NotReadableError") {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { ...AUDIO_CONSTRAINTS },
          });
          setPermissionError(
            "Camera is in use by another app. Connected with audio only."
          );
        } else {
          throw firstErr;
        }
      }
      streamRef.current = stream;
      cameraTrackRef.current = stream.getVideoTracks()[0] || null;
      setLocalStream(stream);
      applyTrackState();
      setMicOn(micRef.current);
      setCamOn(camRef.current);

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        analyserRef.current = analyser;
      }
      refreshDevices();
    } catch (error) {
      setPermissionError(
        "Microphone access was denied. You can still join and use the chat."
      );
    } finally {
      setRequesting(false);
      setMediaReady(true);
    }
  }, [applyTrackState, refreshDevices]);

  useEffect(() => {
    const id = setInterval(() => {
      const analyser = analyserRef.current;
      if (!analyser) return;
      const data = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const speaking = rms > 0.035;
      if (speaking !== speakingRef.current) {
        speakingRef.current = speaking;
        onSpeakingRef.current?.(speaking);
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () =>
      navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
  }, [refreshDevices]);

  const toggleMic = useCallback(() => {
    micRef.current = !micRef.current;
    setMicOn(micRef.current);
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = micRef.current;
    });
  }, []);

  const toggleCam = useCallback(() => {
    camRef.current = !camRef.current;
    setCamOn(camRef.current);
    applyTrackState();
    notifyVideoTrackChange();
  }, [applyTrackState, notifyVideoTrackChange]);

  const setMic = useCallback((on: boolean) => {
    micRef.current = on;
    setMicOn(on);
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = on;
    });
  }, []);

  const setCam = useCallback(
    (on: boolean) => {
      camRef.current = on;
      setCamOn(on);
      applyTrackState();
      notifyVideoTrackChange();
    },
    [applyTrackState, notifyVideoTrackChange]
  );

  const switchCamera = useCallback(async () => {
    const track = cameraTrackRef.current;
    if (!track || !navigator.mediaDevices?.enumerateDevices) return;
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === "videoinput"
    );
    if (cams.length < 2) return;
    const current = track.getSettings().deviceId;
    const idx = cams.findIndex((c) => c.deviceId === current);
    const next = cams[(idx + 1) % cams.length];
    await track.applyConstraints({ deviceId: { exact: next.deviceId } });
  }, []);

  const stopScreenShare = useCallback(() => {
    const track = screenTrackRef.current;
    if (track) {
      track.onended = null;
      track.stop();
      screenTrackRef.current = null;
    }
    setPresenting(false);
    applyTrackState();
    notifyVideoTrackChange();
  }, [applyTrackState, notifyVideoTrackChange]);

  const startScreenShare = useCallback(async () => {
    if (screenTrackRef.current) return false;
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15 } },
        audio: false,
      });
      const track = screen.getVideoTracks()[0];
      screenTrackRef.current = track;
      track.onended = () => stopScreenShare();
      setPresenting(true);
      applyTrackState();
      notifyVideoTrackChange();
      return true;
    } catch {
      return false;
    }
  }, [applyTrackState, notifyVideoTrackChange, stopScreenShare]);

  return {
    localStream,
    micOn,
    camOn,
    presenting,
    permissionError,
    requesting,
    mediaReady,
    devices,
    startMedia,
    toggleMic,
    toggleCam,
    setMic,
    setCam,
    switchCamera,
    startScreenShare,
    stopScreenShare,
    getActiveVideoTrack: () =>
      screenTrackRef.current || cameraTrackRef.current || null,
    canSwitchCamera,
  };
}
