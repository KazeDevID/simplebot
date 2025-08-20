export default {
  name: 'Ping',
  cmd: 'ping',
  category: 'general',
  desc: 'Mengecek kecepatan respon bot',
  
  async execute(m, args, bot) {
    const startTime = Date.now();
    
    const sentMsg = await m.reply('Pinging...');
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    const pingText = `🏓 *Pong!*\n\n` +
                    `📊 Response Time: ${responseTime}ms\n` +
                    `⏰ Timestamp: ${new Date().toLocaleString('id-ID')}`;
    
    await bot.sock.sendMessage(m.from, { 
      text: pingText,
      edit: sentMsg.key 
    });
  }
};