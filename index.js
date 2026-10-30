require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const {
  Client, GatewayIntentBits, Partials, PermissionsBitField, ChannelType,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) { console.error("Missing DISCORD_TOKEN. Copy .env.example to .env."); process.exit(1); }
const PREFIX = "!";
const DATA_FILE = path.join(__dirname, "data.json");
const HUB_ID = process.env.LOBBY_HUB_CHANNEL_ID || "";
const CATEGORY_ID = process.env.MATCH_CATEGORY_ID || "";
const ADMIN_IDS = (process.env.BOT_ADMINS || "").split(",").map(x => x.trim()).filter(Boolean);
const TRACKS = [
"Crash Cove","Mystery Caves","Sewer Speedway","Roo's Tubes","Slide Coliseum","Turbo Track","Coco Park","Tiger Temple","Papu's Pyramid","Dingo Canyon","Polar Pass","Tiny Arena","Dragon Mines","Blizzard Bluff","Hot Air Skyway","Cortex Castle","N. Gin Labs","Oxide Station","Inferno Island","Jungle Boogie","Clockwork Wumpa","Android Alley","Electron Avenue","Deep Sea Driving","Thunder Struck","Tiny Temple","Meteor Gorge","Barin Ruins","Out of Time","Assembly Lane","Hyper Spaceway","Retro Stadium","Twilight Tour","Prehistoric Playground","Spyro Circuit","Nina's Nightmare","Koala Carnival","Gingerbread Joyride","Megamix Mania","Drive-Thru Danger"
];
const FLAGS = ["🇸🇦","🇾🇪","🇿🇲","🇿🇼","🇻🇳","🇻🇪","🇺🇸","🇬🇧","🇮🇳","🇮🇩","🇵🇰","🇪🇸","🇫🇷","🇩🇪","🇮🇹","🇯🇵","🇰🇷","🇹🇷","🇦🇪","🇶🇦","🇴🇲","🇰🇼","🇧🇭","🇪🇬","🇲🇦","🇹🇳","🇸🇾","🇮🇶","🇱🇧","🇯🇴","🇵🇸","🇨🇦","🇦🇺","🇧🇷","🇲🇽","🇳🇱","🇧🇪","🇵🇹","🇦🇷","🇨🇱","🇨🇴","🇵🇭","🇹🇭","🇲🇾","🇸🇬","🇳🇿","🇿🇦","🇳🇬","🇰🇪","🇸🇪","🇳🇴","🇩🇰","🇫🇮","🇵🇱","🇨🇿","🇬🇷","🇺🇦","🇷🇺","🇨🇳","🇹🇼","🇭🇰"];
const LANGS = ["Arabic","Spanish","English"];
const PLATFORMS = ["PS5","PS4","PC"];
const MODES = ["FFA","War","Duo"];
const DEFAULT = { profiles:{}, lobbies:{}, teams:{}, duos:{}, pending:{}, settings:{hubId:HUB_ID,categoryId:CATEGORY_ID}, processed:[] };
function load(){try{return {...structuredClone(DEFAULT),...JSON.parse(fs.readFileSync(DATA_FILE,"utf8"))}}catch{return structuredClone(DEFAULT)}}
let db=load();
function save(){fs.writeFileSync(DATA_FILE,JSON.stringify(db,null,2))}
function profile(id){return db.profiles[id] ||= {points:0,mmr:1200,wins:0,losses:0,matches:0,rankedName:"",nat:"",flag:"",platform:"",language:"English",voiceChat:"Discord",timezone:"",birthday:"",track:"",character:"",arena:"",color:"",engine:""}}
function isAdmin(m){return !!m && (m.permissions?.has(PermissionsBitField.Flags.Administrator) || ADMIN_IDS.includes(m.id))}
function mentions(ids){return ids.map(x=>`<@${x}>`).join(" ")}
function parseMentions(m){return [...m.mentions.users.keys()]}
function safe(s){return String(s||"").replace(/[^a-zA-Z0-9-]/g,"-").replace(/-+/g,"-").slice(0,70)||"match"}
function makeButton(id,label,style,emoji){const b=new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);if(emoji)b.setEmoji(emoji);return b}
function profileComplete(p){return !!(p.rankedName && p.nat && p.flag && p.platform && p.language && p.timezone)}
function lobbyEmbed(l){
 const e=new EmbedBuilder().setColor(0x5865F2).setTitle(`CTR ${l.mode} Lobby #${l.id}`)
 .setDescription(`**Host:** <@${l.hostId}>\n**Mode:** ${l.mode}\n**Platform:** ${l.platform||"Any"}\n**Regions:** ${l.flags?.length?l.flags.join(" "):"All countries"}\n**MMR range:** ${l.minMmr==null?"Unlocked":`${l.minMmr}–${l.maxMmr}`}\n**Players (${l.players.length}/8):**\n${l.players.length?l.players.map((id,i)=>`${i+1}. <@${id}> · ${profile(id).mmr} MMR`).join("\n"):"Waiting for players..."}`)
 .setFooter({text:"Join or leave using the buttons below"});
 return e;
}
function lobbyRows(l){return [new ActionRowBuilder().addComponents(
 makeButton(`join:${l.id}`,"Join",ButtonStyle.Success,"✅"),
 makeButton(`leave:${l.id}`,"Leave",ButtonStyle.Secondary,"↩️"),
 makeButton(`close:${l.id}`,"Close",ButtonStyle.Danger,"🗑️")
)]}
async function hub(guild){const id=db.settings.hubId||HUB_ID;return id?guild.channels.fetch(id).catch(()=>null):null}
async function refreshLobby(guild,l){
 const ch=await guild.channels.fetch(l.hubId).catch(()=>null); if(!ch)return;
 const msg=await ch.messages.fetch(l.messageId).catch(()=>null);
 if(msg) await msg.edit({embeds:[lobbyEmbed(l)],components:lobbyRows(l)}).catch(()=>{});
}
async function createLobby(guild,host,opts={}){
 if(Object.values(db.lobbies).filter(x=>x.status==="open").length>=20)throw Error("Maximum 20 open lobbies.");
 const channel=await hub(guild);if(!channel)throw Error("Set LOBBY_HUB_CHANNEL_ID in .env first.");
 const id=String(Date.now()).slice(-6)+Math.floor(Math.random()*90+10);
 const l={id,hostId:host.id,guildId:guild.id,hubId:channel.id,messageId:null,players:[],status:"open",mode:opts.mode||"FFA",platform:opts.platform||"Any",flags:opts.flags||[],minMmr:opts.minMmr??null,maxMmr:opts.maxMmr??null,createdAt:Date.now(),matchChannelId:null,scorekeeperId:null};
 db.lobbies[id]=l;
 const msg=await channel.send({content:`<@${host.id}> opened a CTR lobby.`,embeds:[lobbyEmbed(l)],components:lobbyRows(l)});
 l.messageId=msg.id;save();return l;
}
async function closeLobby(l,guild,deleteMatch=false){
 l.status="closed";save();
 const ch=await guild.channels.fetch(l.matchChannelId||"").catch(()=>null);
 if(ch && deleteMatch) await ch.delete("CTR match finished").catch(()=>{});
 await refreshLobby(guild,l);
}
async function addPlayer(l,user,guild){
 if(l.status!=="open")return "This lobby is no longer open.";
 if(l.players.includes(user.id))return "You are already in this lobby.";
 if(l.players.length>=8)return "This lobby is full.";
 if(Object.values(db.lobbies).some(x=>x.status==="open"&&x.id!==l.id&&x.players.includes(user.id)))return "You can only join one open lobby at a time.";
 const p=profile(user.id);
 if(!profileComplete(p))return "Complete your profile first. Use `!p help`.";
 if(l.platform!=="Any"&&p.platform!==l.platform)return `This lobby is for ${l.platform}.`;
 if(l.flags.length&&!l.flags.includes(p.flag))return `This lobby is region locked. Allowed: ${l.flags.join(" ")}`;
 if(l.minMmr!==null&&(p.mmr<l.minMmr||p.mmr>l.maxMmr))return `Your MMR must be between ${l.minMmr} and ${l.maxMmr}.`;
 l.players.push(user.id);save();await refreshLobby(guild,l);
 if(l.players.length===8)await readyCheck(l,guild);
 return "You joined the lobby.";
}
async function readyCheck(l,guild){
 const ch=await hub(guild);if(!ch)return;
 const row=new ActionRowBuilder().addComponents(makeButton(`volunteer:${l.id}`,"Volunteer as scorekeeper",ButtonStyle.Primary,"📝"));
 const msg=await ch.send({content:`${mentions(l.players)}\n**8/8 players — match ready!**\nA player must volunteer to record the results within 5 minutes.`,components:[row]});
 l.readyMessageId=msg.id;l.readyAt=Date.now();save();
 setTimeout(async()=>{const cur=db.lobbies[l.id];if(cur&&cur.status==="open"&&!cur.scorekeeperId){await ch.send(`Lobby #${l.id} closed: no scorekeeper volunteered within 5 minutes.`).catch(()=>{});await closeLobby(cur,guild,false)}},300000);
}
async function startMatch(l,guild,scorekeeperId){
 if(l.status!=="open"||l.players.length!==8)throw Error("This lobby is not ready.");
 l.status="started";l.scorekeeperId=scorekeeperId;l.startedAt=Date.now();
 const everyone=guild.roles.everyone.id;
 const room=await guild.channels.create({name:`ctr-match-${safe(l.id)}`,type:ChannelType.GuildText,parent:db.settings.categoryId||CATEGORY_ID||undefined,permissionOverwrites:[
 {id:everyone,deny:[PermissionsBitField.Flags.ViewChannel]},
 {id:guild.members.me.id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.ReadMessageHistory,PermissionsBitField.Flags.ManageChannels]},
 ...l.players.map(id=>({id,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages,PermissionsBitField.Flags.ReadMessageHistory]}))
 ]});
 l.matchChannelId=room.id;save();
 const maps=[...TRACKS].sort(()=>Math.random()-.5).slice(0,8);
 const rows=l.players.map(id=>`${mentions([id])} | ${profile(id).points} pts | ${profile(id).mmr} MMR`).join("\n");
 const tableData=l.players.map(id=>`${profile(id).rankedName||"Player"} [${profile(id).flag||"??"}] 0|0|0|0|0|0|0|0`).join("\n");
 const url="https://gb.hlorenzi.com/table?data="+encodeURIComponent(tableData);
 await room.send({content:`# CTR ${l.mode} MATCH START\n${mentions(l.players)}\n\n**Players**\n${rows}\n\n**8 Random Maps**\n${maps.map((x,i)=>`${i+1}. ${x}`).join("\n")}\n\n**Scorekeeper:** <@${scorekeeperId}>\n**Lorenzi table:** ${url}\n\nScorekeeper: enter \`!results @player 4 4 1 1 1 4 1 4\` for each player. Use \`!l end\` when finished.`});
 const h=await guild.channels.fetch(l.hubId).catch(()=>null);if(h)await h.send(`Match #${l.id} has started in <#${room.id}>.`);
}
function help(){return new EmbedBuilder().setTitle("CTR Bot Commands").setColor(0x5865F2).setDescription([
"**Lobby**","`!l` create a standard FFA lobby in the hub","`!l costume` custom lobby setup","`!l end` end the match/lobby in this channel","",
"**Profile**","`!p` / `!p @player` show profile","`!p help` profile setup commands","`!set_ranked_name <name>`","`!set_nat 2|3`","`!set_flag 🇸🇦`","`!set_consoles PS5|PS4|PC`","`!set_languages Arabic|Spanish|English`","`!set_voice_chat Discord|Party`","`!set_time_zone <timezone>`","`!_birthday <date> <name>`","`!set_track <name>`","`!set_character <name>`","`!set_arena <name>`","`!set_color <name>`","`!set_engine <name>`","`!set_mmr <number>`",
"","**Teams & Duo**","`!set_team @a @b @c @d`","`!unset_team`","`!set_duo @player`","`!divors`",
"","**Stats**","`!leaderboard`","`!points` (admin)","`!results @player 4 4 1 1 1 4 1 4` (scorekeeper)",
"","**Admin**","`!setup hub #channel`","`!setup category CATEGORY_ID`","`!admin addpoints @player 10`","`!admin removepoints @player 10`","`!admin setpoints @player 100`","`!admin setmmr @player 1200`"
].join("\n"))}
function parseResultNums(args){return args.map(Number).filter(n=>Number.isFinite(n)&&n>=0)}
function updateMMR(players){
 const n=players.length;if(n<2)return [];
 return players.map((p,i)=>{
  const actual=players.reduce((s,q,j)=>s+(i===j?0:p.total>q.total?1:p.total===q.total?.5:0),0)/(n-1);
  const expected=players.reduce((s,q,j)=>s+(i===j?0:1/(1+10**((profile(q.id).mmr-profile(p.id).mmr)/400))),0)/(n-1);
  return Math.round(32*(actual-expected));
 });
}
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildMembers],partials:[Partials.Channel]});
client.once("ready",()=>console.log(`Online as ${client.user.tag}`));
client.on("messageCreate",async m=>{
 if(m.author.bot||!m.guild)return;
 const content=m.content.trim();if(!content.startsWith(PREFIX))return;
 const parts=content.slice(1).split(/\s+/),cmd=(parts.shift()||"").toLowerCase(),args=parts;
 try{
  const p=profile(m.author.id);
  if(cmd==="help"||cmd==="commands")return m.reply({embeds:[help()]});
  if(cmd==="setup"){
   if(!isAdmin(m.member))return m.reply("Admin only.");
   if(args[0]==="hub"){const ch=m.mentions.channels.first();if(!ch)return m.reply("Use `!setup hub #channel`.");db.settings.hubId=ch.id;save();return m.reply(`Lobby hub set to ${ch}.`)}
   if(args[0]==="category"){if(!args[1])return m.reply("Use `!setup category CATEGORY_ID`.");db.settings.categoryId=args[1];save();return m.reply("Match room category saved.")}
  }
  if(cmd==="l"){
   if(args[0]==="end"){
    const l=Object.values(db.lobbies).find(x=>x.status!=="closed"&&(x.matchChannelId===m.channel.id||x.hubId===m.channel.id&&x.hostId===m.author.id));
    if(!l)return m.reply("No active match/lobby found for this channel.");
    if(l.scorekeeperId!==m.author.id&&!isAdmin(m.member)&&l.hostId!==m.author.id)return m.reply("Only the scorekeeper, lobby host, or admin can end this.");
    await m.reply("Match ended. This match room will be deleted in 5 minutes.");
    l.status="closed";save();const room=await m.guild.channels.fetch(l.matchChannelId||"").catch(()=>null);
    if(room)setTimeout(()=>room.delete("Match cleanup after 5 minutes").catch(()=>{}),300000);
    return refreshLobby(m.guild,l);
   }
   if(args[0]==="costume"){
    const row1=new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`custom_region:${m.author.id}`).setPlaceholder("Region lock?").addOptions([{label:"All countries",value:"all"},{label:"Choose flags",value:"locked"}]));
    const row2=new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`custom_platform:${m.author.id}`).setPlaceholder("Platform").addOptions([{label:"Any platform",value:"Any"},...PLATFORMS.map(x=>({label:x,value:x}))]));
    const row3=new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`custom_mode:${m.author.id}`).setPlaceholder("Match type").addOptions(MODES.map(x=>({label:x,value:x}))));
    db.pending[m.author.id]={step:"region",config:{flags:[],platform:"Any",mode:"FFA",minMmr:null,maxMmr:null},createdAt:Date.now()};save();
    return m.reply({content:"Custom lobby setup — choose the region rule.",components:[row1]});
   }
   if(!profileComplete(p))return m.reply("Complete your profile first using `!p help`.");
   const l=await createLobby(m.guild,m.author);return m.reply(`Lobby #${l.id} posted in the lobby hub.`);
  }
  if(cmd==="p"){
   if(args[0]==="help")return m.reply({embeds:[new EmbedBuilder().setTitle("Complete your profile").setDescription("Required: `!set_ranked_name <name>`, `!set_nat 2|3`, `!set_flag 🇸🇦`, `!set_consoles PS5|PS4|PC`, `!set_languages Arabic|Spanish|English`, `!set_time_zone Asia/Riyadh`. Other profile fields are optional.")]});
   const target=m.mentions.users.first()||m.author,q=profile(target.id);
   return m.reply({embeds:[new EmbedBuilder().setTitle(`${target.username}'s CTR Profile`).setThumbnail(target.displayAvatarURL()).setColor(0x5865F2).setDescription([
    `**Ranked name:** ${q.rankedName||"—"}`,`**Points:** ${q.points}`,`**MMR:** ${q.mmr}`,`**Wins/Losses:** ${q.wins}/${q.losses}`,`**Platform:** ${q.platform||"—"}`,`**NAT:** ${q.nat||"—"}`,`**Flag:** ${q.flag||"—"}`,`**Language:** ${q.language}`,`**Voice:** ${q.voiceChat}`,`**Timezone:** ${q.timezone||"—"}`,`**Birthday:** ${q.birthday||"—"}`,`**Track:** ${q.track||"—"}`,`**Character:** ${q.character||"—"}`,`**Arena:** ${q.arena||"—"}`,`**Color:** ${q.color||"—"}`,`**Engine:** ${q.engine||"—"}`
   ].join("\n"))]});
  }
  if(cmd==="leaderboard"){
   const top=Object.entries(db.profiles).sort((a,b)=>b[1].mmr-a[1].mmr).slice(0,25);
   return m.reply("**CTR MMR Leaderboard**\n"+(top.map(([id,x],i)=>`${i+1}. <@${id}> — ${x.mmr} MMR · ${x.points} pts`).join("\n")||"No players yet."));
  }
  const setters={set_ranked_name:"rankedName",set_flag:"flag",set_time_zone:"timezone",set_track:"track",set_character:"character",set_arena:"arena",set_color:"color",set_engine:"engine",_birthday:"birthday"};
  if(setters[cmd]){const val=args.join(" ").trim();if(!val)return m.reply(`Use \`!${cmd} <value>\`.`);p[setters[cmd]]=val.slice(0,100);save();return m.reply(`${setters[cmd]} updated.`)}
  if(cmd==="set_nat"){if(!["2","3"].includes(args[0]))return m.reply("Use `!set_nat 2` or `!set_nat 3`.");p.nat=args[0];save();return m.reply("NAT updated.")}
  if(cmd==="set_consoles"){if(!PLATFORMS.includes(args[0]?.toUpperCase()))return m.reply("Choose PS5, PS4, or PC.");p.platform=args[0].toUpperCase();save();return m.reply("Platform updated.")}
  if(cmd==="set_languages"){const x=args.join(" ").toLowerCase();const v=LANGS.find(a=>a.toLowerCase()===x);if(!v)return m.reply("Choose Arabic, Spanish, or English.");p.language=v;save();return m.reply("Language updated.")}
  if(cmd==="set_voice_chat"){const x=args[0]?.toLowerCase();if(!["discord","party"].includes(x))return m.reply("Use Discord or Party.");p.voiceChat=x==="party"?"Party":"Discord";save();return m.reply("Voice chat updated.")}
  if(cmd==="set_mmr"){const n=Number(args[0]);if(!Number.isFinite(n)||n<0)return m.reply("Use `!set_mmr <number>`.");p.mmr=n;save();return m.reply("MMR updated.")}
  if(cmd==="set_team"){
   const ids=parseMentions(m);if(ids.length!==4)return m.reply("Mention exactly four players: `!set_team @a @b @c @d`.");
   const key=`team-${Date.now()}`;db.pending[key]={type:"team",owner:m.author.id,players:ids,confirmed:[],expires:Date.now()+60000};save();
   const row=new ActionRowBuilder().addComponents(makeButton(`team_yes:${key}`,"Confirm",ButtonStyle.Success),makeButton(`team_no:${key}`,"Cancel",ButtonStyle.Danger));
   return m.reply({content:`Team request: ${mentions(ids)}. Each player must confirm within 1 minute.`,components:[row]});
  }
  if(cmd==="unset_team"){for(const [id,t] of Object.entries(db.teams))if(t.players.includes(m.author.id))delete db.teams[id];save();return m.reply("Your team registration was removed.")}
  if(cmd==="set_duo"){
   const target=m.mentions.users.first();if(!target||target.id===m.author.id)return m.reply("Use `!set_duo @player`.");
   const key=`duo-${Date.now()}`;db.pending[key]={type:"duo",owner:m.author.id,target:target.id,expires:Date.now()+60000};save();
   const row=new ActionRowBuilder().addComponents(makeButton(`duo_yes:${key}`,"Accept",ButtonStyle.Success),makeButton(`duo_no:${key}`,"Decline",ButtonStyle.Danger));
   return m.reply({content:`<@${target.id}> — accept this Duo request within 1 minute.`,components:[row]});
  }
  if(cmd==="divors"){const id=Object.keys(db.duos).find(k=>db.duos[k].includes(m.author.id));if(!id)return m.reply("You are not in a Duo.");delete db.duos[id];save();return m.reply("Duo ended.")}
  if(cmd==="admin"){
   if(!isAdmin(m.member))return m.reply("Admin only.");
   const target=m.mentions.users.first();const action=args[0]?.toLowerCase(),n=Number(args.find(x=>/^\d+$/.test(x)));
   if(!target||!["addpoints","removepoints","setpoints","setmmr"].includes(action)||!Number.isFinite(n))return m.reply("Use `!admin addpoints|removepoints|setpoints|setmmr @player amount`.");
   const q=profile(target.id);if(action==="addpoints")q.points+=n;if(action==="removepoints")q.points=Math.max(0,q.points-n);if(action==="setpoints")q.points=n;if(action==="setmmr")q.mmr=n;save();return m.reply(`${target.username}: ${q.points} pts · ${q.mmr} MMR`);
  }
  if(cmd==="points"){return m.reply("Points are displayed in `!p`. Admins: `!admin addpoints @player 10`.")}
  if(cmd==="results"){
   const l=Object.values(db.lobbies).find(x=>x.status==="started"&&x.matchChannelId===m.channel.id);
   if(!l)return m.reply("Use this command inside an active match room.");
   if(l.scorekeeperId!==m.author.id&&!isAdmin(m.member))return m.reply("Only the assigned scorekeeper or an admin can enter results.");
   const target=m.mentions.users.first();if(!target||!l.players.includes(target.id))return m.reply("Mention a player in this match.");
   const nums=parseResultNums(args.filter(x=>!x.startsWith("<@")));if(nums.length!==8)return m.reply("Enter exactly 8 map scores: `!results @player 4 4 1 1 1 4 1 4`.");
   const total=nums.reduce((a,b)=>a+b,0);l.scores ||= {};l.scores[target.id]={nums,total};save();await m.reply(`<@${target.id}> result saved: ${nums.join(" + ")} = **${total}** points. ${Object.keys(l.scores).length}/8 players entered.`);
   if(Object.keys(l.scores).length===8&&!l.resultsApplied){
    const ranked=l.players.map(id=>({id,total:l.scores[id]?.total??0})).sort((a,b)=>b.total-a.total);
    const deltas=updateMMR(ranked);const lines=[];
    ranked.forEach((x,i)=>{const q=profile(x.id),d=deltas[i];q.points+=x.total;q.mmr=Math.max(0,q.mmr+d);q.matches++;if(i===0)q.wins++;else q.losses++;lines.push(`${i+1}. <@${x.id}> — ${x.total} pts · MMR ${d>=0?"+":""}${d}`)});
    l.resultsApplied=true;save();await m.channel.send("**Results recorded — points and MMR updated**\n"+lines.join("\n"));
   }
   return;
  }
 }catch(e){console.error(e);return m.reply(`Error: ${e.message}`).catch(()=>{})}
});
client.on("interactionCreate",async i=>{
 try{
  if(i.isStringSelectMenu()){
   const [kind,owner]=i.customId.split(":");if(i.user.id!==owner)return i.reply({content:"Only the person who started this setup can use it.",ephemeral:true});
   const pending=db.pending[owner];if(!pending)return i.reply({content:"Setup expired. Run `!l costume` again.",ephemeral:true});
   const v=i.values[0];
   if(kind==="custom_region"){
    if(v==="all"){pending.config.flags=[];pending.step="platform";}else{pending.step="flags";}
    save();
    if(v==="all")return i.update({content:"Choose platform.",components:[new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`custom_platform:${owner}`).setPlaceholder("Platform").addOptions([{label:"Any",value:"Any"},...PLATFORMS.map(x=>({label:x,value:x}))]))]});
    return i.update({content:"Choose one or more country flags.",components:[new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`custom_flags:${owner}`).setPlaceholder("Country flags").setMinValues(1).setMaxValues(20).addOptions(FLAGS.map((x,n)=>({label:x,value:x}))))]});
   }
   if(kind==="custom_flags"){pending.config.flags=i.values;save();return i.update({content:"Choose platform.",components:[new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`custom_platform:${owner}`).setPlaceholder("Platform").addOptions([{label:"Any",value:"Any"},...PLATFORMS.map(x=>({label:x,value:x}))]))]})}
   if(kind==="custom_platform"){pending.config.platform=v;save();return i.update({content:"Choose match type.",components:[new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`custom_mode:${owner}`).setPlaceholder("Match type").addOptions(MODES.map(x=>({label:x,value:x}))))]})}
   if(kind==="custom_mode"){pending.config.mode=v;save();delete db.pending[owner];const l=await createLobby(i.guild,i.user,pending.config);return i.update({content:`Custom lobby #${l.id} posted in <#${l.hubId}>.`,components:[]})}
  }
  if(!i.isButton())return;
  const [act,id]=i.customId.split(":");
  if(act==="join"||act==="leave"||act==="close"||act==="volunteer"){
   const l=db.lobbies[id];if(!l)return i.reply({content:"This lobby has ended.",ephemeral:true});
   if(act==="join"){const result=await addPlayer(l,i.user,i.guild);return i.reply({content:result,ephemeral:true})}
   if(act==="leave"){if(l.status!=="open"||!l.players.includes(i.user.id))return i.reply({content:"You cannot leave this lobby now.",ephemeral:true});l.players=l.players.filter(x=>x!==i.user.id);save();await refreshLobby(i.guild,l);return i.reply({content:"You left the lobby.",ephemeral:true})}
   if(act==="close"){if(i.user.id!==l.hostId&&!isAdmin(i.member))return i.reply({content:"Only the host or an admin can close this lobby.",ephemeral:true});await i.reply({content:"Lobby closed.",ephemeral:true});return closeLobby(l,i.guild,false)}
   if(act==="volunteer"){if(l.players.length!==8||l.status!=="open")return i.reply({content:"This match is not ready.",ephemeral:true});if(!l.players.includes(i.user.id))return i.reply({content:"Only players in this match can volunteer.",ephemeral:true});if(l.scorekeeperId)return i.reply({content:"A scorekeeper has already been assigned.",ephemeral:true});await i.deferReply({ephemeral:true});await startMatch(l,i.guild,i.user.id);return i.editReply("You are the scorekeeper. The match room has been created.")}
  }
  if(act==="team_yes"||act==="team_no"){
   const x=db.pending[id];if(!x||x.type!=="team"||Date.now()>x.expires)return i.reply({content:"Team request expired.",ephemeral:true});
   if(!x.players.includes(i.user.id))return i.reply({content:"You are not part of this team.",ephemeral:true});
   if(act==="team_no"){delete db.pending[id];save();return i.update({content:"Team request cancelled.",components:[]})}
   if(!x.confirmed.includes(i.user.id))x.confirmed.push(i.user.id);
   if(x.confirmed.length===4){db.teams[id]={players:x.players};delete db.pending[id];save();return i.update({content:`Team confirmed: ${mentions(x.players)}`,components:[]})}
   save();return i.reply({content:`Confirmed (${x.confirmed.length}/4).`,ephemeral:true});
  }
  if(act==="duo_yes"||act==="duo_no"){
   const x=db.pending[id];if(!x||x.type!=="duo"||Date.now()>x.expires)return i.reply({content:"Duo request expired.",ephemeral:true});
   if(i.user.id!==x.target)return i.reply({content:"Only the invited player can respond.",ephemeral:true});
   if(act==="duo_no"){delete db.pending[id];save();return i.update({content:"Duo request declined.",components:[]})}
   db.duos[id]=[x.owner,x.target];delete db.pending[id];save();return i.update({content:`Duo confirmed: <@${x.owner}> + <@${x.target}>`,components:[]});
  }
 }catch(e){console.error(e);if(i.isRepliable()&&!i.replied&&!i.deferred)await i.reply({content:"Something went wrong. Check bot logs.",ephemeral:true}).catch(()=>{})}
});
client.login(TOKEN);
