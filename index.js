#!/usr/bin/env node

import { 
  makeWASocket,
  useMultiFileAuthState, 
  DisconnectReason,
  Browsers
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import fs from 'fs';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { serialize } from './lib/serialize.js';
import { loadPlugins } from './lib/plugins.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class WhatsAppBot extends EventEmitter {
  constructor() {
    super();
    this.sock = null;
    this.plugins = new Map();
    this.prefix = '.';
    this.owner = '628xxx';
    this.botName = 'WhatsApp Bot';
    this.usePairingCode = true;
  }

  async initialize() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    
    this.sock = makeWASocket({
      browser: Browsers.ubuntu('Chrome'),
      logger: pino({ level: 'silent' }),
      auth: state,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: true
    });

    await this.setupEventHandlers();
    await this.handleAuth();
    await loadPlugins(this);

    this.sock.ev.on('creds.update', saveCreds);
    
    return this.sock;
  }

  async setupEventHandlers() {
    this.sock.ev.on('connection.update', this.handleConnection.bind(this));
    this.sock.ev.on('messages.upsert', this.handleMessages.bind(this));
  }

  async handleAuth() {
    if (this.usePairingCode && !this.sock.authState.creds.registered) {
      const phoneNumber = await this.getPhoneInput();
      if (phoneNumber.startsWith('628')) {
        const code = await this.sock.requestPairingCode(phoneNumber);
        console.log(`\x1b[32mKode Pairing: ${code}\x1b[0m`);
      } else {
        console.log('\x1b[31mNomor harus diawali dengan 628\x1b[0m');
        process.exit(0);
      }
    }
  }

  getPhoneInput() {
    return new Promise((resolve) => {
      console.log('\x1b[33mMasukkan nomor WhatsApp:\x1b[0m');
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });
  }

  async handleConnection(update) {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr && !this.usePairingCode) {
      console.log('\x1b[36mScan QR Code:\x1b[0m');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'connecting') {
      console.log('\x1b[33mMenghubungkan...\x1b[0m');
    } else if (connection === 'open') {
      console.log('\x1b[32mTerhubung!\x1b[0m');
      this.emit('ready');
    } else if (connection === 'close') {
      await this.handleDisconnect(lastDisconnect);
    }
  }

  async handleDisconnect(lastDisconnect) {
    const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
    
    switch (reason) {
      case DisconnectReason.badSession:
        console.log('\x1b[31mSesi buruk, hapus folder session\x1b[0m');
        process.exit(0);
        break;
      case DisconnectReason.connectionClosed:
      case DisconnectReason.connectionLost:
      case DisconnectReason.timedOut:
        console.log('\x1b[33mKoneksi terputus, menghubungkan kembali...\x1b[0m');
        await this.initialize();
        break;
      case DisconnectReason.connectionReplaced:
      case DisconnectReason.loggedOut:
        console.log('\x1b[31mSesi berakhir, hapus folder session\x1b[0m');
        process.exit(0);
        break;
      case DisconnectReason.restartRequired:
        console.log('\x1b[34mRestart diperlukan...\x1b[0m');
        await this.initialize();
        break;
      default:
        console.log(`\x1b[31mDisconnect: ${reason}\x1b[0m`);
        await this.initialize();
    }
  }

  async handleMessages(chatUpdate) {
    try {
      const msg = chatUpdate.messages[0];
      if (!msg.message) return;

      const m = await serialize(msg, this.sock);
      //if (m.key.fromMe) return;

      this.emit('message', m);
      await this.processCommand(m);
    } catch (error) {
      console.log('\x1b[31mError handling message:\x1b[0m', error);
    }
  }

  async processCommand(m) {
    const body = m.body?.toLowerCase() || '';
    
    if (body === 'eval' || body === 'exec') {
      return;
    }

    if (!body.startsWith(this.prefix)) return;

    const args = body.slice(this.prefix.length).trim().split(' ');
    const command = args.shift();

    const plugin = this.plugins.get(command);
    if (!plugin) return;

    try {
      await plugin.execute(m, args, this);
    } catch (error) {
      console.log(`\x1b[31mError executing ${command}:\x1b[0m`, error);
      await m.reply('Terjadi kesalahan saat menjalankan perintah');
    }
  }

  registerPlugin(plugin) {
    if (Array.isArray(plugin.cmd)) {
      plugin.cmd.forEach(cmd => this.plugins.set(cmd, plugin));
    } else {
      this.plugins.set(plugin.cmd, plugin);
    }
  }
}

const bot = new WhatsAppBot();

bot.on('ready', () => {
  console.log('\x1b[32mBot siap digunakan!\x1b[0m');
});

bot.initialize().catch(console.error);

process.on('uncaughtException', (err) => {
  console.log('\x1b[31mUncaught Exception:\x1b[0m', err);
});

export default bot;