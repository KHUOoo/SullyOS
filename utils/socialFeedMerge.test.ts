import { describe, expect, it } from 'vitest';
import type { SocialComment, SocialPost } from '../types';
import { buildSocialCommentThreads, mergeSocialComments, prependUniqueSocialPosts, updateSocialPost } from './socialFeedMerge';

const post = (id: string, comments: SocialComment[] = []): SocialPost => ({
    id,
    authorName: 'author',
    authorAvatar: '',
    title: id,
    content: id,
    images: ['✨'],
    likes: 0,
    isCollected: false,
    isLiked: false,
    comments,
    timestamp: 1,
    tags: [],
    bgStyle: '',
});

const comment = (id: string, authorType: SocialComment['authorType'] = 'stranger'): SocialComment => ({
    id,
    authorName: id,
    authorAvatar: '',
    content: id,
    likes: 0,
    isCharacter: false,
    authorType,
});

describe('social feed race-safe merging', () => {
    it('keeps posts created while a refresh request was in flight', () => {
        const live = [post('user-post'), post('old')];
        expect(prependUniqueSocialPosts(live, [post('generated')]).map(item => item.id))
            .toEqual(['generated', 'user-post', 'old']);
    });

    it('updates a post from the latest feed instead of a stale request snapshot', () => {
        const userComment = comment('user-comment', 'user');
        const result = updateSocialPost([post('p', [userComment])], 'p', current => ({
            ...current,
            comments: mergeSocialComments(current.comments, [comment('ai-comment')]),
        }));
        expect(result.post?.comments.map(item => item.id)).toEqual(['user-comment', 'ai-comment']);
    });

    it('does not duplicate a retried comment result', () => {
        const existing = comment('same');
        expect(mergeSocialComments([existing], [existing])).toEqual([existing]);
    });

    it('keeps replies underneath the comment they answer', () => {
        const characterComment = comment('character-comment', 'character');
        const userReply = {
            ...comment('user-reply', 'user'),
            replyToCommentId: characterComment.id,
            replyToName: characterComment.authorName,
        };
        const characterReply = {
            ...comment('character-reply', 'character'),
            replyToCommentId: userReply.id,
            replyToName: userReply.authorName,
        };

        const threads = buildSocialCommentThreads([characterComment, userReply, characterReply]);
        expect(threads).toHaveLength(1);
        expect(threads[0].comment.id).toBe(characterComment.id);
        expect(threads[0].replies[0].comment.id).toBe(userReply.id);
        expect(threads[0].replies[0].replies[0].comment.id).toBe(characterReply.id);
    });
});
