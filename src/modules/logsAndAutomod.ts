import { GuildMember, Message, PartialMessage, EmbedBuilder, TextChannel } from 'discord.js';
import { CONFIG } from '../config';
import { GuildResolver } from '../utils/resolver';
import { db } from '../database';

const recentJoins: number[] = [];

export async function handleWelcomeAndAntiRaid(member: GuildMember) {
  const now = Date.now();
  recentJoins.push(now);
  while (recentJoins.length > 0 && now - recentJoins[0] > CONFIG.ANTIRAID.TIME_WINDOW_MS) {
    recentJoins.shift();
  }

  const modOnly = GuildResolver.getTextChannel(member.guild, CONFIG.NAMES.CHANNELS.MOD_ONLY) as TextChannel;
  const adminRole = GuildResolver.getRole(member.guild, CONFIG.NAMES.ROLES.ADMIN);

  if (recentJoins.length >= CONFIG.ANTIRAID.JOIN_THRESHOLD && db.getSetting('lockdown') === '0') {
    db.setSetting('lockdown', '1');
    if (modOnly) {
      await modOnly.send({
        content: adminRole ? `<@&${adminRole.id}> ¡Alerta Anti-Raid activada!` : '@here',
        embeds: [new EmbedBuilder().setTitle('🚨 Posible Raid detectado').setDescription('Se bloqueó temporalmente la verificación.').setColor(0xE74C3C)]
      });
    }
  }

  const channel = GuildResolver.getTextChannel(member.guild, CONFIG.NAMES.CHANNELS.BIENVENIDAS) as TextChannel;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('🦝 ¡Un nuevo mapache llegó!')
    .setDescription(`¡Bienvenido/a <@${member.id}> a **MotoMapaches**!\nPasa por #${CONFIG.NAMES.CHANNELS.VERIFICATE} para verificarte.`)
    .setThumbnail(member.user.displayAvatarURL())
    .setColor(0x9B59B6)
    .setTimestamp();

  await channel.send({ content: `¡Hola <@${member.id}>!`, embeds: [embed] }).catch(() => {});
}

export async function handleAutoMod(message: Message): Promise<boolean> {
  if (message.author.bot || !message.guild || !message.member) return false;

  const isStaff = message.member.permissions.has('Administrator');
  if (isStaff) return false;

  const contentLower = message.content.toLowerCase();
  const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9-]+/i;

  if (inviteRegex.test(contentLower)) {
    await message.delete().catch(() => {});
    const textChannel = message.channel as TextChannel;
    const warn = await textChannel.send(`🚫 <@${message.author.id}>, no se permiten invitaciones.`);
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    return true;
  }

  return false;
}

export async function handleMessageDelete(message: Message | PartialMessage) {
  if (!message.guild || message.author?.bot) return;
  const msgLogs = GuildResolver.getTextChannel(message.guild, CONFIG.NAMES.CHANNELS.MSG_LOGS) as TextChannel;
  if (!msgLogs) return;

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Mensaje Eliminado')
    .addFields(
      { name: 'Autor', value: message.author ? `${message.author.tag}` : 'Desconocido', inline: true },
      { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Contenido', value: message.content ? message.content.slice(0, 1024) : '*[Multimedia]*' }
    )
    .setColor(0xE74C3C)
    .setTimestamp();

  await msgLogs.send({ embeds: [embed] }).catch(() => {});
}

export async function handleMessageUpdate(oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage) {
  if (!newMsg.guild || newMsg.author?.bot || oldMsg.content === newMsg.content) return;
  const msgLogs = GuildResolver.getTextChannel(newMsg.guild, CONFIG.NAMES.CHANNELS.MSG_LOGS) as TextChannel;
  if (!msgLogs) return;

  const embed = new EmbedBuilder()
    .setTitle('✏️ Mensaje Editado')
    .addFields(
      { name: 'Autor', value: `${newMsg.author?.tag}`, inline: true },
      { name: 'Canal', value: `<#${newMsg.channel.id}>`, inline: true },
      { name: 'Antes', value: oldMsg.content || '*[Vacío]*' },
      { name: 'Después', value: newMsg.content || '*[Vacío]*' }
    )
    .setColor(0xF1C40F)
    .setTimestamp();

  await msgLogs.send({ embeds: [embed] }).catch(() => {});
}