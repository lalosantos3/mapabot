import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, TextChannel } from 'discord.js';
import { CONFIG } from '../config';
import { GuildResolver } from '../utils/resolver';
import { sendSetupMenu } from './panels';
import { showLfgModal } from './lfg';
import { handleGiveawayCommand, handlePollCommand } from './events';
import { db } from '../database';

export async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  const { commandName, guild } = interaction;
  if (!guild) return;

  const modLogs = GuildResolver.getTextChannel(guild, CONFIG.NAMES.CHANNELS.MOD_LOGS);

  switch (commandName) {
    case 'setup':
      await sendSetupMenu(interaction);
      break;
    case 'armar-partida':
      await showLfgModal(interaction);
      break;
    case 'sorteo':
      await handleGiveawayCommand(interaction);
      break;
    case 'encuesta':
      await handlePollCommand(interaction);
      break;
    case 'lockdown':
      const state = interaction.options.getBoolean('activar', true);
      db.setSetting('lockdown', state ? '1' : '0');
      await interaction.reply({ content: state ? '🔒 Lockdown activado.' : '🔓 Lockdown desactivado.' });
      break;
    case 'clear':
      const amount = interaction.options.getInteger('cantidad', true);
      const channel = interaction.channel as TextChannel;
      const deleted = await channel.bulkDelete(amount, true);
      await interaction.reply({ content: `🧹 Se borraron ${deleted.size} mensajes.`, ephemeral: true });
      break;
    case 'kick':
      const targetKick = interaction.options.getMember('usuario') as GuildMember | null;
      if (!targetKick) return interaction.reply({ content: '❌ Usuario no encontrado.', ephemeral: true });
      await targetKick.kick();
      await interaction.reply({ content: `👢 ${targetKick.user.tag} expulsado.` });
      break;
    case 'ban':
      const targetBan = interaction.options.getMember('usuario') as GuildMember | null;
      if (!targetBan) return interaction.reply({ content: '❌ Usuario no encontrado.', ephemeral: true });
      await targetBan.ban();
      await interaction.reply({ content: `🔨 ${targetBan.user.tag} baneado.` });
      break;
    case 'timeout':
      const targetTO = interaction.options.getMember('usuario') as GuildMember | null;
      const mins = interaction.options.getInteger('minutos', true);
      if (!targetTO) return interaction.reply({ content: '❌ Usuario no encontrado.', ephemeral: true });
      await targetTO.timeout(mins * 60 * 1000);
      await interaction.reply({ content: `🔇 ${targetTO.user.tag} aislado por ${mins} mins.` });
      break;
    case 'anuncio':
      const titulo = interaction.options.getString('titulo', true);
      const mensaje = interaction.options.getString('mensaje', true);
      const anunciosChan = GuildResolver.getTextChannel(guild, CONFIG.NAMES.CHANNELS.ANUNCIOS);
      if (!anunciosChan) return interaction.reply({ content: '❌ Canal de anuncios no encontrado.', ephemeral: true });
      await anunciosChan.send({ embeds: [new EmbedBuilder().setTitle(`📢 ${titulo}`).setDescription(mensaje.replace(/\\n/g, '\n')).setColor(0x9B59B6)] });
      await interaction.reply({ content: '✅ Anuncio enviado.', ephemeral: true });
      break;
  }
}