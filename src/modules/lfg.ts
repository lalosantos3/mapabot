import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  GuildMember,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  TextChannel
} from 'discord.js';
import { CONFIG } from '../config';
import { GuildResolver } from '../utils/resolver';

// 1. Muestra la ventana emergente (Modal) al usar /armar-partida
export async function showLfgModal(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('modal_armar_partida')
    .setTitle('🎮 Armar Partida / LFG');

  const gameInput = new TextInputBuilder()
    .setCustomId('lfg_game')
    .setLabel('¿Qué juego jugarán?')
    .setPlaceholder('Ej: League of Legends, Fortnite, Valorant...')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(50)
    .setRequired(true);

  const modeInput = new TextInputBuilder()
    .setCustomId('lfg_mode')
    .setLabel('Modo de juego o descripción')
    .setPlaceholder('Ej: Flex, Duos, Normales, Rango...')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(50)
    .setRequired(true);

  const slotsInput = new TextInputBuilder()
    .setCustomId('lfg_slots')
    .setLabel('¿Cuántos jugadores faltan? (Número)')
    .setPlaceholder('Ej: 2')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(2)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(gameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(modeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(slotsInput)
  );

  await interaction.showModal(modal);
}

function buildLfgEmbed(
  game: string,
  mode: string,
  hostId: string,
  players: string[],
  maxSlots: number,
  voiceChannelId: string | null
) {
  const isFull = players.length >= maxSlots;
  const slotsText = players.map((id, idx) => `${idx + 1}. <@${id}> ${id === hostId ? '👑' : ''}`).join('\n');
  const emptyCount = Math.max(0, maxSlots - players.length);
  const emptyText = Array.from({ length: emptyCount }, (_, i) => `${players.length + i + 1}. [Espacio disponible]`).join('\n');

  return new EmbedBuilder()
    .setTitle(`🎮 ${game} — ${mode}`)
    .setDescription(isFull ? '🔥 ¡SQUAD COMPLETA!' : `Buscando ${emptyCount} jugador(es) más.`)
    .addFields(
      { name: `Jugadores (${players.length}/${maxSlots})`, value: `${slotsText}\n${emptyText}`.trim() },
      { name: '🔊 Canal de Voz', value: voiceChannelId ? `<#${voiceChannelId}>` : '*Sin canal*' }
    )
    .setColor(isFull ? 0x2ECC71 : 0x9B59B6)
    .setTimestamp();
}

// 2. Procesa los datos enviados desde el Modal
export async function handleLfgModalSubmit(interaction: ModalSubmitInteraction) {
  const guild = interaction.guild;
  const member = interaction.member as GuildMember;
  if (!guild || !member) return;

  await interaction.deferReply({ ephemeral: true });

  const game = interaction.fields.getTextInputValue('lfg_game');
  const mode = interaction.fields.getTextInputValue('lfg_mode');
  const rawSlots = parseInt(interaction.fields.getTextInputValue('lfg_slots'), 10);

  if (isNaN(rawSlots) || rawSlots < 1 || rawSlots > 9) {
    return interaction.editReply({ content: '❌ Por favor ingresa un número válido de espacios (entre 1 y 9).' });
  }

  const maxSlots = rawSlots + 1;

  const lfgChannel = (GuildResolver.getTextChannel(guild, CONFIG.NAMES.CHANNELS.ARMAR_PARTIDA) || interaction.channel) as TextChannel;
  if (!lfgChannel || !lfgChannel.isTextBased()) {
    return interaction.editReply({ content: '❌ No se encontró un canal de texto válido para publicar la lobby.' });
  }

  const voiceChannelId = member.voice.channelId;
  const players = [interaction.user.id];
  const embed = buildLfgEmbed(game, mode, interaction.user.id, players, maxSlots, voiceChannelId);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('lfg_join').setLabel('Unirme').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('lfg_leave').setLabel('Salir').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('lfg_cancel').setLabel('Cerrar').setStyle(ButtonStyle.Danger)
  );

  const msg = await lfgChannel.send({
    content: `¡<@${interaction.user.id}> está armando partida!`,
    embeds: [embed],
    components: [row]
  });

  const allSessions = (global as any).lfgSessions || {};
  allSessions[msg.id] = { channelId: lfgChannel.id, hostId: interaction.user.id, game, mode, maxSlots, players, voiceChannelId };
  (global as any).lfgSessions = allSessions;

  await interaction.editReply({ content: `✅ ¡Tu lobby fue publicada exitosamente en <#${lfgChannel.id}>!` });
}

// 3. Maneja los botones de unirse / salir / cerrar de la tarjeta publicada
export async function handleLfgButton(interaction: ButtonInteraction) {
  const allSessions = (global as any).lfgSessions || {};
  const session = allSessions[interaction.message.id];

  if (!session) {
    return interaction.reply({ content: '❌ Esta lobby ya expiró o no está activa.', ephemeral: true });
  }

  let players: string[] = session.players;

  if (interaction.customId === 'lfg_cancel') {
    if (interaction.user.id !== session.hostId) {
      return interaction.reply({ content: '❌ Solo el creador puede cerrar la lobby.', ephemeral: true });
    }
    delete allSessions[interaction.message.id];
    await interaction.message.delete().catch(() => {});
    return interaction.reply({ content: '🗑️ Lobby eliminada.', ephemeral: true });
  }

  if (interaction.customId === 'lfg_join') {
    if (players.includes(interaction.user.id)) return interaction.reply({ content: '⚠️ Ya estás anotado.', ephemeral: true });
    if (players.length >= session.max_slots) return interaction.reply({ content: '❌ La lobby está llena.', ephemeral: true });
    players.push(interaction.user.id);
  }

  if (interaction.customId === 'lfg_leave') {
    if (interaction.user.id === session.hostId) return interaction.reply({ content: '⚠️ Eres el anfitrión.', ephemeral: true });
    if (!players.includes(interaction.user.id)) return interaction.reply({ content: '⚠️ No estás en la lista.', ephemeral: true });
    players = players.filter(id => id !== interaction.user.id);
  }

  session.players = players;
  const isFull = players.length >= session.max_slots;
  const updatedEmbed = buildLfgEmbed(session.game, session.mode, session.hostId, players, session.max_slots, session.voiceChannelId);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('lfg_join').setLabel(isFull ? 'Llena' : 'Unirme').setStyle(ButtonStyle.Success).setDisabled(isFull),
    new ButtonBuilder().setCustomId('lfg_leave').setLabel('Salir').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('lfg_cancel').setLabel('Cerrar').setStyle(ButtonStyle.Danger)
  );

  await interaction.update({ embeds: [updatedEmbed], components: [row] });

  if (isFull && interaction.customId === 'lfg_join') {
    const mentions = players.map(id => `<@${id}>`).join(' ');
    await interaction.followUp({ content: `🎉 **¡Squad completa para ${session.game}!** ${mentions}` });
  }
}