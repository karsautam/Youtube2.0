import { Check, FileVideo, Image, Upload, X } from "lucide-react";
import React, { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Progress } from "./ui/progress";
import axiosInstance from "@/lib/axiosinstance";

const VideoUploader = ({
  channelId,
  channelName,
  onUploaded,
}: {
  channelId?: string;
  channelName?: string;
  onUploaded?: () => void;
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [subtitleFiles, setSubtitleFiles] = useState<File[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "finalizing">("idle");
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handlesubtitlechange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const valid = Array.from(files).filter(
        (f) => /\.(vtt|srt)$/i.test(f.name) || f.type === "text/vtt"
      );
      setSubtitleFiles((prev) => [...prev, ...valid]);
    }
    if (subtitleInputRef.current) subtitleInputRef.current.value = "";
  };

  const handlefilechange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.type.startsWith("video/")) {
        toast.error("Please upload a valid video file.");
        return;
      }
      setVideoFile(file);
      if (!videoTitle) setVideoTitle(file.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handlecoverchange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file.");
        return;
      }
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const resetForm = () => {
    setVideoFile(null);
    setVideoTitle("");
    setSubtitleFiles([]);
    setCoverFile(null);
    setCoverPreview(null);
    setIsUploading(false);
    setUploadProgress(0);
    setUploadComplete(false);
    setPhase("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (subtitleInputRef.current) subtitleInputRef.current.value = "";
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const cancelUpload = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    setPhase("idle");
    toast.error("Upload cancelled");
  };

  const uploadWithProgress = (
    url: string,
    formData: FormData,
    signal: AbortSignal
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded * 100) / e.total));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Invalid response from server"));
          }
        } else {
          let msg = "Upload failed";
          try {
            const err = JSON.parse(xhr.responseText);
            msg = err?.error?.message || err?.message || msg;
          } catch {}
          reject(new Error(msg));
        }
      };

      xhr.onerror = () => reject(new Error("Network error — check your connection and try again"));
      xhr.onabort = () => reject(new Error("Cancelled"));

      signal.addEventListener("abort", () => xhr.abort());
      xhr.send(formData);
    });
  };

  const handleUpload = async () => {
    if (!videoFile || !videoTitle.trim()) {
      toast.error("Please provide file and title");
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    setPhase("uploading");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const formData = new FormData();
      formData.append("file", videoFile);
      for (const sub of subtitleFiles) {
        formData.append("subtitles", sub);
      }

      const backendBase =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        (typeof window !== "undefined"
          ? window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
            ? "http://localhost:5000"
            : "https://yourtube-backend-ewzs.onrender.com"
          : "http://localhost:5000");

      const { secure_url, subtitles } = await uploadWithProgress(
        `${backendBase}/video/stream-upload`,
        formData,
        controller.signal
      );

      setUploadProgress(100);
      setPhase("finalizing");

      const filepath = secure_url.startsWith("LOCAL:") ? secure_url.slice(6) : secure_url;

      let thumbnailUrl = "";
      if (coverFile) {
        const coverFormData = new FormData();
        coverFormData.append("cover", coverFile);
        try {
          const coverRes = await uploadWithProgress(
            `${backendBase}/video/upload-cover`,
            coverFormData,
            controller.signal
          );
          thumbnailUrl = coverRes.thumbnail || "";
        } catch {}
      }

      await axiosInstance.post("/video/save-direct-upload", {
        videotitle: videoTitle,
        videochanel: channelName || "",
        uploader: channelId || "",
        filepath,
        thumbnail: thumbnailUrl,
        filesize: videoFile.size,
        qualities: [],
        subtitles: subtitles || [],
      });

      toast.success("Upload successful");
      setUploadComplete(true);
      resetForm();
      onUploaded?.();
    } catch (error: any) {
      if (error?.message !== "Cancelled") {
        console.error("Upload error:", error);
        toast.error(error?.message || "Upload failed. Please try again.");
      }
      setIsUploading(false);
      setUploadProgress(0);
      setPhase("idle");
    }
  };

  return (
    <div className="bg-muted rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Upload a video</h2>

      <div className="space-y-4">
        {!videoFile ? (
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-accent transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-lg font-medium">
              Drag and drop video files to upload
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to select files
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              MP4, WebM, MOV or AVI — Any size
            </p>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="video/*"
              onChange={handlefilechange}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <div className="bg-blue-100 p-2 rounded-md">
                <FileVideo className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{videoFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              {!isUploading && (
                <Button variant="ghost" size="icon" onClick={cancelUpload}>
                  <X className="w-5 h-5" />
                </Button>
              )}
              {uploadComplete && (
                <div className="bg-green-100 p-1 rounded-full">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="title">Title (required)</Label>
                <Input
                  id="title"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="Add a title that describes your video"
                  disabled={isUploading || uploadComplete}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Cover image (optional)</Label>
                <div className="mt-1 flex items-center gap-3">
                  {coverPreview ? (
                    <div className="relative w-40 h-24 rounded-lg overflow-hidden border">
                      <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                        onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={isUploading || uploadComplete}
                    >
                      <Image className="h-4 w-4 mr-1" />
                      Add cover
                    </Button>
                  )}
                  <input
                    type="file"
                    ref={coverInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handlecoverchange}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  JPG, PNG — auto-generated if not provided
                </p>
              </div>

              <div>
                <Label>Subtitles (optional)</Label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => subtitleInputRef.current?.click()}
                    disabled={isUploading || uploadComplete}
                  >
                    Add subtitle file
                  </Button>
                  {subtitleFiles.map((f, i) => (
                    <span
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
                    >
                      {f.name}
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setSubtitleFiles((prev) =>
                            prev.filter((_, j) => j !== i)
                          )
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="file"
                    ref={subtitleInputRef}
                    className="hidden"
                    accept=".vtt,.srt,text/vtt"
                    multiple
                    onChange={handlesubtitlechange}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  WebVTT (.vtt) or SubRip (.srt) files
                </p>
              </div>
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{phase === "finalizing" ? "Saving..." : "Uploading..."}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <div className="flex justify-end gap-3">
              {!uploadComplete && (
                <>
                  <Button onClick={cancelUpload} disabled={uploadComplete}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || !videoTitle.trim() || uploadComplete}
                  >
                    {isUploading ? "Uploading..." : "Upload"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoUploader;
