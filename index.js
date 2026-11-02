require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const {
  Client, GatewayIntentBits, Partials, PermissionsBitField, ChannelType,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error("Missing DISCORD_TOKEN.");
  process.exit(1);
}

const PREFIX = "!";
const DATA_FILE = path.join(__dirname, "data.json");
const HUB_ID = process.env.LOBBY_HUB_CHANNEL_ID || "";
const CATEGORY_ID = process.env.MATCH_CATEGORY_ID || "";
const ADMIN_IDS = (process.env.BOT_ADMINS || "").split(",").map(x => x.trim()).filter(Boolean);

const TRACKS = [
  "Crash Cove","Mystery Caves","Sewer Speedway","Roo's Tubes","Slide Coliseum",
  "Turbo Track","Coco Park","Tiger Temple","Papu's Pyramid","Dingo Canyon",
  "Polar Pass","Tiny Arena","Dragon Mines","Blizzard Bluff","Hot Air Skyway",
  "Cortex Castle","N. Gin Labs","Oxide Station","Inferno Island","Jungle Boogie",
  "Clockwork Wumpa","Android Alley","Electron Avenue","Deep Sea Driving",
  "Thunder Struck","Tiny Temple","Meteor Gorge","Barin Ruins","Out of Time",
  "Assembly Lane","Hyper Spaceway","Retro Stadium","Twilight Tour",
  "Prehistoric Playground","Spyro Circuit","Nina's Nightmare","Koala Carnival",
  "Gingerbread Joyride","Megamix Mania","Drive-Thru Danger"
];

const FLAGS = [
  "🇸🇦","🇾🇪","🇿🇲","🇿🇼","🇻🇳","🇻🇪","🇺🇸","🇬🇧","🇮🇳","🇮🇩","🇵🇰",
  "🇪🇸","🇫🇷","🇩🇪","🇮🇹","🇯🇵","🇰🇷","🇹🇷","🇦🇪","🇶🇦","🇴🇲","🇰🇼",
  "🇧🇭","🇪🇬","🇲🇦","🇹🇳","🇸🇾","🇮🇶","🇱🇧","🇯🇴","🇵🇸","🇨🇦","🇦🇺",
  "🇧🇷","🇲🇽","🇳🇱","🇧🇪","🇵🇹","🇦🇷","🇨🇱","🇨🇴","🇵🇭","🇹🇭","🇲🇾",
  "🇸🇬","🇳🇿","🇿🇦","🇳🇬","🇰🇪","🇸🇪","🇳🇴","🇩🇰","🇫🇮","🇵🇱","🇨🇿",
  "🇬🇷","🇺🇦","🇷🇺","🇨🇳","🇹🇼","🇭🇰"
];

const FLAG_CODES = {
  sa:"🇸🇦",ye:"🇾🇪",zm:"🇿🇲",zw:"🇿🇼",vn:"🇻🇳",ve:"🇻🇪",
  us:"🇺🇸",gb:"🇬🇧",in:"🇮🇳",id:"🇮🇩",pk:"🇵🇰",es:"🇪🇸",
  fr:"🇫🇷",de:"🇩🇪",it:"🇮🇹",jp:"🇯🇵",kr:"🇰🇷",tr:"🇹🇷",
  ae:"🇦🇪",qa:"🇶🇦",om:"🇴🇲",kw:"🇰🇼",bh:"🇧🇭",eg:"🇪🇬",
  ma:"🇲🇦",tn:"🇹🇳",sy:"🇸🇾",iq:"🇮🇶",lb:"🇱🇧",jo:"🇯🇴",
  ps:"🇵🇸",ca:"🇨🇦",au:"🇦🇺",br:"🇧🇷",mx:"🇲🇽",nl:"🇳🇱",
  be:"🇧🇪",pt:"🇵🇹",ar:"🇦🇷",cl:"🇨🇱",co:"🇨🇴",ph:"🇵🇭",
  th:"🇹🇭",my:"🇲🇾",sg:"🇸🇬",nz:"🇳🇿",za:"🇿🇦",ng:"🇳🇬",
  ke:"🇰🇪",se:"🇸🇪",no:"🇳🇴",dk:"🇩🇰",fi:"🇫🇮",pl:"🇵🇱",
  cz:"🇨🇿",gr:"🇬🇷",ua:"🇺🇦",ru:"🇷🇺",cn:"🇨🇳",tw:"🇹🇼",hk:"🇭🇰"
};

const LANGS = ["Arabic", "Spanish", "English"];
const CONTINENTS = ["Asia","Europe","Africa","North America","South America","Oceania"];
const MODES = ["FFA","Duo","War","1v1"];

const DEFAULT = {
  profiles:{}, lobbies:{}, teams:{}, duos:{}, pending:{},
  settings:{hubId:HUB_ID,categoryId:CATEGORY_ID}, processed:[]
};

function load() {
  try {
    const old = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    const data = {...structuredClone(DEFAULT), ...old};

    data.profiles ||= {};
    data.lobbies ||= {};
    data.teams ||= {};
    data.duos ||= {};
    data.pending ||= {};
    data.settings ||= {hubId:HUB_ID,categoryId:CATEGORY_ID};
    data.processed ||= [];

    for (const p of Object.values(data.profiles)) {
      p.points ??= 0;
      p.ffaMmr ??= 1200;
      p.teamMmr ??= 1200;
      p.wins ??= 0;
      p.losses ??= 0;
      p.matches ??= 0;
      p.rankedName ??= "";
      p.nat ??= "";
      p.flag ??= "";
      p.platform ??= "";
      p.continent ??= "";
      p.language ??= "English";
      p.voiceChat ??= "Discord";
      p.timezone ??= "";
      p.birthday ??= "";
      p.track ??= "";
      p.character ??= "";
      p.arena ??= "";
      p.color ??= "";
      p.engine ??= "";
      p.lastBirthdayWish ??= "";
    }
    return data;
  } catch {
    return structuredClone(DEFAULT);
  }
}

let db = load();
function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function profile(id) {
  return db.profiles[id] ||= {
    points:0, ffaMmr:1200, teamMmr:1200, wins:0, losses:0, matches:0,
    rankedName:"", nat:"", flag:"", platform:"", continent:"",
    language:"English", voiceChat:"Discord", timezone:"",
    birthday:"", track:"", character:"", arena:"", color:"", engine:"",
    lastBirthdayWish:""
  };
}

function isAdmin(m) {
  return !!m && (
    m.permissions?.has(PermissionsBitField.Flags.Administrator) ||
    ADMIN_IDS.includes(m.id)
  );
}

function mentions(ids) {
  return ids.map(x => `<@${x}>`).join(" ");
}

function parseMentions(m) {
  return [...m.mentions.users.keys()];
}

function safe(s) {
  return String(s || "").replace(/[^a-zA-Z0-9-]/g,"-").replace(/-+/g,"-").slice(0,70) || "match";
}

function makeButton(id,label,style,emoji) {
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  if (emoji) b.setEmoji(emoji);
  return b;
}

function profileComplete(p) {
  return !!(p.rankedName && p.nat && p.flag && p.continent && p.language && p.timezone);
}

function ratingForMode(p, mode) {
  return mode === "FFA" ? p.ffaMmr : p.teamMmr;
}

function lobbyCapacity(l) {
  return l.mode === "1v1" ? 2 : 8;
}

function playerMeetsFilters(p, config, mode) {
  if (!profileComplete(p)) return "Complete your profile first. Use `!p help`.";

  if (config.continents?.length && !config.continents.includes(p.continent)) {
    return "Your continent is not allowed in this lobby.";
  }

  if (mode !== "1v1" && config.minMmr != null) {
    const mmr = ratingForMode(p, mode);
    if (mmr < config.minMmr || mmr > config.maxMmr) {
      return `Your MMR must be between ${config.minMmr} and ${config.maxMmr}.`;
    }
  }
  return null;
}

function lobbyEmbed(l) {
  const capacity = lobbyCapacity(l);
  const players = l.players.length
    ? l.players.map((id,i) => {
        const p = profile(id);
        return `${i+1}. <@${id}> · ${ratingForMode(p,l.mode)} MMR`;
      }).join("\n")
    : "Waiting for players...";

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`CTR ${l.mode} Lobby #${l.id}`)
    .setDescription([
      `**Host:** <@${l.hostId}>`,
      `**Mode:** ${l.mode}`,
      `**Continents:** ${l.continents?.length ? l.continents.join(", ") : "All"}`,
      `**MMR range:** ${l.minMmr == null ? "Unlocked" : `${l.minMmr}–${l.maxMmr}`}`,
      `**Players (${l.players.length}/${capacity}):**`,
      players
    ].join("\n"))
    .setFooter({text:"Join or leave using the buttons below"});
}

function lobbyRows(l) {
  return [new ActionRowBuilder().addComponents(
    makeButton(`join:${l.id}`,"Join",ButtonStyle.Success,"✅"),
    makeButton(`leave:${l.id}`,"Leave",ButtonStyle.Secondary,"↩️"),
    makeButton(`delete:${l.id}`,"Delete",ButtonStyle.Danger,"🗑️")
  )];
}

async function hub(guild) {
  const id = db.settings.hubId || HUB_ID;
  return id ? guild.channels.fetch(id).catch(() => null) : null;
}

async function refreshLobby(guild,l) {
  const ch = await guild.channels.fetch(l.hubId).catch(() => null);
  if (!ch) return;
  const msg = await ch.messages.fetch(l.messageId).catch(() => null);
  if (msg) await msg.edit({
    embeds:[lobbyEmbed(l)],
    components:l.status === "open" ? lobbyRows(l) : []
  }).catch(() => {});
}

async function createLobby(guild,host,opts={}) {
  if (Object.values(db.lobbies).filter(x => x.status === "open").length >= 20) {
    throw Error("Maximum 20 open lobbies.");
  }

  const mode = opts.mode || "FFA";
  const config = {
    continents:opts.continents || [],
    minMmr:opts.minMmr ?? null,
    maxMmr:opts.maxMmr ?? null
  };

  const reason = playerMeetsFilters(profile(host.id),config,mode);
  if (reason) throw Error(`You do not qualify to create this lobby: ${reason}`);

  if (Object.values(db.lobbies).some(x =>
    x.status === "open" && x.players.includes(host.id)
  )) throw Error("You are already in another open lobby.");

  const channel = await hub(guild);
  if (!channel) throw Error("Set LOBBY_HUB_CHANNEL_ID in .env first.");

  const id = String(Date.now()).slice(-6) + Math.floor(Math.random()*90+10);
  const l = {
    id,hostId:host.id,guildId:guild.id,hubId:channel.id,messageId:null,
    players:[host.id],status:"open",mode,
    continents:config.continents,minMmr:config.minMmr,maxMmr:config.maxMmr,
    createdAt:Date.now(),matchChannelId:null,scorekeeperId:null,
    scores:{},resultsApplied:false
  };

  db.lobbies[id] = l;
  const msg = await channel.send({
    content:`<@${host.id}> opened a CTR lobby.`,
    embeds:[lobbyEmbed(l)],
    components:lobbyRows(l)
  });

  l.messageId = msg.id;
  save();
  return l;
}

async function closeLobby(l,guild,deleteMatch=false) {
  l.status = "closed";
  save();

  if (l.readyMessageId) {
    const h = await guild.channels.fetch(l.hubId).catch(() => null);
    const ready = h ? await h.messages.fetch(l.readyMessageId).catch(() => null) : null;
    if (ready) await ready.delete().catch(() => {});
  }

  if (deleteMatch && l.matchChannelId) {
    const ch = await guild.channels.fetch(l.matchChannelId).catch(() => null);
    if (ch) await ch.delete("CTR match finished").catch(() => {});
  }

  await refreshLobby(guild,l);
}

async function addPlayer(l,user,guild) {
  if (l.status !== "open") return "This lobby is no longer open.";
  if (l.players.includes(user.id)) return "You are already in this lobby.";
  if (l.players.length >= lobbyCapacity(l)) return "This lobby is full.";

  if (Object.values(db.lobbies).some(x =>
    x.status === "open" && x.id !== l.id && x.players.includes(user.id)
  )) return "You can only join one open lobby at a time.";

  const reason = playerMeetsFilters(profile(user.id),l,l.mode);
  if (reason) return reason;

  l.players.push(user.id);
  save();
  await refreshLobby(guild,l);

  if (l.players.length === lobbyCapacity(l)) {
    await readyCheck(l,guild);
  }
  return null;
}

async function readyCheck(l,guild) {
  if (l.readyMessageId) return;

  const ch = await hub(guild);
  if (!ch) return;

  const row = new ActionRowBuilder().addComponents(
    makeButton(`volunteer:${l.id}`,"Volunteer as scorekeeper",ButtonStyle.Primary,"📝")
  );

  const msg = await ch.send({
    content:`${mentions(l.players)}\n**${l.players.length}/${lobbyCapacity(l)} players — match ready!**\nA player must volunteer to record the results within 5 minutes.`,
    components:[row]
  });

  l.readyMessageId = msg.id;
  l.readyAt = Date.now();
  save();

  setTimeout(async () => {
    const cur = db.lobbies[l.id];
    if (cur && cur.status === "open" &&
        cur.readyAt === l.readyAt && !cur.scorekeeperId) {
      await ch.send(`Lobby #${l.id} closed: no scorekeeper volunteered within 5 minutes.`).catch(() => {});
      await closeLobby(cur,guild,false);
    }
  },300000);
}

async function startMatch(l,guild,scorekeeperId) {
  if (l.status !== "open" || l.players.length !== lobbyCapacity(l)) {
    throw Error("This lobby is not ready.");
  }

  l.status = "started";
  l.scorekeeperId = scorekeeperId;
  l.startedAt = Date.now();

  const everyone = guild.roles.everyone.id;
  const botMember = guild.members.me || await guild.members.fetchMe();

  const room = await guild.channels.create({
    name:`ctr-match-${safe(l.id)}`,
    type:ChannelType.GuildText,
    parent:db.settings.categoryId || CATEGORY_ID || undefined,
    permissionOverwrites:[
      {id:everyone,deny:[PermissionsBitField.Flags.ViewChannel]},
      {id:botMember.id,allow:[
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels
      ]},
      ...l.players.map(id => ({
        id,
        allow:[
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      }))
    ]
  });

  l.matchChannelId = room.id;
  save();

  const mapCount = l.mode === "1v1" ? 5 : 8;
  const maps = [...TRACKS].sort(() => Math.random()-.5).slice(0, mapCount);

  const rows = l.players.map(id => {
    const p = profile(id);
    return `${mentions([id])} | ${ratingForMode(p,l.mode)} MMR`;
  }).join("\n");

  const tableData = l.players.map(id => {
    const p = profile(id);
    const zeroScores = Array(mapCount).fill("0").join("|");
    return `${p.rankedName || "Player"} [${p.flag || "??"}] ${zeroScores}`;
  }).join("\n");

  const url = "https://gb.hlorenzi.com/table?data=" + encodeURIComponent(tableData);

  await room.send({
    content:[
      `# CTR ${l.mode} MATCH START`,
      mentions(l.players),
      "",
      "**Players**",
      rows,
      "",
      `**${mapCount} Random Maps**`,
      maps.map((x,i) => `${i+1}. ${x}`).join("\n"),
      "",
      `**Scorekeeper:** <@${scorekeeperId}>`,
      `**Lorenzi table:** ${url}`,
      "",
      `Scorekeeper: enter \`!results @player ${Array(mapCount).fill("4").join(" ")}\` for each player.`,
      "Use `!l end` when finished."
    ].join("\n")
  });

  const h = await guild.channels.fetch(l.hubId).catch(() => null);
  if (h) await h.send(`Match #${l.id} has started in <#${room.id}>.`);
}

function updateMMR(players,mode) {
  const n = players.length;
  if (n < 2) return [];

  return players.map((p,i) => {
    const actual = players.reduce((s,q,j) => {
      if (i === j) return s;
      return s + (p.total > q.total ? 1 : p.total === q.total ? 0.5 : 0);
    },0)/(n-1);

    const pMmr = ratingForMode(profile(p.id),mode);
    const expected = players.reduce((s,q,j) => {
      if (i === j) return s;
      const qMmr = ratingForMode(profile(q.id),mode);
      return s + 1/(1+10**((qMmr-pMmr)/400));
    },0)/(n-1);

    return Math.round(32*(actual-expected));
  });
}

function help() {
  return new EmbedBuilder()
    .setTitle("CTR Bot Commands")
    .setColor(0x5865F2)
    .setDescription([
      "**Lobby**",
      "`!l` — Create a standard lobby",
      "`!l custom` — Create a custom lobby",
      "`!l end` — End the match/lobby",
      "",
      "**Lobby types**",
      "FFA · Duo · War · 1v1",
      "FFA / Duo / War: 8 players (8 Maps)",
      "1v1: 2 players (5 Maps)",
      "",
      "**Profile**",
      "`!p` / `!p @player` — Show profile",
      "`!p help` — Profile setup help",
      "`!set_ranked_name <name>`",
      "`!set_nat 2|3`",
      "`!set_flag sa`",
      "`!set_continent Asia`",
      "`!set_languages Arabic|Spanish|English`",
      "`!set_voice_chat Discord|Party`",
      "`!set_time_zone Asia/Riyadh`",
      "`!set_birthday <date>` (e.g. 23/12/2000)",
      "`!set_track <name>`",
      "`!set_character <name>`",
      "`!set_arena <name>`",
      "`!set_color <name>`",
      "`!set_engine <name>`",
      "",
      "**Teams & Duo**",
      "`!set_team @a @b @c @d`",
      "`!unset_team`",
      "`!set_duo @player`",
      "`!divors` / `!divorce`",
      "",
      "**Stats**",
      "`!rank_stats`",
      "`!leaderboard`",
      "`!points`",
      "`!results`",
      "",
      "**Admin & Permissions**",
      "`!allow chat @member` — Allow member to chat in channel",
      "`!setup hub #channel`",
      "`!setup category CATEGORY_ID`",
      "`!admin addpoints @player 10`",
      "`!admin removepoints @player 10`",
      "`!admin setpoints @player 100`",
      "`!admin setmmr @player 1200`"
    ].join("\n"));
}

function parseResultNums(args) {
  return args.map(Number).filter(n => Number.isFinite(n) && n >= 0);
}

function continentMenu(owner) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`custom_continent:${owner}`)
      .setPlaceholder("Choose allowed continents")
      .setMinValues(1)
      .setMaxValues(CONTINENTS.length)
      .addOptions(CONTINENTS.map(x => ({label:x,value:x})))
  );
}

function modeMenu(owner) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`custom_mode:${owner}`)
      .setPlaceholder("Choose match type")
      .addOptions(MODES.map(x => ({label:x,value:x})))
  );
}

function standardModeMenu(owner) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`standard_mode:${owner}`)
      .setPlaceholder("Choose lobby type")
      .addOptions(MODES.map(x => ({label:x,value:x})))
  );
}

function mmrModal(owner) {
  const modal = new ModalBuilder()
    .setCustomId(`custom_mmr:${owner}`)
    .setTitle("Custom lobby MMR range");

  const min = new TextInputBuilder()
    .setCustomId("min")
    .setLabel("Minimum MMR")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("1200");

  const max = new TextInputBuilder()
    .setCustomId("max")
    .setLabel("Maximum MMR")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("2000");

  modal.addComponents(
    new ActionRowBuilder().addComponents(min),
    new ActionRowBuilder().addComponents(max)
  );
  return modal;
}

const client = new Client({
  intents:[
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials:[Partials.Channel]
});

// دالة فحص أعياد الميلاد (تطابق اليوم والشهر بغض النظر عن السنة مثل 23/12/2000)
async function checkBirthdays() {
  const now = new Date();
  const todayDay = String(now.getDate()).padStart(2, '0');
  const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentYearStr = String(now.getFullYear());

  for (const [userId, p] of Object.entries(db.profiles)) {
    if (!p.birthday) continue;
    
    // تنظيف المدخل واستخراج اليوم والشهر بغض النظر عن الصيغة (سواء 23/12 أو 23/12/2000)
    const parts = p.birthday.trim().split(/[\/\-\.]/);
    if (parts.length >= 2) {
      const bDay = parts[0].padStart(2, '0');
      const bMonth = parts[1].padStart(2, '0');

      if (bDay === todayDay && bMonth === todayMonth) {
        if (p.lastBirthdayWish === currentYearStr) continue; // تم إرسال التهنئة مسبقاً في هذه السنة

        for (const [guildId, guild] of client.guilds.cache) {
          let targetChannel = null;
          if (db.settings.hubId) {
            targetChannel = await guild.channels.fetch(db.settings.hubId).catch(() => null);
          }
          if (!targetChannel) {
            targetChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me)?.has(PermissionsBitField.Flags.SendMessages));
          }

          if (targetChannel) {
            await targetChannel.send(`🎉 Happy Birthday 🎂 <@${userId}>! أتمنى لك سنة مليئة بالسعادة والإنجازات في السباقات! 🏎️✨`).catch(() => {});
            p.lastBirthdayWish = currentYearStr;
            save();
          }
        }
      }
    }
  }
}

client.once("ready", () => {
  console.log(`Online as ${client.user.tag}`);
  checkBirthdays();
  setInterval(checkBirthdays, 3600000); // فحص كل ساعة
});

client.on("messageCreate",async m => {
  if (m.author.bot || !m.guild) return;

  const content = m.content.trim();
  if (!content.startsWith(PREFIX)) return;

  const parts = content.slice(1).split(/\s+/);
  const cmd = (parts.shift() || "").toLowerCase();
  const args = parts;

  try {
    const p = profile(m.author.id);

    if (cmd === "help" || cmd === "commands") {
      return m.reply({embeds:[help()]});
    }

    if (cmd === "allow") {
      if (!isAdmin(m.member)) return m.reply("Admin only.");
      const target = m.mentions.members.first();
      if (!target) return m.reply("Use `!allow chat @member`.");

      await m.channel.permissionOverwrites.edit(target.id, {
        SendMessages: true,
        ViewChannel: true
      });
      return m.reply(`Allowed ${target} to chat in this channel.`);
    }

    if (cmd === "setup") {
      if (!isAdmin(m.member)) return m.reply("Admin only.");

      if (args[0] === "hub") {
        const ch = m.mentions.channels.first();
        if (!ch) return m.reply("Use `!setup hub #channel`.");
        db.settings.hubId = ch.id;
        save();
        return m.reply(`Lobby hub set to ${ch}.`);
      }

      if (args[0] === "category") {
        if (!args[1]) return m.reply("Use `!setup category CATEGORY_ID`.");
        db.settings.categoryId = args[1];
        save();
        return m.reply("Match room category saved.");
      }
    }

    if (cmd === "l") {
      if (args[0] === "end") {
        const l = Object.values(db.lobbies).find(x =>
          x.status !== "closed" &&
          (x.matchChannelId === m.channel.id ||
          (x.hubId === m.channel.id && x.hostId === m.author.id))
        );

        if (!l) return m.reply("No active match/lobby found for this channel.");

        if (l.scorekeeperId !== m.author.id &&
            !isAdmin(m.member) && l.hostId !== m.author.id) {
          return m.reply("Only the scorekeeper, lobby host, or admin can end this.");
        }

        await m.reply("Match ended. This match room will be deleted in 5 minutes.");
        l.status = "closed";
        save();

        const room = await m.guild.channels.fetch(l.matchChannelId || "").catch(() => null);
        if (room) setTimeout(() => room.delete("Match cleanup").catch(() => {}),300000);

        return refreshLobby(m.guild,l);
      }

      if (args[0] === "custom") {
        const reason = playerMeetsFilters(p,{continents:[]}, "FFA");
        if (reason) return m.reply(reason);

        db.pending[m.author.id] = {
          type:"customLobby",
          step:"mode",
          config:{mode:null,continents:[],minMmr:null,maxMmr:null},
          createdAt:Date.now()
        };
        save();

        return m.reply({
          content:"Custom lobby setup — choose the match type.",
          components:[modeMenu(m.author.id)]
        });
      }

      if (!profileComplete(p)) return m.reply("Complete your profile first using `!p help`.");

      return m.reply({
        content:"Choose your lobby type:",
        components:[standardModeMenu(m.author.id)]
      });
    }

    if (cmd === "p") {
      if (args[0] === "help") {
        return m.reply({
          embeds:[new EmbedBuilder()
            .setTitle("Complete your profile")
            .setColor(0x5865F2)
            .setDescription([
              "**Required fields**",
              "`!set_ranked_name <name>`",
              "`!set_nat 2|3`",
              "`!set_flag sa`",
              "`!set_continent Asia`",
              "`!set_languages Arabic|Spanish|English`",
              "`!set_time_zone Asia/Riyadh`",
              "",
              "Other profile fields are optional.",
              "Available continents: Asia, Europe, Africa, North America, South America, Oceania."
            ].join("\n"))]
        });
      }

      const target = m.mentions.users.first() || m.author;
      const q = profile(target.id);

      let embedColor = 0x5865F2;
      if (q.color) {
        const lowerColor = q.color.toLowerCase();
        if (lowerColor === "red") embedColor = 0xFF0000;
        else if (lowerColor === "green") embedColor = 0x00FF00;
        else if (lowerColor === "blue") embedColor = 0x0000FF;
        else if (lowerColor === "gold" || lowerColor === "yellow") embedColor = 0xFFD700;
        else if (lowerColor === "purple") embedColor = 0x800080;
        else if (lowerColor === "pink") embedColor = 0xFFC0CB;
        else if (lowerColor === "orange") embedColor = 0xFFA500;
      }

      return m.reply({
        embeds:[new EmbedBuilder()
          .setTitle(`${target.username}'s CTR Profile`)
          .setThumbnail(target.displayAvatarURL())
          .setColor(embedColor)
          .setDescription([
            `**Ranked name:** ${q.rankedName || "—"}`,
            `**Points:** ${q.points}`,
            `**FFA MMR:** ${q.ffaMmr}`,
            `**Duo / War MMR:** ${q.teamMmr}`,
            `**Wins/Losses:** ${q.wins}/${q.losses}`,
            `**NAT:** ${q.nat || "—"}`,
            `**Flag:** ${q.flag || "—"}`,
            `**Continent:** ${q.continent || "—"}`,
            `**Language:** ${q.language}`,
            `**Voice:** ${q.voiceChat}`,
            `**Timezone:** ${q.timezone || "—"}`,
            `**Birthday:** ${q.birthday || "—"}`,
            `**Track:** ${q.track || "—"}`,
            `**Character:** ${q.character || "—"}`,
            `**Arena:** ${q.arena || "—"}`,
            `**Color:** ${q.color || "—"}`,
            `**Engine:** ${q.engine || "—"}`
          ].join("\n"))]
      });
    }

    if (cmd === "rank_stats") {
      return m.reply({
        embeds:[new EmbedBuilder()
          .setTitle(`${m.author.username}'s Rank Stats`)
          .setColor(0x5865F2)
          .setDescription([
            `**FFA:** ${p.ffaMmr} MMR`,
            `**Duo:** ${p.teamMmr} MMR`,
            `**War:** ${p.teamMmr} MMR`
          ].join("\n"))]
      });
    }

    if (cmd === "leaderboard") {
      const top = Object.entries(db.profiles)
        .sort((a,b) => b[1].ffaMmr - a[1].ffaMmr)
        .slice(0,25);

      return m.reply(
        "**CTR FFA MMR Leaderboard**\n" +
        (top.map(([id,x],i) => `${i+1}. <@${id}> — ${x.ffaMmr} MMR · ${x.points} pts`).join("\n") || "No players yet.")
      );
    }

    const setters = {
      set_ranked_name:"rankedName",
      set_time_zone:"timezone",
      set_track:"track",
      set_character:"character",
      set_arena:"arena",
      set_color:"color",
      set_engine:"engine",
      set_birthday:"birthday"
    };

    if (setters[cmd]) {
      const val = args.join(" ").trim();
      if (!val) return m.reply(`Use \`!${cmd} <value>\`.`);
      p[setters[cmd]] = val.slice(0,100);
      save();
      return m.reply(`${setters[cmd]} updated successfully.`);
    }

    if (cmd === "set_flag") {
      const value = args.join("").trim().toLowerCase();
      const flag = FLAG_CODES[value] || (FLAGS.includes(args.join("")) ? args.join("") : null);
      if (!flag) return m.reply("Use a valid country code, for example `!set_flag sa`.");
      p.flag = flag;
      save();
      return m.reply(`Flag updated: ${flag}`);
    }

    if (cmd === "set_continent") {
      const value = args.join(" ").toLowerCase();
      const continent = CONTINENTS.find(x => x.toLowerCase() === value);
      if (!continent) return m.reply(`Choose: ${CONTINENTS.join(", ")}`);
      p.continent = continent;
      save();
      return m.reply(`Continent updated: ${continent}`);
    }

    if (cmd === "set_nat") {
      if (!["2","3"].includes(args[0])) return m.reply("Use `!set_nat 2` or `!set_nat 3`.");
      p.nat = args[0];
      save();
      return m.reply("NAT updated successfully.");
    }

    if (cmd === "set_languages") {
      const value = args.join(" ").toLowerCase();
      const lang = LANGS.find(x => x.toLowerCase() === value);
      if (!lang) return m.reply("Choose Arabic, Spanish, or English.");
      p.language = lang;
      save();
      return m.reply("Language updated successfully.");
    }

    if (cmd === "set_voice_chat") {
      const value = args[0]?.toLowerCase();
      if (!["discord","party"].includes(value)) return m.reply("Use Discord or Party.");
      p.voiceChat = value === "party" ? "Party" : "Discord";
      save();
      return m.reply("Voice chat updated successfully.");
    }

    if (cmd === "set_mmr") {
      return m.reply("❌ This command is restricted to administrators. Use `!admin setmmr @player <number>`.");
    }

    if (cmd === "set_team") {
      const ids = parseMentions(m);
      if (ids.length !== 4) return m.reply("Mention exactly four players: `!set_team @a @b @c @d`.");

      const key = `team-${Date.now()}`;
      db.pending[key] = {
        type:"team",owner:m.author.id,players:ids,confirmed:[],
        expires:Date.now()+60000
      };
      save();

      const row = new ActionRowBuilder().addComponents(
        makeButton(`team_yes:${key}`,"Confirm",ButtonStyle.Success),
        makeButton(`team_no:${key}`,"Cancel",ButtonStyle.Danger)
      );

      return m.reply({
        content:`Team request: ${mentions(ids)}. Each player must confirm within 1 minute.`,
        components:[row]
      });
    }

    if (cmd === "unset_team") {
      for (const [id,t] of Object.entries(db.teams)) {
        if (t.players.includes(m.author.id)) delete db.teams[id];
      }
      save();
      return m.reply("Your team registration was removed.");
    }

    if (cmd === "set_duo") {
      const target = m.mentions.users.first();
      if (!target || target.id === m.author.id) return m.reply("Use `!set_duo @player`.");

      const key = `duo-${Date.now()}`;
      db.pending[key] = {
        type:"duo",owner:m.author.id,target:target.id,
        expires:Date.now()+60000
      };
      save();

      const row = new ActionRowBuilder().addComponents(
        makeButton(`duo_yes:${key}`,"Accept",ButtonStyle.Success),
        makeButton(`duo_no:${key}`,"Decline",ButtonStyle.Danger)
      );

      return m.reply({
        content:`<@${target.id}> — accept this Duo request within 1 minute.`,
        components:[row]
      });
    }

    if (cmd === "divors" || cmd === "divorce" || cmd === "leave_duo") {
      const id = Object.keys(db.duos).find(k => db.duos[k].includes(m.author.id));
      if (!id) return m.reply("You are not in a Duo.");
      delete db.duos[id];
      save();
      return m.reply("Duo ended.");
    }

    if (cmd === "admin") {
      if (!isAdmin(m.member)) return m.reply("Admin only.");

      const target = m.mentions.users.first();
      const action = args[0]?.toLowerCase();
      const n = Number(args.find(x => /^\d+$/.test(x)));

      if (!target || !["addpoints","removepoints","setpoints","setmmr"].includes(action) || !Number.isFinite(n)) {
        return m.reply("Use `!admin addpoints|removepoints|setpoints|setmmr @player amount`.");
      }

      const q = profile(target.id);
      if (action === "addpoints") q.points += n;
      if (action === "removepoints") q.points = Math.max(0,q.points-n);
      if (action === "setpoints") q.points = n;
      if (action === "setmmr") {
        q.ffaMmr = n;
        q.teamMmr = n;
      }

      save();
      return m.reply(`${target.username}: ${q.points} pts · FFA ${q.ffaMmr} MMR · Duo/War ${q.teamMmr} MMR`);
    }

    if (cmd === "points") {
      return m.reply("Points are displayed in `!p`. Admins: `!admin addpoints @player 10`.");
    }

    if (cmd === "results") {
      const l = Object.values(db.lobbies).find(x =>
        x.status === "started" && x.matchChannelId === m.channel.id
      );

      if (!l) return m.reply("Use this command inside an active match room.");
      if (l.scorekeeperId !== m.author.id && !isAdmin(m.member)) {
        return m.reply("Only the assigned scorekeeper or an admin can enter results.");
      }

      const target = m.mentions.users.first();
      if (!target || !l.players.includes(target.id)) return m.reply("Mention a player in this match.");

      if (l.scores?.[target.id]) return m.reply("This player's result has already been submitted.");

      const requiredMaps = l.mode === "1v1" ? 5 : 8;
      const nums = parseResultNums(args.filter(x => !x.startsWith("<@")));
      if (nums.length !== requiredMaps) {
        return m.reply(`Enter exactly ${requiredMaps} map scores: \`!results @player ${Array(requiredMaps).fill("4").join(" ")}\`.`);
      }

      const total = nums.reduce((a,b) => a+b,0);
      l.scores ||= {};
      l.scores[target.id] = {nums,total};
      save();

      const required = lobbyCapacity(l);
      await m.reply(
        `<@${target.id}> result saved: ${nums.join(" + ")} = **${total}** points. ${Object.keys(l.scores).length}/${required} players entered.`
      );

      if (Object.keys(l.scores).length === required && !l.resultsApplied) {
        const ranked = l.players
          .map(id => ({id,total:l.scores[id]?.total ?? 0}))
          .sort((a,b) => b.total-a.total);

        const lines = [];

        if (l.mode === "1v1") {
          ranked.forEach((x,i) => {
            lines.push(`${i+1}. <@${x.id}> — ${x.total} points`);
          });

          l.resultsApplied = true;
          save();
          await m.channel.send(
            "**1v1 Results — no MMR or points changes**\n" + lines.join("\n")
          );
          return;
        }

        const deltas = updateMMR(ranked,l.mode);

        ranked.forEach((x,i) => {
          const q = profile(x.id);
          const d = deltas[i];

          q.points += x.total;
          if (l.mode === "FFA") q.ffaMmr = Math.max(0,q.ffaMmr+d);
          else q.teamMmr = Math.max(0,q.teamMmr+d);

          q.matches++;
          if (i === 0) q.wins++;
          else q.losses++;

          const rating = ratingForMode(q,l.mode);
          lines.push(
            `${i+1}. <@${x.id}> — ${x.total} pts · MMR ${d>=0?"+":""}${d} · New rating: ${rating}`
          );
        });

        l.resultsApplied = true;
        save();

        await m.channel.send(
          `**${l.mode} Results recorded — points and ${l.mode === "FFA" ? "FFA" : "Duo/War"} MMR updated**\n` +
          lines.join("\n")
        );
      }
      return;
    }

  } catch(e) {
    console.error(e);
    return m.reply(`Error: ${e.message}`).catch(() => {});
  }
});

client.on("interactionCreate",async i => {
  try {
    if (i.isStringSelectMenu()) {
      const [kind,owner] = i.customId.split(":");

      if (i.user.id !== owner) {
        return i.reply({content:"Only the person who started this setup can use it.",ephemeral:true});
      }

      if (kind === "standard_mode") {
        const mode = i.values[0];
        const pending = db.pending[owner];
        if (pending) delete db.pending[owner];

        const l = await createLobby(i.guild,i.user,{mode});
        return i.update({
          content:`${mode} lobby #${l.id} posted in <#${l.hubId}>.`,
          components:[]
        });
      }

      const pending = db.pending[owner];
      if (!pending) {
        return i.reply({content:"Setup expired. Run the command again.",ephemeral:true});
      }

      if (kind === "custom_mode") {
        pending.config.mode = i.values[0];
        pending.step = "continents";
        save();

        return i.update({
          content:"Choose one or more allowed continents.",
          components:[continentMenu(owner)]
        });
      }

      if (kind === "custom_continent") {
        pending.config.continents = i.values;
        save();

        if (pending.config.mode === "1v1") {
          const config = pending.config;
          delete db.pending[owner];
          save();

          const l = await createLobby(i.guild,i.user,config);
          return i.update({
            content:`Custom 1v1 lobby #${l.id} posted in <#${l.hubId}>.`,
            components:[]
          });
        }

        return i.showModal(mmrModal(owner));
      }
    }

    if (i.isModalSubmit()) {
      const [kind,owner] = i.customId.split(":");
      if (kind !== "custom_mmr") return;
      if (i.user.id !== owner) {
        return i.reply({content:"Only the person who started this setup can use it.",ephemeral:true});
      }

      const pending = db.pending[owner];
      if (!pending) return i.reply({content:"Setup expired. Run `!l custom` again.",ephemeral:true});

      const min = Number(i.fields.getTextInputValue("min"));
      const max = Number(i.fields.getTextInputValue("max"));

      if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min) {
        return i.reply({content:"Enter valid MMR values. Maximum must be greater than or equal to minimum.",ephemeral:true});
      }

      pending.config.minMmr = min;
      pending.config.maxMmr = max;

      const config = pending.config;
      delete db.pending[owner];
      save();

      const l = await createLobby(i.guild,i.user,config);
      return i.reply({
        content:`Custom ${l.mode} lobby #${l.id} posted in <#${l.hubId}>.`,
        ephemeral:true
      });
    }

    if (!i.isButton()) return;

    const [act,id] = i.customId.split(":");

    if (["join","leave","delete","volunteer"].includes(act)) {
      const l = db.lobbies[id];
      if (!l) return i.deferUpdate();

      if (act === "join") {
        await i.deferUpdate();
        const result = await addPlayer(l,i.user,i.guild);
        if (result) {
          const h = await i.user.createDM().catch(() => null);
          if (h) await h.send(result).catch(() => {});
        }
        return;
      }

      if (act === "leave") {
        await i.deferUpdate();
        if (l.status !== "open" || !l.players.includes(i.user.id)) return;

        l.players = l.players.filter(x => x !== i.user.id);
        l.readyMessageId = null;
        l.readyAt = null;
        save();
        await refreshLobby(i.guild,l);
        return;
      }

      if (act === "delete") {
        await i.deferUpdate();

        if (i.user.id !== l.hostId && !isAdmin(i.member)) return;

        l.status = "closed";
        save();

        const hubChannel = await i.guild.channels.fetch(l.hubId).catch(() => null);
        if (hubChannel && l.readyMessageId) {
          const ready = await hubChannel.messages.fetch(l.readyMessageId).catch(() => null);
          if (ready) await ready.delete().catch(() => {});
        }

        if (hubChannel && l.messageId) {
          const lobbyMessage = await hubChannel.messages.fetch(l.messageId).catch(() => null);
          if (lobbyMessage) await lobbyMessage.delete().catch(() => {});
        }

        if (l.matchChannelId) {
          const room = await i.guild.channels.fetch(l.matchChannelId).catch(() => null);
          if (room) await room.delete("Lobby deleted").catch(() => {});
        }
        return;
      }

      if (act === "volunteer") {
        if (l.players.length !== lobbyCapacity(l) || l.status !== "open") {
          return i.reply({content:"This match is not ready.",ephemeral:true});
        }
        if (!l.players.includes(i.user.id)) {
          return i.reply({content:"Only players in this match can volunteer.",ephemeral:true});
        }
        if (l.scorekeeperId) {
          return i.reply({content:"A scorekeeper has already been assigned.",ephemeral:true});
        }

        await i.deferReply({ephemeral:true});
        await startMatch(l,i.guild,i.user.id);
        return i.editReply("You are the scorekeeper. The match room has been created.");
      }
    }

    if (act === "team_yes" || act === "team_no") {
      const x = db.pending[id];
      if (!x || x.type !== "team" || Date.now() > x.expires) {
        return i.reply({content:"Team request expired.",ephemeral:true});
      }
      if (!x.players.includes(i.user.id)) {
        return i.reply({content:"You are not part of this team.",ephemeral:true});
      }

      if (act === "team_no") {
        delete db.pending[id];
        save();
        return i.update({content:"Team request cancelled.",components:[]});
      }

      if (!x.confirmed.includes(i.user.id)) x.confirmed.push(i.user.id);

      if (x.confirmed.length === 4) {
        db.teams[id] = {players:x.players};
        delete db.pending[id];
        save();
        return i.update({content:`Team confirmed: ${mentions(x.players)}`,components:[]});
      }

      save();
      return i.reply({content:`Confirmed (${x.confirmed.length}/4).`,ephemeral:true});
    }

    if (act === "duo_yes" || act === "duo_no") {
      const x = db.pending[id];
      if (!x || x.type !== "duo" || Date.now() > x.expires) {
        return i.reply({content:"Duo request expired.",ephemeral:true});
      }
      if (i.user.id !== x.target) {
        return i.reply({content:"Only the invited player can respond.",ephemeral:true});
      }

      if (act === "duo_no") {
        delete db.pending[id];
        save();
        return i.update({content:"Duo request declined.",components:[]});
      }

      db.duos[id] = [x.owner,x.target];
      delete db.pending[id];
      save();
      return i.update({content:`Duo confirmed: <@${x.owner}> + <@${x.target}>`,components:[]});
    }

  } catch(e) {
    console.error(e);
    if (i.isRepliable() && !i.replied && !i.deferred) {
      await i.reply({
        content:"Something went wrong. Check bot logs.",
        ephemeral:true
      }).catch(() => {});
    }
  }
});

client.login(TOKEN);