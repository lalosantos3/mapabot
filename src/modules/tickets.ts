import {
  ButtonInteraction,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  TextChannel,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  GuildMember
} from 'discord.js';
import * as discordTranscripts from 'discord-html-transcripts';
import { CONFIG } from '../config';
import { GuildResolver } from '../utils/resolver';
import { db } from '../database';

export async function showTicketModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder().setCustomId('modal_create_ticket').setTitle('Crear Ticket de Soporte');

  const subjectInput = new TextInputBuilder()
    .setCustomId('ticket_subject')
    .setLabel('Asunto o Categoría')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80)
    .setRequired(true);

  const descInput = new TextInputBuilder()
    .setCustomId('ticket_desc')
    .setLabel('Describe tu caso')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
  );

  await interaction.showModal(modal);
}

export async function handleTicketModalSubmit(interaction: ModalSubmitInteraction) {
  const guild = interaction.guild;
  if (!guild) return;

  await interaction.deferReply({ ephemeral: true });

  const subject = interaction.fields.getTextInputValue('ticket_subject');
  const description = interaction.fields.getTextInputValue('ticket_desc');

  const existing = db.getTicketByOwner(interaction.user.id);
  if (existing && guild.channels.cache.has(existing[0])) {
    return interaction.editReply({ content: `⚠️ Ya tienes un ticket activo en <#${existing[0]}>.` });
  }

  const cleanUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
  const category = GuildResolver.getCategory(guild, CONFIG.NAMES.CHANNELS.CAT_SOPORTE);
  const staffRole = GuildResolver.getRole(guild, CONFIG.NAMES.ROLES.STAFF);
  const adminRole = GuildResolver.getRole(guild, CONFIG.NAMES.ROLES.ADMIN);

  const overwrites: any[] = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory]
    }
  ];

  if (staffRole) overwrites.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  if (adminRole) overwrites.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

  const ticketChannel = await guild.channels.create({
    name: `ticket-${cleanUsername}`,
    type: ChannelType.GuildText,
    parent: category?.id,
    topic: `Usuario: ${interaction.user.tag} | Asunto: ${subject}`,
    permissionOverwrites: overwrites
  });

  db.setTicket(ticketChannel.id, interaction.user.id, null, subject);

  const embed = new EmbedBuilder()
    .setTitle(`🎫 Ticket: ${subject}`)
    .setDescription(`**Abierto por:** <@${interaction.user.id}>\n\n**Descripción:**\n>>> ${description}`)
    .addFields({ name: '🙋‍♂️ Atendido por', value: '*Pendiente de reclamo*' })
    .setColor(0x3498DB)
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('btn_claim_ticket').setLabel('Reclamar').setEmoji('🙋‍♂️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_add_user_ticket').setLabel('Agregar/Quitar').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_close_ticket').setLabel('Cerrar Transcript').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );

  await ticketChannel.send({
    content: `${staffRole ? `<@&${staffRole.id}>` : ''} Nuevo ticket de soporte`,
    embeds: [embed],
    components: [row]
  });

  await interaction.editReply({ content: `✅ Tu ticket fue creado en ${ticketChannel}.` });
}

export async function handleTicketButtons(interaction: ButtonInteraction) {
  const channel = interaction.channel as TextChannel;
  const guild = interaction.guild;
  const member = interaction.member as GuildMember;
  if (!channel || !guild || !member) return;

  const ticket = db.getTicket(channel.id);
  if (!ticket) return;

  const staffRole = GuildResolver.getRole(guild, CONFIG.NAMES.ROLES.STAFF);
  const adminRole = GuildResolver.getRole(guild, CONFIG.NAMES.ROLES.ADMIN);
  const isStaff =
    (staffRole && member.roles.cache.has(staffRole.id)) ||
    (adminRole && member.roles.cache.has(adminRole.id)) ||
    member.permissions.has(PermissionFlagsBits.Administrator);

  if (interaction.customId === 'btn_claim_ticket') {
    if (!isStaff) return interaction.reply({ content: '❌ Solo el Staff puede reclamar tickets.', ephemeral: true });
    if (ticket.claimedBy) return interaction.reply({ content: `⚠️ Ya está atendido por <@${ticket.claimedBy}>.`, ephemeral: true });

    db.claimTicket(channel.id, interaction.user.id);
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).spliceFields(0, 1, {
      name: '🙋‍♂️ Atendido por',
      value: `<@${interaction.user.id}>`
    });

    await interaction.message.edit({ embeds: [updatedEmbed] });
    return interaction.reply({ content: `🙋‍♂️ <@${interaction.user.id}> ha tomado este ticket.` });
  }

  if (interaction.customId === 'btn_add_user_ticket') {
    if (!isStaff) return interaction.reply({ content: '❌ Solo el Staff puede usar esto.', ephemeral: true });
    const modal = new ModalBuilder().setCustomId('modal_ticket_user').setTitle('Agregar o Quitar Usuario');
    const input = new TextInputBuilder()
      .setCustomId('input_target_user_id')
      .setLabel('ID de Discord del Usuario')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'btn_close_ticket') {
    await interaction.reply({ content: '⏳ Generando transcripción y cerrando ticket...' });

    const transcript = await discordTranscripts.createTranscript(channel, {
      limit: -1,
      filename: `${channel.name}.html`,
      saveImages: true,
      poweredBy: false
    });

    const modLogs = GuildResolver.getTextChannel(guild, CONFIG.NAMES.CHANNELS.MOD_LOGS);
    if (modLogs) {
      const logEmbed = new EmbedBuilder()
        .setTitle('📁 Ticket Finalizado')
        .addFields(
          { name: 'Canal', value: channel.name, inline: true },
          { name: 'Asunto', value: ticket.subject, inline: true },
          { name: 'Creador', value: `<@${ticket.ownerId}>`, inline: true }
        )
        .setColor(0xE67E22)
        .setTimestamp();

      await modLogs.send({ embeds: [logEmbed], files: [transcript] });
    }

    db.deleteTicket(channel.id);
    setTimeout(() => channel.delete('Ticket cerrado').catch(() => {}), 4000);
  }
}

export async function handleTicketUserModal(interaction: ModalSubmitInteraction) {
  const channel = interaction.channel as TextChannel;
  const guild = interaction.guild;
  if (!channel || !guild) return;

  const targetId = interaction.fields.getTextInputValue('input_target_user_id').trim();
  const targetMember = await guild.members.fetch(targetId).catch(() => null);

  if (!targetMember) return interaction.reply({ content: '❌ Miembro no encontrado.', ephemeral: true });

  const currentPerms = channel.permissionOverwrites.cache.get(targetMember.id);
  const canView = currentPerms?.allow.has(PermissionFlagsBits.ViewChannel);

  if (canView) {
    await channel.permissionOverwrites.delete(targetMember.id);
    return interaction.reply({ content: `➖ Se quitó el acceso a <@${targetMember.id}>.` });
  } else {
    await channel.permissionOverwrites.edit(targetMember.id, { ViewChannel: true, SendMessages: true });
    return interaction.reply({ content: `➕ Se agregó a <@${targetMember.id}>.` });
  }
}