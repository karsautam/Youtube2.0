import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";
import { ThumbsUp, ThumbsDown, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { CommentSkeleton } from "@/components/ui/skeleton";

interface Comment {
  _id: string;
  videoid: string;
  userid: string;
  parentId?: string | null;
  commentbody: string;
  usercommented: string;
  userimage?: string;
  likesCount: number;
  dislikesCount: number;
  replyCount: number;
  liked: boolean;
  disliked: boolean;
  edited?: boolean;
  commentedon: string;
}

const Comments = ({ videoId }: any) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [sort, setSort] = useState<"newest" | "top">("newest");
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const [replyText, setReplyText] = useState("");
  const [repliesOpen, setRepliesOpen] = useState<Record<string, boolean>>({});
  const [replies, setReplies] = useState<Record<string, Comment[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});
  const { user } = useUser();
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

  if (loading) {
    return <CommentSkeleton count={5} />;
  }

  const handleSubmitComment = async () => {
    if (!user || !newComment.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await axiosInstance.post("/comment/postcomment", {
        userId: user._id,
        videoid: videoId,
        commentbody: newComment,
      });
      if (res.data.comment) {
        setComments([res.data.data, ...comments]);
      }
      setNewComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (comment: Comment) => {
    setEditingCommentId(comment._id);
    setEditText(comment.commentbody);
  };

  const handleUpdateComment = async () => {
    if (!editText.trim() || !editingCommentId) return;
    try {
      const res = await axiosInstance.post(
        `/comment/editcomment/${editingCommentId}`,
        { userId: user?._id, commentbody: editText }
      );
      if (res.data) {
        setComments((prev) =>
          prev.map((c) =>
            c._id === editingCommentId ? { ...c, commentbody: editText, edited: true } : c
          )
        );
        setEditingCommentId(null);
        setEditText("");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await axiosInstance.delete(`/comment/deletecomment/${id}`, {
        data: { userId: user?._id },
      });
      if (res.data.comment) {
        setComments((prev) => prev.filter((c) => c._id !== id));
        setReplies((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    } catch (error) {
      console.log(error);
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
      if (replies[comment._id]) {
        setReplies((prev) => ({
          ...prev,
          [comment._id]: prev[comment._id].map((r) => (r._id === comment._id ? updated : r)),
        }));
      }
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
      if (replies[comment._id]) {
        setReplies((prev) => ({
          ...prev,
          [comment._id]: prev[comment._id].map((r) => (r._id === comment._id ? updated : r)),
        }));
      }
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
    try {
      const res = await axiosInstance.post("/comment/postcomment", {
        userId: user._id,
        videoid: videoId,
        parentId: comment._id,
        commentbody: replyText,
      });
      if (res.data.comment) {
        setReplies((prev) => ({
          ...prev,
          [comment._id]: [...(prev[comment._id] || []), res.data.data],
        }));
        setComments((prev) =>
          prev.map((c) =>
            c._id === comment._id ? { ...c, replyCount: c.replyCount + 1 } : c
          )
        );
        setReplyText("");
        setReplyTarget(null);
      }
    } catch (error) {
      console.log(error);
    }
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
      {comment.userid === user?._id && (
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
    </div>
  );

  const renderComment = (comment: Comment) => (
    <div key={comment._id} className="flex gap-4">
      <Avatar className="w-10 h-10 shrink-0">
        <AvatarImage src={comment.userimage || undefined} />
        <AvatarFallback>{comment.usercommented?.[0] || "U"}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-medium text-sm">{comment.usercommented}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.commentedon))} ago
            {comment.edited ? " • edited" : ""}
          </span>
        </div>

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
          <p className="text-sm break-words">{comment.commentbody}</p>
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
                placeholder="Add a reply..."
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">{comments.length} Comments</h2>
        <div className="flex items-center gap-1 rounded-full bg-muted p-0.5 text-xs">
          {(["newest", "top"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-full px-3 py-1 capitalize transition-colors ${
                sort === s ? "bg-background font-semibold shadow-sm" : "text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {user && (
        <div className="flex gap-4">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user.image || ""} />
            <AvatarFallback>{user.name?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="Add a comment..."
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

      <div className="space-y-5">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => renderComment(comment))
        )}
      </div>
    </div>
  );
};

export default Comments;
