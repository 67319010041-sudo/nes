
'use strict';

process.env.PYTHONWARNINGS = 'ignore';
process.env.PYTHONUNBUFFERED = '1';

require('dotenv').config();
const path = require('path');
const { Client, GatewayIntentBits, Routes, REST, SlashCommandBuilder } = require('discord.js');
const { DisTube } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { getVoiceConnection } = require('@discordjs/voice');
const fs = require('fs');
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, child } = require("firebase/database");

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBY5b_eChwHx3qO-J4YkW9aw03xOOEMurM",
  authDomain: "discordunknow-54ce9.firebaseapp.com",
  projectId: "discordunknow-54ce9",
  storageBucket: "discordunknow-54ce9.firebasestorage.app",
  messagingSenderId: "571989738366",
  appId: "1:571989738366:web:009545030d8cbcfc11292f",
  measurementId: "G-25J7QG5SM5",
  databaseURL: "https://discordunknow-54ce9-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

let youtubeCookie = undefined;
try {
  const cookiePath = path.join(__dirname, 'cookies.json');
  if (fs.existsSync(cookiePath)) {
    // Try reading as JSON first
    const content = fs.readFileSync(cookiePath, 'utf8');
    try {
      youtubeCookie = JSON.parse(content);
      console.log('Loaded cookies.json successfully!');
    } catch {
      console.warn(' cookies.json found but invalid JSON.');
    }
  }
} catch (e) {
  console.warn(' Error loading cookies:', e);
}

// --------------------------------------------------------------------------------
// 1. FFmpeg & Voice Setup
// --------------------------------------------------------------------------------
try {
  const ff = require('ffmpeg-static');
  if (ff) {
    process.env.FFMPEG_PATH = ff;
    // Helper to ensure ffmpeg is found
    process.env.PATH = `${process.env.PATH}${path.delimiter}${path.dirname(ff)}`;
    console.log('Found ffmpeg-static at:', ff);
  } else {
    console.warn('ffmpeg-static found but returned null/undefined path?');
  }
} catch (e) {
  console.warn('ffmpeg-static not installed or error loading it. System ffmpeg will be used if available.');
}

// --------------------------------------------------------------------------------
// 2. Client & DisTube Setup
// --------------------------------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const plugins = [
  new SpotifyPlugin(),
  new SoundCloudPlugin(),
  new YtDlpPlugin({
    update: true,
    cookie: youtubeCookie
  })
];

const distube = new DisTube(client, {
  emitNewSongOnly: true,
  emitAddSongWhenCreatingQueue: false,
  emitAddListWhenCreatingQueue: false,
  plugins,
  // Stable FFmpeg arguments for network resilience
  ffmpeg: {
    args: {
      global: {
        'reconnect': '1',
        'reconnect_streamed': '1',
        'reconnect_delay_max': '5',
      },
    },
  },
});

// Event listeners for DisTube to debug sound
distube
  .on('playSong', (queue, song) => {
    const msg = `เพลงที่เล่นคือ ${song.name}`;
    queue.textChannel?.send(msg).catch(() => { });
  })
  .on('finish', (queue) => {
    setTimeout(() => {
      try {
        distube.voices.leave(queue.id);
      } catch (e) { console.error('Auto-leave error:', e); }
    }, 2000);
  })
  .on('addSong', (queue, song) => {
    const msg = `เพิ่มเพลง **${song.name}** - \`${song.formattedDuration}\` เข้าคิวโดย ${song.user}`;
    queue.textChannel?.send(msg).catch(() => { });
  })
  .on('error', (error, queue) => {
    if (queue && queue.textChannel) {
      queue.textChannel.send(`เกิดข้อผิดพลาด: ${error.toString().slice(0, 1900)}`).catch(() => { });
    }
    console.error('DisTube Error:', error);
  });


// --------------------------------------------------------------------------------
// 3. Command Registration (Nes / Stop)
// --------------------------------------------------------------------------------
const commands = [
  new SlashCommandBuilder()
    .setName('nestle')
    .setDescription('เล่นเพลง (รองรับ YouTube และอื่นๆ)')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('ชื่อเพลง หรือ ลิงก์')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('ออกจากห้องเสียง (หยุดเพลง)'),
  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('ข้ามเพลงปัจจุบัน'),
  new SlashCommandBuilder()
    .setName('site')
    .setDescription('รับลิงก์หน้าจัดการ Playlist'),
  new SlashCommandBuilder()
    .setName('playlish') // Typo intended as per user request
    .setDescription('เล่นเพลงทั้งหมดจาก Playlist เว็บ'),
  new SlashCommandBuilder()
    .setName('deletechat')
    .setDescription('ลบข้อความทั้งหมดที่บอทพิมพ์ (Clean Up)'),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN || process.env.DISCORD_TOKEN);

async function registerCommands(clientId) {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

// --------------------------------------------------------------------------------
// 4. Bot Events
// --------------------------------------------------------------------------------
const { Events, MessageFlags } = require('discord.js');

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Register commands globally (updates can take up to 1h, for instant use guild-specific but global is easier for one bot)
  await registerCommands(client.user.id);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Ensure we are in a guild and member is cached
  if (!interaction.inCachedGuild()) {
    return interaction.reply({ content: 'คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้นครับ', flags: MessageFlags.Ephemeral });
  }

  const { commandName } = interaction;
  const voiceChannel = interaction.member.voice.channel;

  if (commandName === 'nestle') {
    await interaction.deferReply(); // Music searches can take a moment

    if (!voiceChannel) {
      return interaction.editReply('คุณต้องเข้าห้องเสียงก่อนใช้คำสั่งนี้นะครับ!');
    }

    const query = interaction.options.getString('query');

    try {
      await distube.play(voiceChannel, query, {
        member: interaction.member,
        textChannel: interaction.channel
      });
      await interaction.editReply(`กำลังค้นหา: **${query}**...`);
    } catch (error) {
      console.error('Play error:', error);

      if (error.errorCode === 'VOICE_MISSING_PERMS') {
        return interaction.editReply('ผมไม่มีสิทธิ์เข้าห้องเสียงนี้ครับ! รบกวนเปิดสิทธิ์ **Connect** ให้ผมหน่อยนะ 🥺');
      }

      await interaction.editReply('เกิดข้อผิดพลาดในการเปิดเพลง ลองใช้ลิงก์ YouTube ตรงๆ ดูนะครับ');
    }
  }
  else if (commandName === 'leave') {
    try {
      await interaction.deferReply();
      distube.voices.leave(interaction.guildId);

      setTimeout(() => {
        const connection = getVoiceConnection(interaction.guildId);
        if (connection) connection.destroy();
      }, 1000);

      // Silent leave: Delete the reply so no message is shown
      await interaction.deleteReply().catch(() => { });
    } catch (e) {
      console.error('Command Error (Leave):', e);
    }
  }
  else if (commandName === 'skip') {
    try {
      await interaction.deferReply();
      const queue = distube.getQueue(interaction.guildId);
      if (!queue) {
        return interaction.editReply('ไม่มีเพลงให้ข้ามครับ!').catch(() => { });
      }
      try {
        await distube.skip(interaction.guildId);
        await interaction.editReply('Skip');
      } catch (e) {
        await interaction.editReply('ไม่เหลือเพลงให้ข้ามแล้วครับ');
      }
    } catch (e) {
      console.error('Command Error (Skip):', e);
    }
  }
  else if (commandName === 'site') {
    const userId = interaction.user.id;
    await interaction.reply({
      content: `**หน้าจัดลำดับเพลง (ของ ${interaction.user.username})**\n[คลิกที่นี่เพื่อจัดการ Playlist](https://discordunknow-g4zs.vercel.app/?uid=${userId})`,
      flags: MessageFlags.Ephemeral
    });
  }
  else if (commandName === 'playlish') {
    await interaction.deferReply();

    if (!voiceChannel) {
      return interaction.editReply('คุณต้องเข้าห้องเสียงก่อนใช้คำสั่งนี้นะครับ!');
    }

    try {
      const userId = interaction.user.id;
      const dbRef = ref(db);
      // Read from updated path: playlists/{userId}
      const snapshot = await get(child(dbRef, `playlists/${userId}`));

      if (!snapshot.exists()) {
        return interaction.editReply('Playlist ของคุณว่างเปล่าครับ! ไปเพิ่มเพลงที่ `/site` ในเว็บก่อนนะ');
      }

      const data = snapshot.val();
      // Helper to sort if data is array-like or object
      const playlist = Array.isArray(data) ? data : Object.values(data);
      const validSongs = playlist.filter(url => url && typeof url === 'string');

      if (validSongs.length === 0) {
        return interaction.editReply('Playlist ของคุณว่างเปล่าครับ!');
      }

      await interaction.editReply(`กำลังโหลด **${validSongs.length}** เพลงจาก Playlist ของคุณ...`);

      for (const url of validSongs) {
        try {
          await distube.play(voiceChannel, url, {
            member: interaction.member,
            textChannel: interaction.channel,
            skip: false
          });
        } catch (err) {
          console.error('Failed to load song:', url, err);
        }
      }

      await interaction.followUp('เพิ่มเพลงเข้าคิวเรียบร้อยครับ!');

    } catch (e) {
      console.error('Playlish Error:', e);
      await interaction.editReply('เกิดข้อผิดพลาดในการโหลด Playlist');
    }
  }
  else if (commandName === 'deletechat') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      // Fetch last 100 messages
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      // Filter only bot's messages
      const botMessages = messages.filter(msg => msg.author.id === client.user.id);

      if (botMessages.size > 0) {
        try {
          // Try Bulk Delete first (Faster, but needs 'Manage Messages' permission)
          await interaction.channel.bulkDelete(botMessages, true);
          await interaction.editReply(`✅ ลบข้อความของฉันแบบ Turbo ไปแล้ว **${botMessages.size}** ข้อความครับ!`);
        } catch (err) {
          if (err.code === 50013) {
            // Fallback: Delete one by one (Slower, but works without extra permission)
            await interaction.editReply('⚠️ ไม่มีสิทธิ์ "จัดการข้อความ" (Bulk Delete)... กำลังลบทีละข้อความครับ (อาจช้าหน่อย)...');
            let count = 0;
            for (const msg of botMessages.values()) {
              try { await msg.delete(); count++; } catch (e) { /* Ignore deleted */ }
            }
            await interaction.editReply(`✅ ลบข้อความของฉัน (Manual Mode) ไปแล้ว **${count}** ข้อความครับ!`);
          } else {
            throw err;
          }
        }
      } else {
        await interaction.editReply('❓ ไม่พบข้อความของฉันใน 100 ข้อความล่าสุดครับ');
      }
    } catch (e) {
      console.error('Delete Chat Error:', e);
      await interaction.editReply('❌ เกิดข้อผิดพลาดในการลบ (อาจไม่มีสิทธิ์ Manage Messages หรือข้อความเก่าเกิน 14 วัน)');
    }
  }
});

// --------------------------------------------------------------------------------
// 5. Start
// --------------------------------------------------------------------------------
client.login(process.env.TOKEN || process.env.DISCORD_TOKEN).catch(e => {
  console.error('Failed to login:', e);
});
