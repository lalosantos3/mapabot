import { Guild, TextChannel, VoiceChannel, CategoryChannel, Role } from 'discord.js';

export class GuildResolver {
  static getRole(guild: Guild, name: string): Role | undefined {
    return guild.roles.cache.find(r => r.name === name || r.name.includes(name.split('│')[1]?.trim() || name));
  }

  static getTextChannel(guild: Guild, name: string): TextChannel | undefined {
    return guild.channels.cache.find(
      c => c.isTextBased() && !c.isVoiceBased() && (c.name === name || c.name.includes(name.split('・')[1]?.trim() || name))
    ) as TextChannel | undefined;
  }

  static getVoiceChannel(guild: Guild, name: string): VoiceChannel | undefined {
    return guild.channels.cache.find(
      c => c.isVoiceBased() && (c.name === name || c.name.includes('Crear Sala'))
    ) as VoiceChannel | undefined;
  }

  static getCategory(guild: Guild, name: string): CategoryChannel | undefined {
    return guild.channels.cache.find(
      c => c.type === 4 && (c.name === name || c.name.includes(name.split('➔')[1]?.trim() || name))
    ) as CategoryChannel | undefined;
  }
}