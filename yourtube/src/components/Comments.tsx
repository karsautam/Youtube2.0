import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { format, formatDistanceToNow } from "date-fns";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { toast } from "sonner";
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Flag,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import { CommentSkeleton } from "@/components/ui/skeleton";

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

const SORT_OPTIONS: { key: "newest" | "oldest" | "top" | "relevant"; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "top", label: "Most liked" },
  { key: "relevant", label: "Most relevant" },
];

const REPORT_REASONS: { key: string; label: string }[] = [
  { key: "spam", label: "Spam or misleading" },
  { key: "harassment", label: "Harassment or hate speech" },
  { key: "offensive", label: "Offensive content" },
  { key: "misinformation", label: "Misinformation" },
  { key: "impersonation", label: "Impersonation" },
  { key: "other", label: "Something else" },
];

interface Comment {
  _id: string;
  videoid: string;
  userid: string;
  parentId?: string | null;
  commentbody: string;
  usercommented: string;
  userimage?: string;
  location?: string;
  likesCount: number;
  dislikesCount: number;
  replyCount: number;
  liked: boolean;
  disliked: boolean;
  edited?: boolean;
  editedAt?: string;
  revision?: number;
  commentedon: string;
}

const Comments = ({ videoId }: any) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [sort, setSort] = useState<"newest" | "oldest" | "top" | "relevant">("newest");
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const [replyText, setReplyText] = useState("");
  const [repliesOpen, setRepliesOpen] = useState<Record<string, boolean>>({});
  const [replies, setReplies] = useState<Record<string, Comment[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});
  const [reportTarget, setReportTarget] = useState<Comment | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [captcha, setCaptcha] = useState<{ token: string; prompt: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const { user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const userId = user?._id || null;

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, sort]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        `/comment/${videoId}?sort=${sort}&userId=${userId || ""}`
      );
      setComments(res.data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const canModifyComment = (comment: Comment) => {
    if (!user || comment.userid !== user._id) return false;
    const age = Date.now() - new Date(comment.commentedon).getTime();
    return age < EDIT_WINDOW_MS;
  };

  const guardedPost = async (
    endpoint: string,
    payload: any,
    onSuccess: (data: any) => void
  ) => {
    try {
      const res = await axiosInstance.post(endpoint, {
        userId: user?._id,
        ...payload,
        captchaToken: captcha?.token,
        captchaAnswer,
      });
      const data = res.data;
      if (data?.needCaptcha) {
        setCaptcha(data.captcha);
        setCaptchaAnswer("");
        return;
      }
      setCaptcha(null);
      setCaptchaAnswer("");
      onSuccess(data);
    } catch (e: any) {
      if (e?.response?.status === 429 && e?.response?.data?.needCaptcha) {
        setCaptcha(e.response.data.captcha);
        setCaptchaAnswer("");
        return;
      }
      toast.error(e?.response?.data?.message || "Something went wrong");
    }
  };

  if (loading) {
    return <CommentSkeleton count={5} />;
  }

  const handleSubmitComment = async () => {
    if (!user || !newComment.trim()) return;
    setIsSubmitting(true);
    await guardedPost(
      "/comment/postcomment",
      { videoid: videoId, commentbody: newComment },
      (data) => {
        if (data.comment) {
          setComments((prev) => [data.data, ...prev]);
        }
        setNewComment("");
      }
    );
    setIsSubmitting(false);
  };

  const handleEdit = (comment: Comment) => {
    setEditingCommentId(comment._id);
    setEditText(comment.commentbody);
  };

  const handleUpdateComment = async () => {
    if (!editText.trim() || !editingCommentId) return;
    let target =
      comments.find((c) => c._id === editingCommentId) || null;
    if (!target) {
      for (const list of Object.values(replies)) {
        const r = list.find((c) => c._id === editingCommentId);
        if (r) {
          target = r;
          break;
        }
      }
    }
    await guardedPost(
      `/comment/editcomment/${editingCommentId}`,
      { commentbody: editText, revision: target?.revision ?? 0 },
      (data) => {
        const patch = (list: Comment[]) =>
          list.map((c) =>
            c._id === editingCommentId
              ? { ...c, ...data, commentbody: data.commentbody }
              : c
          );
        setComments((prev) => patch(prev));
        setReplies((prev) => {
          const next: Record<string, Comment[]> = {};
          for (const [key, list] of Object.entries(prev)) {
            next[key] = patch(list);
          }
          return next;
        });
        setEditingCommentId(null);
        setEditText("");
      }
    );
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await axiosInstance.delete(`/comment/deletecomment/${id}`, {
        data: { userId: user?._id },
      });
      if (res.data.comment) {
        setComments((prev) => prev.filter((c) => c._id !== id));
        setReplies((prev) => {
          const next: Record<string, Comment[]> = {};
          for (const [key, list] of Object.entries(prev)) {
            const filtered = list.filter((c) => c._id !== id);
            if (filtered.length > 0) next[key] = filtered;
          }
          return next;
        });
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not delete comment");
    }
  };

  const submitReport = async (reason: string) => {
    if (!reportTarget || reporting) return;
    if (!reason) {
      toast.info("Please choose a reason");
      return;
    }
    setReportReason(reason);
    setReporting(true);
    try {
      await axiosInstance.post(`/comment/report/${reportTarget._id}`, {
        userId: user?._id,
        reason,
      });
      toast.success("Comment reported — thank you. It will be reviewed by an admin.");
      setReportTarget(null);
      setReportReason(null);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Could not report this comment"
      );
      setReportTarget(null);
      setReportReason(null);
    } finally {
      setReporting(false);
    }
  };

  const toggleLike = async (comment: Comment) => {
    if (!user) return;
    try {
      const res = await axiosInstance.post(`/comment/like/${comment._id}`, {
        userId: user._id,
      });
      const updated: Comment = {
        ...comment,
        liked: res.data.liked,
        disliked: false,
        likesCount: res.data.likesCount,
        dislikesCount: res.data.dislikesCount,
      };
      setComments((prev) => prev.map((c) => (c._id === comment._id ? updated : c)));
      setReplies((prev) => {
        const next: Record<string, Comment[]> = {};
        for (const [key, list] of Object.entries(prev)) {
          next[key] = list.map((r) => (r._id === comment._id ? updated : r));
        }
        return next;
      });
    } catch (error) {
      console.log(error);
    }
  };

  const toggleDislike = async (comment: Comment) => {
    if (!user) return;
    try {
      const res = await axiosInstance.post(`/comment/dislike/${comment._id}`, {
        userId: user._id,
      });
      const updated: Comment = {
        ...comment,
        disliked: res.data.disliked,
        liked: false,
        likesCount: res.data.likesCount,
        dislikesCount: res.data.dislikesCount,
      };
      setComments((prev) => prev.map((c) => (c._id === comment._id ? updated : c)));
      setReplies((prev) => {
        const next: Record<string, Comment[]> = {};
        for (const [key, list] of Object.entries(prev)) {
          next[key] = list.map((r) => (r._id === comment._id ? updated : r));
        }
        return next;
      });
    } catch (error) {
      console.log(error);
    }
  };

  const toggleReplies = async (comment: Comment) => {
    if (repliesOpen[comment._id]) {
      setRepliesOpen((prev) => ({ ...prev, [comment._id]: false }));
      return;
    }
    setRepliesOpen((prev) => ({ ...prev, [comment._id]: true }));
    if (!replies[comment._id]) {
      setLoadingReplies((prev) => ({ ...prev, [comment._id]: true }));
      try {
        const res = await axiosInstance.get(
          `/comment/reply/${comment._id}?userId=${userId || ""}`
        );
        setReplies((prev) => ({ ...prev, [comment._id]: res.data }));
      } catch (error) {
        console.log(error);
      } finally {
        setLoadingReplies((prev) => ({ ...prev, [comment._id]: false }));
      }
    }
  };

  const submitReply = async (comment: Comment) => {
    if (!user || !replyText.trim()) return;
    await guardedPost(
      "/comment/postcomment",
      { videoid: videoId, parentId: comment._id, commentbody: replyText },
      (data) => {
        if (data.comment) {
          setReplies((prev) => ({
            ...prev,
            [comment._id]: [...(prev[comment._id] || []), data.data],
          }));
          setComments((prev) =>
            prev.map((c) =>
              c._id === comment._id ? { ...c, replyCount: c.replyCount + 1 } : c
            )
          );
          setReplyText("");
          setReplyTarget(null);
        }
      }
    );
  };

  const renderBody = (text: string) => {
    const parts = text.split(/(@[A-Za-z0-9_]+)/g);
    return parts.map((part, i) =>
      /^@[A-Za-z0-9_]+$/.test(part) ? (
        <span key={i} className="font-medium text-blue-600">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const renderAuthorMeta = (comment: Comment) => {
    const ageOk = canModifyComment(comment);
    return (
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <button
          onClick={() => router.push(`/channel/${comment.userid}`)}
          className="font-medium text-sm hover:underline"
        >
          {comment.usercommented}
        </button>
        {comment.location && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {comment.location}
          </span>
        )}
        <span className="text-xs text-muted-foreground" title={format(new Date(comment.commentedon), "MMM d, yyyy 'at' h:mm:ss a")}>
          {format(new Date(comment.commentedon), "MMM d, yyyy 'at' h:mm a")}
        </span>
        {comment.edited && (
          <span
            className="text-xs text-muted-foreground"
            title={
              comment.editedAt
                ? `Edited ${format(new Date(comment.editedAt), "MMM d, yyyy 'at' h:mm a")}`
                : "Edited"
            }
          >
            (edited{comment.editedAt ? ` ${formatDistanceToNow(new Date(comment.editedAt))} ago` : ""})
          </span>
        )}
        {!ageOk && comment.userid === userId && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            edit window closed
          </span>
        )}
      </div>
    );
  };

  const renderActions = (comment: Comment) => (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
      <button
        onClick={() => toggleLike(comment)}
        disabled={!user}
        className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-40 ${
          comment.liked ? "text-blue-600 font-semibold" : "text-muted-foreground"
        }`}
      >
        <ThumbsUp className={`w-4 h-4 ${comment.liked ? "fill-blue-600" : ""}`} />
        {comment.likesCount > 0 ? comment.likesCount : ""}
      </button>
      <button
        onClick={() => toggleDislike(comment)}
        disabled={!user}
        className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors hover:bg-accent disabled:opacity-40 ${
          comment.disliked ? "text-blue-600 font-semibold" : "text-muted-foreground"
        }`}
      >
        <ThumbsDown className={`w-4 h-4 ${comment.disliked ? "fill-blue-600" : ""}`} />
        {comment.dislikesCount > 0 ? comment.dislikesCount : ""}
      </button>
      <button
        onClick={() => setReplyTarget(replyTarget?._id === comment._id ? null : comment)}
        className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
      >
        <MessageSquare className="w-4 h-4" />
        Reply
      </button>
      {canModifyComment(comment) && (
        <>
          <button
            onClick={() => handleEdit(comment)}
            className="rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(comment._id)}
            className="rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Delete
          </button>
        </>
      )}
      <button
        onClick={() => {
          setReportReason(null);
          setReportTarget(reportTarget?._id === comment._id ? null : comment);
        }}
        disabled={!user}
        className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs hover:bg-accent disabled:opacity-40 ${
          reportTarget?._id === comment._id
            ? "text-red-600 font-semibold"
            : "text-muted-foreground"
        }`}
      >
        <Flag className="w-3.5 h-3.5" />
        Report
      </button>

      {reportTarget?._id === comment._id && (
        <div className="w-full mt-1 rounded-lg border p-2 space-y-1.5 bg-muted/40">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <ShieldAlert className="w-3.5 h-3.5" />
            Why are you reporting this?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.key}
                onClick={() => void submitReport(r.key)}
                disabled={reporting}
                className={`rounded-full border px-2.5 py-1 text-xs hover:bg-background disabled:opacity-50 ${
                  reportReason === r.key ? "border-red-400 text-red-600" : ""
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderComment = (comment: Comment) => (
    <div key={comment._id} className="flex items-start gap-4">
      <button
        onClick={() => router.push(`/channel/${comment.userid}`)}
        className="shrink-0 self-start"
      >
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarImage src={comment.userimage || undefined} />
          <AvatarFallback>{comment.usercommented?.[0] || "U"}</AvatarFallback>
        </Avatar>
      </button>
      <div className="flex-1 min-w-0">
        {renderAuthorMeta(comment)}

        {editingCommentId === comment._id ? (
          <div className="space-y-2">
            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button onClick={handleUpdateComment} disabled={!editText.trim()} size="sm">
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingCommentId(null);
                  setEditText("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm break-words">{renderBody(comment.commentbody)}</p>
        )}

        {renderActions(comment)}

        {replyTarget?._id === comment._id && (
          <div className="flex gap-3 mt-2">
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarImage src={user?.image || undefined} />
              <AvatarFallback>{user?.name?.[0] || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Textarea
                autoFocus
                placeholder="Add a reply... (Type @username to mention)"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-[60px] resize-none border-0 border-b-2 rounded-none focus-visible:ring-0"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setReplyTarget(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => submitReply(comment)} disabled={!replyText.trim()}>
                  Reply
                </Button>
              </div>
            </div>
          </div>
        )}

        {comment.replyCount > 0 && (
          <button
            onClick={() => toggleReplies(comment)}
            className="flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 hover:underline"
          >
            {repliesOpen[comment._id] ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {repliesOpen[comment._id] ? "Hide replies" : `${comment.replyCount} replies`}
          </button>
        )}

        {repliesOpen[comment._id] && (
          <div className="mt-2 pl-2 border-l-2 border-border space-y-4">
            {loadingReplies[comment._id] ? (
              <p className="text-xs text-muted-foreground">Loading replies...</p>
            ) : (
              (replies[comment._id] || []).map((r) => renderComment(r))
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderCaptcha = () => {
    if (!captcha) return null;
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
          <ShieldAlert className="w-4 h-4" />
          You're posting too quickly. Solve the CAPTCHA to continue:
        </p>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">{captcha.prompt} = ?</span>
          <input
            value={captchaAnswer}
            onChange={(e) => setCaptchaAnswer(e.target.value)}
            placeholder="Answer"
            className="w-24 rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground">Then click Comment/Reply again.</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-xl font-semibold">{comments.length} Comments</h2>
        <div className="flex items-center gap-1 rounded-full bg-muted p-0.5 text-xs">
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`rounded-full px-3 py-1 capitalize transition-colors ${
                sort === s.key
                  ? "bg-background font-semibold shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => renderComment(comment))
        )}
      </div>

      {user && (
        <div className="flex gap-4">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user.image || ""} />
            <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            {renderCaptcha()}
            <Textarea
              placeholder="Add a comment... (Type @username to mention someone)"
              value={newComment}
              onChange={(e: any) => setNewComment(e.target.value)}
              className="min-h-[80px] resize-none border-0 border-b-2 rounded-none focus-visible:ring-0"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setNewComment("")} disabled={!newComment.trim()}>
                Cancel
              </Button>
              <Button onClick={handleSubmitComment} disabled={!newComment.trim() || isSubmitting}>
                Comment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Comments;