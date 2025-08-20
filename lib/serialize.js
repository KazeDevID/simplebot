import { 
  jidDecode, 
  downloadContentFromMessage, 
  getContentType 
} from '@whiskeysockets/baileys';
import pkg from 'file-type';
const { fileTypeFromBuffer } = pkg;

export async function serialize(msg, sock) {
  if (!msg) return msg;

  const m = {};
  
  m.key = msg.key;
  m.isGroup = m.key.remoteJid?.endsWith('@g.us');
  m.sender = m.isGroup ? m.key.participant : m.key.remoteJid;
  m.from = m.key.remoteJid;
  
  if (m.isGroup) {
    m.participant = m.key.participant;
  }

  const messageType = getContentType(msg.message);
  m.type = messageType;
  m.message = msg.message;
  m.msg = msg.message[messageType];

  if (m.msg?.contextInfo) {
    m.quoted = m.msg.contextInfo.quotedMessage ? await serialize({
      key: {
        remoteJid: m.from,
        fromMe: false,
        id: m.msg.contextInfo.stanzaId,
        participant: m.msg.contextInfo.participant
      },
      message: m.msg.contextInfo.quotedMessage
    }, sock) : null;
  }

  m.body = m.msg?.text || 
           m.msg?.conversation || 
           m.msg?.caption || 
           m.msg?.selectedButtonId || 
           m.msg?.singleSelectReply?.selectedRowId || 
           '';

  m.reply = async (text, options = {}) => {
    return await sock.sendMessage(m.from, { text, ...options }, { quoted: msg });
  };

  m.react = async (emoji) => {
    return await sock.sendMessage(m.from, {
      react: { text: emoji, key: m.key }
    });
  };

  m.download = async () => {
    if (!m.msg) return null;
    
    const stream = await downloadContentFromMessage(m.msg, m.type.replace('Message', ''));
    let buffer = Buffer.from([]);
    
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    
    const fileType = await fileTypeFromBuffer(buffer);
    return { buffer, fileType };
  };

  m.isOwner = m.sender === sock.owner || false;
  m.isAdmin = false;
  m.isBotAdmin = false;

  if (m.isGroup) {
    try {
      const groupMetadata = await sock.groupMetadata(m.from);
      const participants = groupMetadata.participants;
      
      m.isAdmin = participants.some(p => 
        p.id === m.sender && (p.admin === 'admin' || p.admin === 'superadmin')
      );
      
      m.isBotAdmin = participants.some(p => 
        p.id === sock.user.id && (p.admin === 'admin' || p.admin === 'superadmin')
      );
    } catch (error) {
      console.log('Error getting group metadata:', error);
    }
  }

  return m;
}