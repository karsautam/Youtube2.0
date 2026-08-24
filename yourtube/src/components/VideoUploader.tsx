import { Check, FileVideo, Upload, X } from "lucide-react";
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
  const [uploadComplete, setUploadComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const handlesubtitlechange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const valid = Array.from(files).filter(
        (f) => /\.(vtt|srt)$/i.test(f.name) || f.type === "text/vtt"
      );
      setSubtitleFiles((prev) => [...prev, ...valid]);
    }
    if (subtitleInputRef.current) {
      subtitleInputRef.current.value = "";
    }
  };
  const handlefilechange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.type.startsWith("video/")) {
        toast.error("Please upload a valid video file.");
        return;
      }
      if (file.size > 2 * 1024 * 1024 * 1024) {
        toast.error("File size exceeds 2GB limit.");
        return;
      }
      setVideoFile(file);
      const filename = file.name;
      if (!videoTitle) {
        setVideoTitle(filename);
      }
    }
  };
  const resetForm = () => {
    setVideoFile(null);
    setVideoTitle("");
    setSubtitleFiles([]);
    setIsUploading(false);
    setUploadProgress(0);
    setUploadComplete(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (subtitleInputRef.current) {
      subtitleInputRef.current.value = "";
    }
  };
  const cancelUpload = () => {
    if (isUploading) {
      toast.error("Your video upload has been cancelled");
    }
  };
  const handleUpload = async () => {
    if (!videoFile || !videoTitle.trim()) {
      toast.error("Please provide file and title");
      return;
    }
    const formdata = new FormData();
    formdata.append("file", videoFile);
    formdata.append("videotitle", videoTitle);
    formdata.append("videochanel", channelName ?? "");
    formdata.append("uploader", channelId ?? "");
    subtitleFiles.forEach((f) => formdata.append("subtitles", f));
    console.log(formdata)
    try {
      setIsUploading(true);
      setUploadProgress(0);
      const res = await axiosInstance.post("/video/upload", formdata, {
         headers: {
    "Content-Type": "multipart/form-data", // âœ… MUST for FormData
  },
        onUploadProgress: (progresEvent: any) => {
          const progress = Math.round(
            (progresEvent.loaded * 100) / progresEvent.total
          );
          setUploadProgress(progress);
        },
      });
      toast.success("Upload successfully");
      resetForm();
      onUploaded?.();
    } catch (error) {
      console.error("Error uploading video:", error);
      toast.error("There was an error uploading your video. Please try again.");
    } finally {
      setIsUploading(false);
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
              MP4, WebM, MOV or AVI â€¢ Up to 2GB
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
                  {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
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
                  <span>Uploading...</span>
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
                    disabled={
                      isUploading || !videoTitle.trim() || uploadComplete
                    }
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
