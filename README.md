# CTR Competitive Bot — v2

## Included
- One lobby hub text channel. Lobby cards are posted there; the hub stays open.
- `!l` creates an 8-player FFA lobby; `!l costume` opens a custom lobby wizard.
- Custom region selection supports a broad country-flag list, platform (Any/PS5/PS4/PC), and mode (FFA/War/Duo).
- Player profile, teams, Duo requests, leaderboard, admin points/MMR controls.
- At 8 players, a scorekeeper volunteer button appears. If nobody volunteers within 5 minutes, the lobby closes.
- A private match text room is created for the 8 players and scorekeeper. Eight random CTR tracks are selected.
- Lorenzi table link is generated for the match.
- Scorekeeper enters each player's eight map scores with `!results @player 4 4 1 1 1 4 1 4`. When all 8 players are entered, points and MMR update.
- `!l end` ends the match; the match room is deleted after 5 minutes.

## Install
1. Install Node.js 20 or newer.
2. Extract this ZIP.
3. Rename `.env.example` to `.env`.
4. Paste your bot token into `DISCORD_TOKEN`.
5. Add the ID of your lobby hub channel to `LOBBY_HUB_CHANNEL_ID`.
6. Optional: add a category ID to `MATCH_CATEGORY_ID`.
7. In Discord Developer Portal → Bot, enable **Message Content Intent** and **Server Members Intent**.
8. Invite the bot with `bot` scope and permissions: View Channels, Send Messages, Read Message History, Manage Channels, Embed Links.
9. Open a terminal in this folder and run:
   - `npm install`
   - `npm start`

## Commands
### Lobby
- `!l`
- `!l costume`
- `!l end`

### Profile
- `!p`, `!p @player`, `!p help`
- `!set_ranked_name <name>`
- `!set_nat 2|3`
- `!set_flag <flag emoji>`
- `!set_consoles PS5|PS4|PC`
- `!set_languages Arabic|Spanish|English`
- `!set_voice_chat Discord|Party`
- `!set_time_zone <timezone>`
- `!_birthday <date/name>`
- `!set_track <name>`
- `!set_character <name>`
- `!set_arena <name>`
- `!set_color <name>`
- `!set_engine <name>`
- `!set_mmr <number>`

### Teams / Duo
- `!set_team @player1 @player2 @player3 @player4`
- `!unset_team`
- `!set_duo @player`
- `!divors`

### Results / stats
- `!results @player score1 score2 score3 score4 score5 score6 score7 score8`
- `!leaderboard`

### Admin
- `!setup hub #channel`
- `!setup category CATEGORY_ID`
- `!admin addpoints @player amount`
- `!admin removepoints @player amount`
- `!admin setpoints @player amount`
- `!admin setmmr @player amount`

## Notes
- This is a source-code bot package, not a hosted bot. It runs while the Node process is running; 24/7 uptime requires an always-on host or your own machine.
- Never share your `.env` file or bot token.
- Use `!help` for the command embed after inviting the bot.
