// Reports (admin review) and community reviews for people, sellers, listings and videos.
//   reports/{targetType}_{targetId}_{uid}      admin-only read, one per reporter per target
//   userReviews/{targetType}_{targetId}_{uid}  public read, one per reviewer per target
// (The existing `reviews` collection holds marketplace purchase reviews, so community reviews use `userReviews`.)
import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where, limit } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

export type ReportTarget = 'user' | 'seller' | 'listing' | 'video' | 'post';

/** What may be reported. Repair content is never removed for being a repair method. */
export const REPORT_REASONS = [
  'Sexual or nude images / video',
  'Violence, assault or gore',
  'Hate, threats or harassment',
  'Scam, fraud or fake listing',
  'Spam',
  'Other',
];

export interface CommunityReview {
  id: string; targetType: ReportTarget; targetId: string; reviewerUid: string; reviewerName: string;
  rating: number; comment: string; createdAt: any;
}

const key = (t: ReportTarget, id: string, uid: string) => `${t}_${id}_${uid}`.replace(/\//g, '_').slice(0, 300);

export async function submitReport(args: { targetType: ReportTarget; targetId: string; targetLabel: string; reporterUid: string; reason: string; details: string }) {
  if (!isFirebaseConfigured) throw new Error('Reporting is not available right now.');
  await setDoc(doc(db, 'reports', key(args.targetType, args.targetId, args.reporterUid)), {
    targetType: args.targetType,
    targetId: args.targetId.slice(0, 200),
    targetLabel: args.targetLabel.slice(0, 200),
    reporterUid: args.reporterUid,
    reason: args.reason.slice(0, 100),
    details: args.details.trim().slice(0, 1000),
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

export async function submitReview(args: { targetType: ReportTarget; targetId: string; reviewerUid: string; reviewerName: string; rating: number; comment: string }) {
  if (!isFirebaseConfigured) throw new Error('Reviews are not available right now.');
  const rating = Math.max(1, Math.min(5, Math.round(args.rating)));
  await setDoc(doc(db, 'userReviews', key(args.targetType, args.targetId, args.reviewerUid)), {
    targetType: args.targetType,
    targetId: args.targetId.slice(0, 200),
    reviewerUid: args.reviewerUid,
    reviewerName: (args.reviewerName || 'Member').slice(0, 80),
    rating,
    comment: args.comment.trim().slice(0, 1000),
    createdAt: serverTimestamp(),
  });
}

export async function hasReported(targetType: ReportTarget, targetId: string, uid: string) {
  try { return (await getDoc(doc(db, 'reports', key(targetType, targetId, uid)))).exists(); } catch { return false; }
}

export function useCommunityReviews(targetType: ReportTarget, targetId: string | null | undefined) {
  const [list, setList] = useState<CommunityReview[]>([]);
  useEffect(() => {
    if (!isFirebaseConfigured || !targetId) return;
    const q = query(collection(db, 'userReviews'), where('targetType', '==', targetType), where('targetId', '==', targetId), limit(100));
    return onSnapshot(q, (snap) => setList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))), () => setList([]));
  }, [targetType, targetId]);
  return list;
}
