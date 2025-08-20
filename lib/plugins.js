import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function loadPlugins(bot) {
  const pluginDir = join(__dirname, '../plugins');
  
  try {
    const files = readdirSync(pluginDir).filter(file => file.endsWith('.js'));
    
    for (const file of files) {
      try {
        const pluginPath = join(pluginDir, file);
        const { default: plugin } = await import(`file://${pluginPath}`);
        
        if (plugin && plugin.cmd && plugin.execute) {
          bot.registerPlugin(plugin);
        }
      } catch (error) {
        console.log(`\x1b[31mError loading ${file}:\x1b[0m`, error);
      }
    }
  } catch (error) {
    console.log('\x1b[31mError reading plugins directory:\x1b[0m', error);
  }
}