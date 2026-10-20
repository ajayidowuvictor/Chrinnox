# Chrinnox: product audit and roadmap

## 1. Audit of the app as it stands (October 2026)

**Works today:** sign up/login, text and multi-photo posts, likes, replies, reposts, saved posts,
follow/unfollow, profiles, notifications (follow, like, reply, repost) with unread badge,
direct messages (text, photos, shared posts), people search, share links, rate limiting.

**Too similar to Twitter/X:** one feed, no controls over it, likes as the only quality signal,
no topics, no way to find opportunities, no communities, no privacy controls, a left rail that
wastes space on phones.

**Why people would leave:** no way to mute or block anyone, no control over who messages or
replies to them, feeds that only grow (no pagination), nothing to find or follow except people.

**Why they would return daily:** things that give value beyond scrolling: topics they care about,
useful answers rising to the top, opportunities, communities.

## 2. Identity

Chrinnox is the social platform where **you** control the experience and **useful** beats **loud**.
Pillars: control, usefulness, community, opportunity, privacy.

## 3. Differentiators (must be visible in the product)

1. **You control your feed**: feed modes (For You, Following, Latest, Discussions, Topics),
   muted words, muted/blocked accounts.
2. **Helpful signal**: a separate "Helpful" mark, distinct from likes, that lifts useful posts and replies.
3. **Topics you follow**: hashtags become real topic feeds with trending topics.
4. **Privacy as a feature**: choose who can message you and who can reply to you, enforced on the server.
5. **Opportunities**: jobs, collaborations, events, scholarships discoverable in one place.
6. **Communities**: small spaces with their own rules, moderators and feed.

## 4. Tiers

**Tier 1 (must have)** - DONE or in progress
- Mobile bottom navigation, phone-first layout
- Mute, block, muted words; privacy settings; settings page
- Pagination and infinite scroll
- Feed modes; topics and trending; Helpful signal and reply sorting

**Tier 2 (high-value differentiators)** - next
- Bookmark collections
- Post types (Question, Opportunity, Announcement) and an Opportunities board
- Communities (feed, rules, moderators, join/request)
- Light/dark/system theme (needs a design pass over all colours)
- Edit posts; delete own replies; reports + admin moderation dashboard
- Email verification and password reset (needs an email service)

**Tier 3 (advanced)**
- Creator studio with real analytics from stored data
- Events with RSVP; advanced search filters; threads and drafts; scheduled posts
- Group chats, message reactions, typing indicators (needs WebSockets)
- AI features: thread summaries, translation, alt text (needs an AI service key)

**Tier 4 (future architecture, needs outside services)**
- Payments: tips, subscriptions, paid content (a payment provider such as Paystack/Flutterwave)
- Live audio/video rooms (a real-time media service)
- Video uploads and transcoding; phone verification (SMS provider)

## 5. Rules we follow
No fake analytics or fake features. Permissions enforced on the server. Secrets only in environment
variables. Existing features are kept working. Each feature is built, tested, then the next one.
