import { ReportButton } from '../ReportButton';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  CornerDownRight,
  HelpCircle,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Send,
  Share2,
  ThumbsUp,
  Trash2,
  Award
} from 'lucide-react';
import type { UserProfile } from '../../types';
import {
  likeCount,
  timeAgo,
  useComments,
  type CommunityApi,
  type CommunityComment,
  type CommunityPost
} from '../../lib/community';

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

export default function CommunityPostCard({
  post,
  api,
  currentUser,
  requireAuth,
  onToast
}: {
  post: CommunityPost;
  api: CommunityApi;
  currentUser: UserProfile;
  /** Returns true when the user may interact with this post; otherwise prompts sign-in. */
  requireAuth: (post: CommunityPost) => boolean;
  onToast: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editContent, setEditContent] = useState(post.content);
  const [expanded, setExpanded] = useState(false);
  const liked = post.likedBy.includes(api.myUid);
  const mine = api.isMine(post.authorUid);
  const likes = likeCount(post);
  const long = post.content.length > 280;

  const handleLike = () => {
    if (!requireAuth(post)) return;
    api.toggleLike(post);
  };

  const handleShare = async () => {
    const text = `${post.title} — DIY Electronics community`;
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
        onToast('Link copied to clipboard');
      }
    } catch {
      /* user cancelled */
    }
  };

  const tags = [post.deviceCategory, post.brand, post.deviceModel].filter(t => t && t !== 'Universal');

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm shadow-slate-200/50 dark:shadow-none overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src={post.authorAvatar || FALLBACK_AVATAR} alt={post.authorName} className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-100 dark:ring-indigo-900/50" referrerPolicy="no-referrer" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{post.authorName}</span>
              {post.isVerifiedCompany && (
                <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">✓</span>
              )}
              {post.source === 'seed' && (
                <span title="Example thread included with the app to show how the feed works" className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">Example</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {timeAgo(post.createdAt)} · {post.authorRole}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
              post.isSolved
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
            }`}
          >
            {post.isSolved ? <CheckCircle2 className="w-3 h-3" /> : <HelpCircle className="w-3 h-3" />}
            {post.isSolved ? 'Solved' : 'Needs help'}
          </span>
          {mine && post.source !== 'seed' && (
            <div className="relative">
              <button onClick={() => setMenuOpen(m => !m)} aria-label="Post options" className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    className="absolute right-0 mt-1 w-36 z-20 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg py-1 text-xs"
                  >
                    <button
                      onClick={() => {
                        setEditing(true);
                        setMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit post
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        if (window.confirm('Delete this post?')) api.deletePost(post);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-3 space-y-2">
        {editing ? (
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!editTitle.trim() || !editContent.trim()) return;
              api.editPost(post, { title: editTitle.trim(), content: editContent.trim() });
              setEditing(false);
            }}
            className="space-y-2"
          >
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <textarea rows={4} value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">Cancel</button>
              <button type="submit" className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 text-white text-xs font-bold">Save</button>
            </div>
          </form>
        ) : (
          <>
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-snug">{post.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {long && !expanded ? `${post.content.slice(0, 280).trimEnd()}… ` : post.content}
              {long && (
                <button onClick={() => setExpanded(x => !x)} className="text-indigo-600 dark:text-indigo-400 font-semibold text-xs ml-1">
                  {expanded ? 'Show less' : 'See more'}
                </button>
              )}
            </p>
          </>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.map((t, i) => (
              <span key={i} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/50">
                #{t.replace(/\s+/g, '')}
              </span>
            ))}
          </div>
        )}
      </div>

      {post.imageUrl && (
        <div className="bg-slate-100 dark:bg-slate-950">
          <img src={post.imageUrl} alt="" loading="lazy" className="w-full max-h-[480px] object-contain" />
        </div>
      )}

      {/* Counts */}
      <div className="px-4 py-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-600 to-violet-500 text-white flex items-center justify-center">
            <ThumbsUp className="w-3 h-3" />
          </span>
          <motion.span key={likes} initial={{ y: -4, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            {likes} {likes === 1 ? 'like' : 'likes'}
          </motion.span>
        </div>
        <button onClick={() => setOpen(o => !o)} className="hover:underline">
          {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
        </button>
      </div>

      {/* Actions */}
      <div className="mx-2 border-t border-slate-100 dark:border-slate-800 py-1 grid grid-cols-3 gap-1">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleLike}
          aria-pressed={liked}
          className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
            liked ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          <motion.span animate={liked ? { scale: [1, 1.35, 1], rotate: [0, -12, 0] } : { scale: 1 }} transition={{ duration: 0.35 }}>
            <ThumbsUp className={`w-4 h-4 ${liked ? 'fill-indigo-600/90 dark:fill-indigo-400/90' : ''}`} />
          </motion.span>
          {liked ? 'Liked' : 'Like'}
        </motion.button>
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${open ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}
        >
          <MessageCircle className="w-4 h-4" />
          Comment
        </button>
        <button onClick={handleShare} className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>
      {!mine && post.authorUid && (
        <div className="flex justify-end -mt-1">
          <ReportButton targetType="user" targetId={post.authorUid} targetLabel={`${post.authorName}: ${post.title}`.slice(0, 200)} />
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <CommentThread post={post} api={api} currentUser={currentUser} requireAuth={requireAuth} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function CommentThread({
  post,
  api,
  currentUser,
  requireAuth
}: {
  post: CommunityPost;
  api: CommunityApi;
  currentUser: UserProfile;
  requireAuth: (post: CommunityPost) => boolean;
}) {
  const { comments, loading, addComment, deleteComment, toggleHelpful } = useComments(api, post);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);
  const isPostAuthor = api.isMine(post.authorUid);

  const topLevel = comments
    .filter(c => !c.parentId)
    .sort((a, b) => Number(b.isHelpful) - Number(a.isHelpful) || a.createdAt - b.createdAt);
  const repliesOf = (id: string) => comments.filter(c => c.parentId === id).sort((a, b) => a.createdAt - b.createdAt);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (!requireAuth(post)) return;
    addComment(text, replyTo?.id ?? null);
    setText('');
    setReplyTo(null);
  };

  const renderComment = (c: CommunityComment, depth: number) => {
    const mine = api.isMine(c.authorUid);
    return (
      <motion.div key={c.id} layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={depth ? 'ml-9' : ''}>
        <div className="flex items-start gap-2.5">
          {depth > 0 && <CornerDownRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 mt-2 -ml-5 shrink-0" />}
          <img src={c.authorAvatar || FALLBACK_AVATAR} alt={c.authorName} className="w-7 h-7 rounded-full object-cover mt-0.5 shrink-0" referrerPolicy="no-referrer" />
          <div className="flex-1 min-w-0">
            <div
              className={`px-3 py-2 rounded-2xl text-xs space-y-0.5 ${
                c.isHelpful
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300/70 dark:border-emerald-700/60'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 dark:text-white">{c.authorName}</span>
                {c.authorUid === post.authorUid && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">AUTHOR</span>}
                {c.isHelpful && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white flex items-center gap-0.5">
                    <Award className="w-2.5 h-2.5" /> HELPFUL
                  </span>
                )}
              </div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap break-words">{c.content}</p>
            </div>
            <div className="flex items-center gap-3 px-2 pt-1 text-[11px] font-semibold text-slate-400">
              <span>{timeAgo(c.createdAt)}</span>
              {depth === 0 && (
                <button
                  onClick={() => {
                    if (!requireAuth(post)) return;
                    setReplyTo(c);
                  }}
                  className="hover:text-indigo-600"
                >
                  Reply
                </button>
              )}
              {isPostAuthor && !mine && (
                <button onClick={() => toggleHelpful(c)} className={c.isHelpful ? 'text-emerald-600 dark:text-emerald-400' : 'hover:text-emerald-600'}>
                  {c.isHelpful ? '✓ Solved it' : 'Mark helpful'}
                </button>
              )}
              {mine && (
                <button
                  onClick={() => {
                    if (window.confirm('Delete this comment?')) deleteComment(c);
                  }}
                  className="hover:text-rose-600"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
        {depth === 0 && repliesOf(c.id).length > 0 && <div className="mt-2 space-y-2">{repliesOf(c.id).map(r => renderComment(r, 1))}</div>}
      </motion.div>
    );
  };

  return (
    <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 space-y-3">
      {loading ? (
        <div className="flex justify-center py-3">
          <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-indigo-500 animate-spin" />
        </div>
      ) : topLevel.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-2">No replies yet — be the first to help out.</p>
      ) : (
        <div className="space-y-3">{topLevel.map(c => renderComment(c, 0))}</div>
      )}

      <form onSubmit={submit} className="space-y-1.5">
        {replyTo && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-2">
            <span>
              Replying to <b className="text-slate-700 dark:text-slate-300">{replyTo.authorName}</b>
            </span>
            <button type="button" onClick={() => setReplyTo(null)} className="hover:text-rose-500 font-bold">
              Cancel
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <img src={currentUser.avatar || FALLBACK_AVATAR} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onFocus={() => {
              if (!api.signedIn) requireAuth(post);
            }}
            placeholder={replyTo ? `Reply to ${replyTo.authorName.split(' ')[0]}…` : 'Share a fix, reading or tip…'}
            className="flex-1 min-w-0 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="submit"
            disabled={!text.trim()}
            aria-label="Send comment"
            className="p-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 text-white disabled:opacity-40 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>
      </form>
    </div>
  );
}
