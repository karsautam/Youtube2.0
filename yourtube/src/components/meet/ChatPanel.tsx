import { useRef, useState } from "react";
import { FileUp, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/meet/api";
import type { ChatMessage } from "@/lib/meet/types";

type Props = {
  messages: ChatMessage[];
  canChat: boolean;
  onSendMessage: (text: string) => void;
  onSendFile: (file: File) => Promise<void>;
  onClose: () => void;
};

const EMOJIS = [
  "ðŸ˜€", "ðŸ˜‚", "ðŸ˜…", "ðŸ˜", "ðŸ¤”", "ðŸ‘", "ðŸ‘", "ðŸ™Œ", "ðŸŽ‰", "â¤ï¸",
  "ðŸ”¥", "ðŸ’¯", "ðŸ˜®", "ðŸ˜¢", "ðŸ˜Ž", "ðŸ¤",
];

export default function ChatPanel({
  messages,
  canChat,
  onSendMessage,
  onSendFile,
  onClose,
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const submit = (msg: string) => {
    const trimmed = msg.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setText("");
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert("File must be 50MB or smaller.");
      return;
    }
    setSending(true);
    try {
      await onSendFile(file);
    } catch {
      alert("File upload failed. Please try again.");
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <aside className="flex h-full w-80 max-w-[85vw] flex-col border-l border-white/10 bg-slate-900 text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="font-semibold">In-call chat</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-background/10">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="pt-6 text-center text-sm text-slate-400">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex items-start gap-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={m.sender.image} />
              <AvatarFallback>{m.sender.name?.[0] || "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-400">
                <span className="font-medium text-slate-200">{m.sender.name}</span>
                <span className="ml-1.5">
                  {new Date(m.ts).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </p>
              {m.type === "text" ? (
                <p className="break-words text-sm text-slate-100">
                  <LinkifyText text={m.text || ""} />
                </p>
              ) : (
                <FileBubble message={m} />
              )}
            </div>
          </div>
        ))}
      </div>

      {!canChat && (
        <p className="border-t border-white/10 px-3 py-2 text-center text-xs text-slate-400">
          Chat is disabled by the host.
        </p>
      )}

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              disabled={!canChat}
              onClick={() => setText((t) => t + e)}
              className="rounded p-0.5 text-lg transition hover:bg-background/10 disabled:opacity-40"
            >
              {e}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            disabled={!canChat || sending}
            className="h-9 w-9 text-white hover:bg-background/10"
            title="Attach file"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Input
            value={text}
            disabled={!canChat}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(text);
              }
            }}
            placeholder="Type a message"
            className="h-9 flex-1 bg-background/10 text-white placeholder:text-slate-400 focus-visible:ring-blue-500"
          />
          <Button
            size="icon"
            disabled={!canChat || !text.trim()}
            className="h-9 w-9"
            onClick={() => submit(text)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

function LinkifyText({ text }: { text: string }) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlPattern);
  const isUrl = (s: string) => /^https?:\/\/[^\s]+$/.test(s);
  return (
    <>
      {parts.map((part, i) =>
        isUrl(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 underline hover:text-blue-300"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function FileBubble({ message }: { message: ChatMessage }) {
  const isImage = message.fileType?.startsWith("image/");
  const isAudio = message.fileType?.startsWith("audio/");
  const isVideo = message.fileType?.startsWith("video/");
  return (
    <div className="mt-1 rounded-lg border border-white/10 bg-background/5 p-2">
      {isImage && (
        <a href={message.url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.url}
            alt={message.name || "image"}
            className="mb-2 max-h-40 rounded object-cover"
          />
        </a>
      )}
      {isAudio && (
        <audio controls src={message.url} className="mb-2 h-9 w-full" />
      )}
      {isVideo && (
        <video controls src={message.url} className="mb-2 max-h-40 rounded" />
      )}
      <a
        href={message.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 text-sm text-blue-400 hover:underline"
      >
        <FileUp className="h-4 w-4 shrink-0" />
        <span className={cn("truncate", isImage && "text-xs text-slate-300")}>
          {message.name || "file"}
        </span>
        {message.size ? (
          <span className="shrink-0 text-xs text-slate-400">
            {formatBytes(message.size)}
          </span>
        ) : null}
      </a>
    </div>
  );
}
