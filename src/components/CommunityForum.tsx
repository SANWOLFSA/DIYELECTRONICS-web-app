import type React from 'react';
import { useState } from 'react';
import {
  MessageSquare,
  ThumbsUp,
  MessageCircle,
  CheckCircle2,
  Filter,
  Search,
  Plus,
  X,
  Sparkles,
  Send,
  HelpCircle,
  Wrench,
  ShieldCheck,
} from 'lucide-react';
import { ForumPost, UserProfile, DeviceCategory } from '../types';

interface CommunityForumProps {
  posts: ForumPost[];
  currentUser: UserProfile;
  onAddPost: (post: ForumPost) => void;
  onAddReply: (postId: string, content: string) => void;
  onToggleLike: (postId: string) => void;
}

const CATEGORIES: DeviceCategory[] = [
  'Gaming Consoles',
  'Laptops & PCs',
  'Smartphones',
  'Audio & Headphones',
  'TVs & Monitors',
  'Power Supplies & Chargers',
  'Microcontrollers & IoT',
];

export default function CommunityForum({
  posts,
  currentUser,
  onAddPost,
  onAddReply,
  onToggleLike,
}: CommunityForumProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [activeReplyPostId, setActiveReplyPostId] = useState<string | null>(null);
  const [replyInputText, setReplyInputText] = useState('');

  // New Thread Form state
  const [title, setTitle] = useState('');
  const [deviceCategory, setDeviceCategory] = useState<DeviceCategory>('Gaming Consoles');
  const [deviceModel, setDeviceModel] = useState('');
  const [issueType, setIssueType] = useState('Power Delivery / No Boot');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('Repair, SMD, Diagnostics');

  const filteredPosts = posts.filter((p) => {
    if (selectedCategory !== 'All' && p.deviceCategory !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchModel = p.deviceModel?.toLowerCase().includes(q);
      const matchContent = p.content.toLowerCase().includes(q);
      const matchTags = p.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchModel && !matchContent && !matchTags) return false;
    }
    return true;
  });

  const handleCreateThread = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const newPost: ForumPost = {
      id: `post_${Date.now()}`,
      title,
      deviceCategory,
      deviceModel: deviceModel || 'Consumer Electronic Device',
      issueType,
      author: {
        name: currentUser.name,
        avatar: currentUser.avatar,
        role: currentUser.role as 'Technician' | 'Apprentice' | 'Master Engineer' | 'Company Rep',
        isVerifiedCompany: currentUser.isVerifiedTrader,
      },
      content,
      createdAt: 'Just now',
      upvotes: 1,
      repliesCount: 0,
      isSolved: false,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      replies: [],
    };

    onAddPost(newPost);
    setShowNewThreadModal(false);
    setTitle('');
    setContent('');
    setDeviceModel('');
  };

  const handleSendReply = (postId: string) => {
    if (!replyInputText.trim()) return;
    onAddReply(postId, replyInputText.trim());
    setReplyInputText('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Forum Banner Header */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-xs font-bold">
            <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
            <span>Peer-to-Peer Troubleshooting & Repair Forum</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
            Technician Workbench Discussions
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            Stuck on a tricky board repair? Ask diagnostic questions, share motherboard multimeter readings, review oscilloscope captures, and celebrate successful e-waste saves.
          </p>
        </div>

        <button
          onClick={() => setShowNewThreadModal(true)}
          className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Ask Question or Post Tip</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {['All', ...CATEGORIES.slice(0, 5)].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-amber-400 text-stone-950 shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search symptoms, IC numbers, tags..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Posts Feed */}
      <div className="space-y-4">
        {filteredPosts.map((post) => {
          const isReplying = activeReplyPostId === post.id;

          return (
            <div
              key={post.id}
              className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 shadow-xs hover:border-amber-400/60 transition-all space-y-4"
            >
              {/* Post Author Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={post.author.avatar}
                    alt={post.author.name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-amber-400"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                        {post.author.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-bold">
                        {post.author.role}
                      </span>
                      {post.author.isVerifiedCompany && (
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-500" title="Verified Trader" />
                      )}
                    </div>
                    <span className="text-[11px] text-stone-400 block font-mono">
                      {post.createdAt} • {post.deviceCategory}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {post.isSolved && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>SOLVED</span>
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs">
                    {post.issueType}
                  </span>
                </div>
              </div>

              {/* Title & Device */}
              <div>
                {post.deviceModel && (
                  <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold block mb-1">
                    Device: {post.deviceModel}
                  </span>
                )}
                <h3 className="text-lg font-black text-stone-900 dark:text-stone-100">
                  {post.title}
                </h3>
              </div>

              {/* Content Body */}
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed whitespace-pre-line">
                {post.content}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {post.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Action Buttons: Likes & Replies Toggle */}
              <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => onToggleLike(post.id)}
                    className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300 hover:text-amber-500 font-bold transition-colors"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>{post.upvotes} Helpful</span>
                  </button>

                  <button
                    onClick={() => setActiveReplyPostId(isReplying ? null : post.id)}
                    className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300 hover:text-amber-500 font-bold transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{post.replies.length} Replies</span>
                  </button>
                </div>

                <button
                  onClick={() => setActiveReplyPostId(post.id)}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-200 font-bold transition-colors"
                >
                  Reply to Thread
                </button>
              </div>

              {/* Thread Replies Section */}
              {isReplying && (
                <div className="pt-4 border-t border-stone-100 dark:border-stone-800 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
                    Technician Responses ({post.replies.length})
                  </h4>

                  <div className="space-y-3">
                    {post.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                          reply.isAcceptedAnswer
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60'
                            : 'bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img
                              src={reply.avatar}
                              alt={reply.author}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                            <span className="font-bold text-stone-900 dark:text-stone-100">
                              {reply.author}
                            </span>
                            <span className="text-[10px] text-stone-400">
                              ({reply.role})
                            </span>
                          </div>

                          {reply.isAcceptedAnswer && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500 text-white font-black text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Accepted Fix</span>
                            </span>
                          )}
                        </div>

                        <p className="text-stone-700 dark:text-stone-300 pl-7 leading-relaxed">
                          {reply.content}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Add Reply Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyInputText}
                      onChange={(e) => setReplyInputText(e.target.value)}
                      placeholder="Write your diagnostic solution or repair suggestion..."
                      className="flex-1 px-4 py-2.5 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button
                      onClick={() => handleSendReply(post.id)}
                      className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Post</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Thread Modal */}
      {showNewThreadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-xl max-h-[90vh] rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 sm:p-8 overflow-y-auto space-y-6 shadow-2xl">
            <button
              onClick={() => setShowNewThreadModal(false)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-400 text-stone-950 uppercase">
                Peer Troubleshooting
              </span>
              <h2 className="text-xl font-black text-stone-900 dark:text-stone-100 mt-1">
                Start a New Discussion Thread
              </h2>
            </div>

            <form onSubmit={handleCreateThread} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Device Category
                </label>
                <select
                  value={deviceCategory}
                  onChange={(e) => setDeviceCategory(e.target.value as DeviceCategory)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Specific Device Model
                </label>
                <input
                  type="text"
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                  placeholder="e.g. Sony PS5 CFI-1116A, Dell XPS 15 9500"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Thread Title / Symptom
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Blinking orange light on standby rail, diode mode 0.02V to ground"
                  required
                  className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Detailed Description & Multimeter Observations
                </label>
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="State what voltages you have checked, what equipment you have used (multimeter, thermal camera, bench supply), and where you are stuck..."
                  required
                  className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewThreadModal(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs transition-colors shadow-xs"
                >
                  Publish Thread
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
