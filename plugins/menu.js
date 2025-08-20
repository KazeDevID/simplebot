export default {
  name: 'Menu',
  cmd: ['menu', 'help'],
  category: 'general',
  desc: 'Menampilkan daftar perintah',
  
  async execute(m, args, bot) {
    const plugins = Array.from(bot.plugins.values())
      .filter((plugin, index, self) => 
        index === self.findIndex(p => p.name === plugin.name)
      );

    const categories = {};
    
    plugins.forEach(plugin => {
      const category = plugin.category || 'other';
      if (!categories[category]) categories[category] = [];
      categories[category].push(plugin);
    });

    let teknyo = `╭─「 *${bot.botName}* 」\n`;
    teknyo += `│ Prefix: ${bot.prefix}\n`;
    teknyo += `│ Total Plugin: ${plugins.length}\n`;
    teknyo += `╰────────────────\n\n`;

    for (const [category, pluginList] of Object.entries(categories)) {
      teknyo += `╭─「 *${category.toUpperCase()}* 」\n`;
      
      pluginList.forEach(plugin => {
        const commands = Array.isArray(plugin.cmd) ? plugin.cmd : [plugin.cmd];
        teknyo += `│ ${bot.prefix}${commands[0]}\n`;
      });
      
      teknyo += `╰────────────────\n\n`;
    }

    await m.reply(teknyo);
  }
};