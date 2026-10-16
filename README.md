# Funtok Africa 

*Copy this NEW SUPER PROMPT V2 - with Chat Side + Fun Side:*

---

*PROMPT: FUNTOK - Dual App: FUN SIDE + CHAT SIDE - TikTok for Uganda*

Build React + Vite + Tailwind app *FUNTOK*. TikTok dark design #000 with pink #FE2C55. Mobile first.

*CORE CONCEPT: TWO SIDES IN ONE APP:*

App has top toggle like TikTok has Following/For You, but ours is:
*[FUN SIDE 🎥 | CHAT SIDE 💬]*
- Default landing = FUN SIDE
- Swipe left or tap top tab to go to CHAT SIDE
- Smooth slide animation between sides

*A. BUNNY INFRASTRUCTURE (DONE):*
Library ID 775931 Name funtokfun Frankfurt CDN http://vz-e91c29a7-705.b-cdn.net. All videos upload/play via Bunny Library 775931. ENV: VITE_BUNNY__.

*B. FIREBASE CHAT SIDE (DONE):*
Project ID funtok-chat App ID 1:1076702802472:web:6cdc7eb352070e4e28fb1d Site funtok-chat Region eur3. Config from ENV VITE_FIREBASE__. Firestore collections: funtok_chat, conversations {participants, lastMessage, lastAt}, messages subcollection {senderId, text, videoShareId (Bunny ID 775931), createdAt}. Realtime onSnapshot.

*C. SUPABASE USER/VIDEO BASE (DONE):*
Table funtok_chat + users, videos {bunnyVideoId from 775931, caption}, likes, follows.

*D. BUILD THE TWO SIDES:*

*1. FUN SIDE (Left Side / Main) - Route /* 
- Vertical swipe TikTok feed from Supabase + Bunny CDN.
- Each video full screen, auto play loop.
- Right action bar: ❤️ Like, 💬 Comment (bottom sheet), 🔗 Share, ✉️ Send to Chat (shares bunnyVideoId to Chat Side)
- Bottom overlay: @username, caption, music
- Bottom nav: Fun (active), + Upload button center, Chat icon with unread badge
- Top tabs inside Fun Side: For You | Following | Nearby (Kampala)

*2. CHAT SIDE (Right Side) - Route /chat*
- *Split layout:*
    - Left panel (30%): Conversation list: avatar, name, last message, time, unread dot. Top search. This uses funtok_chat collection.
    - Right panel (70%): Active chat - WhatsApp style bubbles. Header with user avatar + Video call button.
    - On mobile: List full screen → tap → opens chat full screen with back button
- *Features:*
    - Realtime typing...
    - Send text + Send video from Fun Side (shows video preview in bubble that plays via Bunny CDN http://vz-e91c29a7-705.b-cdn.net)
    - When user clicks Message on profile in Fun Side, switch to Chat Side and open conversation
    - Swipe right to go back to Fun Side

*3. UPLOAD - Route /upload*
Upload to Bunny Library 775931 → save bunnyVideoId to Supabase → appears in Fun Side feed.

*4. PROFILE - Route /profile/:id*
Shows both: Top = bio + Message button (goes to Chat Side) + Follow. Bottom tabs = Videos (Fun Side content) + Liked.

*E. NAVIGATION LOGIC:*
- State `activeSide` = 'fun' | 'chat'
- Header: Two big buttons: FUN | CHAT - active has pink underline
- Gesture: Swipe left on Fun Side → Chat Side. Swipe right on Chat Side → Fun Side.
- Unread messages badge on CHAT tab from funtok_chat

*F. PWA + PLAY STORE:*
Manifest name Funtok, http://com.funtok.app, Capacitor ready, build AAB.

*Build order: 1) Firebase + Bunny connection 2) Fun Side feed 3) Chat Side with funtok_chat realtime 4) Toggle animation between sides*

---

*This is.BUILD TRENDING ALGORITHM FOR FUN SIDE - FUNTOK

Supabase videos table add fields: likesCount int default 0, commentsCount int, sharesCount int, viewsCount int, watchTimeTotal int, savesCount int, trendingScore float default 0, isTrending bool default false, avgWatchPercent float, completionRate float, location text.

New table video_views: id uuid, videoId text (bunnyVideoId from Library 775931), userId text, watchDuration float, watchedPercent float, createdAt timestamp.

Create Supabase Edge Function calculateTrending that runs every 5 minutes via cron for videos where createdAt > now-48h.

Formula inside function:

hours = (now - createdAt)/3600

base = (viewsCount*0.5)+(likesCount*3)+(commentsCount*5)+(sharesCount*8)+(savesCount*6)+(avgWatchPercent*10)+(completionRate*15)

decay = base / Math.pow(hours, 1.5)

boost = location == 'Kampala' ? decay*1.3 : decay

trendingScore = boost

Update videos set trendingScore = boost, isTrending = trendingScore > 100

On frontend Fun Side:

For You Tab: const {data} = await supabase.from('videos').select('*').order('trendingScore', {ascending:false}).limit(20) + 20% new: mix with videos where createdAt > now-1h

Trending Tab NEW: Top bar tabs For You | Following | Trending 🔥 | Nearby. Trending page shows Top 50: .from('videos').order('trendingScore', {ascending:false}).limit(50) with rank badges #1 #2 #3 fire icon label "🔥 Trending in Kampala" show score.

Player events: Bunny player on https://vz-e91c29a7-705.b-cdn.net/{videoId}/playlist.m3u8 - on timeupdate calculate watchedPercent insert into video_views increment viewsCount watchTimeTotal avgWatchPercent.

On like comment share: increment respective count in videos + instant recalc trendingScore for that video only.

Table trending_config: id, trendingEnabled bool, boostHashtags text[].

UI: Trending tab vertical swipe, rank badge, Trending Score: 9.8k display.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://funtok-africa.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/08cec620-36b7-4b26-bb0b-8d94174e40c4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
