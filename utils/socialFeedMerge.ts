import type { SocialComment, SocialPost } from '../types';

export interface SocialCommentThread {
    comment: SocialComment;
    replies: SocialCommentThread[];
}

/**
 * Prepend a generated batch without replacing anything that arrived while the
 * request was in flight. IDs are unique in normal use; the guard also makes a
 * retried response idempotent.
 */
export function prependUniqueSocialPosts(current: SocialPost[], incoming: SocialPost[]): SocialPost[] {
    const existingIds = new Set(current.map(post => post.id));
    const fresh = incoming.filter(post => !existingIds.has(post.id));
    return fresh.length > 0 ? [...fresh, ...current] : current;
}

/** Replace one post using the latest version currently in the feed. */
export function updateSocialPost(
    current: SocialPost[],
    postId: string,
    updater: (post: SocialPost) => SocialPost,
): { feed: SocialPost[]; post?: SocialPost } {
    let updated: SocialPost | undefined;
    const feed = current.map(post => {
        if (post.id !== postId) return post;
        updated = updater(post);
        return updated;
    });
    return { feed: updated ? feed : current, post: updated };
}

/**
 * AI comments can finish after the user has already left a comment. Keep the
 * live comments and append only genuinely new generated entries.
 */
export function mergeSocialComments(current: SocialComment[], incoming: SocialComment[]): SocialComment[] {
    const existingIds = new Set(current.map(comment => comment.id));
    const fresh = incoming.filter(comment => !existingIds.has(comment.id));
    return fresh.length > 0 ? [...current, ...fresh] : current;
}

/** Keep reply chains visually attached to the comment they answer. */
export function buildSocialCommentThreads(comments: SocialComment[]): SocialCommentThread[] {
    const nodes = new Map<string, SocialCommentThread>();
    comments.forEach(comment => nodes.set(comment.id, { comment, replies: [] }));

    const roots: SocialCommentThread[] = [];
    comments.forEach(comment => {
        const node = nodes.get(comment.id)!;
        const parent = comment.replyToCommentId && comment.replyToCommentId !== comment.id
            ? nodes.get(comment.replyToCommentId)
            : undefined;
        if (parent) parent.replies.push(node);
        else roots.push(node);
    });
    return roots;
}
