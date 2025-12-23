
'use strict';


process.env.PYTHONWARNINGS = 'ignore';
process.env.PYTHONUNBUFFERED = '1';

require('dotenv').config();
const { getVoiceConnection } = require('@discordjs/voice');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');
const { DisTube } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');

try {
    const ff = require('ffmpeg-static');
    if (ff) {
        process.env.FFMPEG_PATH = ff;
        process.env.PATH = `${process.env.PATH}${path.delimiter}${path.dirname(ff)}`;
        console.log('Using ffmpeg-static at', ff);
    }
} catch (e) {
    console.log('ffmpeg-static not installed; ensure system ffmpeg is in PATH');
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});


const plugins = [
    new SpotifyPlugin(),
    new SoundCloudPlugin()
];

try {

    const { YtDlpPlugin } = require('@distube/yt-dlp');
    plugins.push(new YtDlpPlugin({
        update: false,
        exec: true,

    }));
    console.log('YtDlpPlugin loaded.');
} catch (e) {
    console.warn('YtDlpPlugin NOT loaded (continuing without it):', e.message);

}

const distube = new DisTube(client, {
    emitNewSongOnly: true,
    plugins
});



client.once('clientReady', () => {

    console.log(`(clientReady) บอทอารยากำลังทำงานอยู่น้า ${client.user?.tag || 'unknown'}`);
});

process.on('unhandledRejection', (err) => {
    console.error('UnhandledRejection:', err);
});
process.on('uncaughtException', (err) => {
    console.error('UncaughtException:', err);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const prefix = process.env.PREFIX || '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const voiceChannel = message.member.voice.channel;

    if (command === 'play' || command === 'nes') {
        const query = args.join(' ');
        if (!query) return message.reply('กรุณาใส่ลิงก์หรือชื่อเพลงที่ต้องการเล่น (พิมพ์ Nes ตามด้วยชื่อเพลง)');
        if (!voiceChannel) return message.reply('คุณต้องอยู่ในห้องเสียงเพื่อสั่งให้บอทเล่นเพลง');

        try {
            await distube.play(voiceChannel, query, {
                textChannel: message.channel,
                member: message.member
            });
            message.reply(`กำลังค้นหาและเล่น: **${query}**`);
        } catch (err) {
            console.error('Distube play error:', err);

            if (err?.message?.includes('NOT_SUPPORTED_URL') || err?.errorCode === 'NOT_SUPPORTED_URL') {
                return message.reply('ลิงก์นี้ไม่รองรับ ลองใช้ลิงก์ YouTube หรือชื่อเพลงแทน');
            }
            return message.reply('เกิดข้อผิดพลาดขณะพยายามเล่นเพลง ตรวจสอบบอทหรือคิวและลองอีกครั้ง');
        }
    }

    if (command === 'stop' || command === 'หยุด') {
        const queue = distube.getQueue(message);
        if (queue) {
            distube.stop(message);
            message.reply('หยุดเพลงแล้วครับ');
        } else {
            message.reply('ไม่มีเพลงที่เล่นอยู่ แต่จะออกจากห้องเสียงให้ครับ');
        }

        // Force leave if connected
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
        }
        return;
    }

    if (command === 'skip') {
        const queue = distube.getQueue(message);
        if (!queue) return message.reply('ไม่มีเพลงในคิวให้ข้าม');
        try {
            await distube.skip(message);
            return message.reply('ข้ามเพลงแล้ว');
        } catch (err) {
            console.error('Skip error:', err);
            return message.reply('ไม่สามารถข้ามเพลงได้');
        }
    }

    if (command === 'leave') {
        const connection = getVoiceConnection(message.guild.id);
        if (!connection) return message.reply('กูบอกว่าไม่ได้อยู่ในห้องเสียง');
        try {
            connection.destroy();
            return message.reply('กูออกเเล้วจ้า');
        } catch (err) {
            console.error('Leave voice channel error:', err);
            return message.reply('เกิดข้อผิดพลาดขณะพยายามออกจากห้องเสียง');
        }
    }


});

const token = process.env.TOKEN;
if (!token) {
    console.error('Missing TOKEN in environment variables. Set TOKEN in .env');
    process.exit(1);
}

client.login(token).catch(err => {
    console.error('Failed to login:', err);
    process.exit(1);
});
