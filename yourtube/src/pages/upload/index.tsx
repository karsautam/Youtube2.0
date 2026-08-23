import VideoUploader from "@/components/VideoUploader";
import { useUser } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import React from "react";

const UploadPage = () => {
  const { user, handlegooglesignin } = useUser();
  const router = useRouter();

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-600">Sign in to upload videos.</p>
        <Button onClick={handlegooglesignin}>Sign in</Button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-white">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-6">Upload a video</h1>
        <VideoUploader
          channelId={user._id ? String(user._id) : undefined}
          channelName=""
          onUploaded={() => router.push("/")}
        />
        <p className="text-xs text-gray-400 mt-3">
          Uploaded without selecting a channel — it will be listed as
          &quot;Standalone&quot;.
        </p>
      </div>
    </div>
  );
};

export default UploadPage;
