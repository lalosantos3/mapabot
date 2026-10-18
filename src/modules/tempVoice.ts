import {
  VoiceState,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  VoiceChannel,
  Client
} from 'discord.js';
import { CONFIG } from '../config';
import { GuildResolver } from '../utils/resolver';
import { db } from '../database';

export async function cleanupOrphanVoiceChannels(client: Client) {
  const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
  if (!guild) return;

  const rows = db.getAllTempVoices();
  for (const row of rows) {
    const channel = guild.channels.cache.get(row.channel_id) as VoiceChannel | undefined;
    if (!channel || channel.members.size === 0) {
      if (channel) await channel.delete('Limpieza de inicio: Sala temporal vacía').catch(() => {});
      db.deleteTempVoice(row.channel_id);
    }
  }
}

export async function handleVoiceUpdate(oldState: VoiceState, newState: VoiceState) {
  const guild = newState.guild;
  const member = newState.member || oldState.member;
  if (!member) return;

  const vozLogs = GuildResolver.getTextChannel(guild, CONFIG.NAMES.CHANNELS.VOZ_LOGS);
  if (vozLogs) {
    if (!oldState.channelId && newState.channelId) {
      const embed = new EmbedBuilder()
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
        .setDescription(`🟢 **Conectado a voz:** <#${newState.channelId}>`)
        .setColor(0x2ECC71)
        .setTimestamp();
      await vozLogs.send({ embeds: [embed] }).catch(() => {});
    } else if (oldState.channelId && !newState.channelId) {
      const embed = new EmbedBuilder()
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
        .setDescription(`🔴 **Desconectado de voz:** \`${oldState.channel?.name || 'Sala temporal'}\``)
        .setColor(0xE74C3C)
        .setTimestamp();
      await vozLogs.send({ embeds: [embed] }).catch(() => {});
    }
  }

  const createHub = GuildResolver.getVoiceChannel(guild, CONFIG.NAMES.CHANNELS.CREAR_SALA);
  if (createHub && newState.channelId === createHub.id) {
    const category = GuildResolver.getCategory(guild, CONFIG.NAMES.CHANNELS.CAT_VOZ);
    const verifiedRole = GuildResolver.getRole(guild, CONFIG.NAMES.ROLES.VERIFIED);

    const newVoice = await guild.channels.create({
      name: `🦝 ➔ Sala de ${member.user.username}`,
      type: ChannelType.GuildVoice,
      parent: category?.id || createHub.parentId,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        ...(verifiedRole
          ? [{
              id: verifiedRole.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
            }]
          : []),
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers
          ]
        }
      ]
    });

    db.setTempVoice(newVoice.id, member.id, 0);
    await newState.setChannel(newVoice).catch(() => {});

    const dashEmbed = new EmbedBuilder()
      .setTitle('🎛️ Panel de Control de Sala Temporal')
      .setDescription(
        `👑 **Propietario:** <@${member.id}>\n\n` +
        `Usa los botones para administrar tu sala:\n` +
        `• **✏️ Renombrar**\n• **👥 Límite**\n• **🔒 Bloquear/Abrir**\n• **👑 Reclamar**`
      )
      .setColor(0x3498DB);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('vc_rename').setLabel('Renombrar').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vc_limit').setLabel('Límite').setEmoji('👥').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('vc_lock').setLabel('Bloquear / Abrir').setEmoji('🔒').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('vc_claim').setLabel('Reclamar').setEmoji('👑').setStyle(ButtonStyle.Success)
    );

    await newVoice.send({ content: `<@${member.id}>`, embeds: [dashEmbed], components: [row] }).catch(() => {});
  }

  if (oldState.channelId) {
    const isTemp = db.getTempVoice(oldState.channelId);
    if (isTemp && oldState.channel && oldState.channel.members.size === 0) {
      db.deleteTempVoice(oldState.channelId);
      await oldState.channel.delete('Sala temporal vacía').catch(() => {});
    }
  }
}

export async function handleVoiceControlButton(interaction: ButtonInteraction) {
  const channel = interaction.channel as VoiceChannel;
  const guild = interaction.guild;
  if (!channel || !guild) return;

  const voiceData = db.getTempVoice(channel.id);
  if (!voiceData) {
    return interaction.reply({ content: '❌ Este canal no está registrado como una sala temporal activa.', ephemeral: true });
  }

  if (interaction.customId === 'vc_claim') {
    if (interaction.user.id === voiceData.ownerId) {
      return interaction.reply({ content: '👑 Ya eres el propietario de esta sala.', ephemeral: true });
    }
    if (channel.members.has(voiceData.ownerId)) {
      return interaction.reply({ content: '❌ El propietario actual todavía está dentro de la sala.', ephemeral: true });
    }

    db.updateTempVoiceOwner(channel.id, interaction.user.id);
    await channel.permissionOverwrites.edit(interaction.user.id, {
      ManageChannels: true,
      MoveMembers: true,
      MuteMembers: true
    });
    return interaction.reply({ content: `👑 <@${interaction.user.id}> ha reclamado la propiedad de la sala.` });
  }

  if (interaction.user.id !== voiceData.ownerId) {
    return interaction.reply({ content: '❌ Solo el propietario puede usar estos controles.', ephemeral: true });
  }

  if (interaction.customId === 'vc_rename') {
    const modal = new ModalBuilder().setCustomId('modal_vc_rename').setTitle('Renombrar Sala de Voz');
    const input = new TextInputBuilder()
      .setCustomId('input_vc_name')
      .setLabel('Nuevo nombre')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(40)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'vc_limit') {
    const modal = new ModalBuilder().setCustomId('modal_vc_limit').setTitle('Límite de Usuarios');
    const input = new TextInputBuilder()
      .setCustomId('input_vc_limit')
      .setLabel('Cantidad máxima (0 a 99)')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(2)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'vc_lock') {
    const verifiedRole = GuildResolver.getRole(guild, CONFIG.NAMES.ROLES.VERIFIED);
    const targetId = verifiedRole ? verifiedRole.id : guild.id;
    const newLockState = voiceData.locked === 1 ? 0 : 1;

    await channel.permissionOverwrites.edit(targetId, {
      Connect: newLockState === 0
    });

    db.updateTempVoiceLock(channel.id, newLockState);
    return interaction.reply({
      content: newLockState === 1 ? '🔒 Sala bloqueada.' : '🔓 Sala abierta.',
      ephemeral: true
    });
  }
}

export async function handleVoiceModals(interaction: ModalSubmitInteraction) {
  const channel = interaction.channel as VoiceChannel;
  if (!channel) return;

  if (interaction.customId === 'modal_vc_rename') {
    const newName = interaction.fields.getTextInputValue('input_vc_name').trim();
    await channel.setName(`🦝 ➔ ${newName}`);
    return interaction.reply({ content: `✅ Sala renombrada a **🦝 ➔ ${newName}**.`, ephemeral: true });
  }

  if (interaction.customId === 'modal_vc_limit') {
    const rawLimit = parseInt(interaction.fields.getTextInputValue('input_vc_limit').trim(), 10);
    if (isNaN(rawLimit) || rawLimit < 0 || rawLimit > 99) {
      return interaction.reply({ content: '❌ Ingresa un número válido entre 0 y 99.', ephemeral: true });
    }
    await channel.setUserLimit(rawLimit);
    return interaction.reply({ content: `✅ Límite actualizado a **${rawLimit === 0 ? 'Sin límite' : rawLimit}**.`, ephemeral: true });
  }
}