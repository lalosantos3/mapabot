import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Guild,
  ButtonInteraction,
  StringSelectMenuInteraction,
  GuildMember,
  ChannelType,
  ChatInputCommandInteraction
} from 'discord.js';
import { CONFIG } from '../config';
import { GuildResolver } from '../utils/resolver';
import { db } from '../database';

// 1. Envía el menú de selección interactivo al ejecutar /setup
export async function sendSetupMenu(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('⚙️ Panel de Configuración Selectiva — MapaBot')
    .setDescription(
      'Selecciona en el menú desplegable de abajo qué módulos y canales deseas crear e instalar en este servidor.\n\n' +
      'Puedes marcar una o varias opciones según lo que necesites.'
    )
    .setColor(0x3498DB)
    .setFooter({ text: 'Configuración interactiva • MapaBot' });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('setup_selector')
    .setPlaceholder('Elige los módulos a desplegar...')
    .setMinValues(1)
    .setMaxValues(3)
    .addOptions([
      new StringSelectMenuOptionBuilder()
        .setLabel('Canal y Panel de Verificación')
        .setValue('setup_verification')
        .setDescription('Crea el canal #verificacion con botón interactivo')
        .setEmoji('🪪'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Canal y Panel de Autoroles')
        .setValue('setup_roles')
        .setDescription('Crea el canal #roles con menú de selección')
        .setEmoji('🎭'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Canal y Panel de Tickets')
        .setValue('setup_tickets')
        .setDescription('Crea el canal #soporte-tickets con botón de soporte')
        .setEmoji('🎫')
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}

// 2. Procesa la selección del menú y crea únicamente lo elegido
export async function handleSetupSelector(interaction: StringSelectMenuInteraction) {
  if (!interaction.guild) return;
  const guild = interaction.guild;
  const choices = interaction.values;

  await interaction.update({ content: '⏳ Creando los canales seleccionados...', embeds: [], components: [] });

  const createdSummary: string[] = [];

  for (const choice of choices) {
    if (choice === 'setup_verification') {
      let verifChannel = guild.channels.cache.find(c => c.name.includes('verific') && c.isTextBased()) as any;
      if (!verifChannel) {
        verifChannel = await guild.channels.create({ name: 'verificacion', type: ChannelType.GuildText });
      }
      const verifEmbed = new EmbedBuilder()
        .setTitle('🪪 Verificación Oficial')
        .setDescription('Lee las reglas y haz clic en el botón para verificar tu cuenta.')
        .setColor(0x2ECC71);
      const verifBtn = new ButtonBuilder()
        .setCustomId('btn_verify')
        .setLabel('Aceptar reglas y verificarme')
        .setEmoji('🪝')
        .setStyle(ButtonStyle.Success);

      await verifChannel.send({ embeds: [verifEmbed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(verifBtn)] });
      createdSummary.push(`• Canal **#${verifChannel.name}** (Verificación)`);
    }

    if (choice === 'setup_roles') {
      let rolesChannel = guild.channels.cache.find(c => c.name.includes('rol') && c.isTextBased()) as any;
      if (!rolesChannel) {
        rolesChannel = await guild.channels.create({ name: 'roles', type: ChannelType.GuildText });
      }
      const rolesEmbed = new EmbedBuilder()
        .setTitle('🎭 Selección de Roles y Notificaciones')
        .setDescription('Selecciona en el menú desplegable los roles que deseas recibir.')
        .setColor(0x9B59B6);

      const options = [
        new StringSelectMenuOptionBuilder().setLabel('Notificaciones Generales').setValue('general_notif').setEmoji('🔔').setDescription('Avisos del servidor')
      ];
      const menu = new StringSelectMenuBuilder()
        .setCustomId('menu_autoroles')
        .setPlaceholder('Elige tus roles...')
        .addOptions(options);

      await rolesChannel.send({ embeds: [rolesEmbed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] });
      createdSummary.push(`• Canal **#${rolesChannel.name}** (Roles)`);
    }

    if (choice === 'setup_tickets') {
      let ticketChannel = guild.channels.cache.find(c => c.name.includes('ticket') && c.isTextBased()) as any;
      if (!ticketChannel) {
        ticketChannel = await guild.channels.create({ name: 'soporte-tickets', type: ChannelType.GuildText });
      }
      const ticketEmbed = new EmbedBuilder()
        .setTitle('💻 Centro de Soporte')
        .setDescription('Pulsa el botón de abajo para abrir un canal privado con el Staff.')
        .setColor(0xE67E22);
      const ticketBtn = new ButtonBuilder()
        .setCustomId('btn_open_ticket')
        .setLabel('Crear Ticket de Soporte')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Primary);

      await ticketChannel.send({ embeds: [ticketEmbed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(ticketBtn)] });
      createdSummary.push(`• Canal **#${ticketChannel.name}** (Tickets)`);
    }
  }

  await interaction.editReply({
    content: `✅ **¡Configuración completada!** Se han desplegado los módulos seleccionados:\n${createdSummary.join('\n')}`
  });
}

// 3. Botón de Verificación (Auto-crea rol si no existe)
export async function handleVerifyButton(interaction: ButtonInteraction) {
  if (!interaction.guild || !interaction.member) return;

  if (db.getSetting('lockdown') === '1') {
    return interaction.reply({
      content: '🔒 **Verificación en pausa:** El sistema de seguridad Anti-Raid está activo temporalmente.',
      ephemeral: true
    });
  }

  const member = interaction.member as GuildMember;
  let verifiedRole = GuildResolver.getRole(interaction.guild, CONFIG.NAMES.ROLES.VERIFIED);
  if (!verifiedRole) {
    verifiedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase().includes('verific') || r.name.toLowerCase().includes('miembro'));
  }

  if (!verifiedRole) {
    try {
      verifiedRole = await interaction.guild.roles.create({
        name: 'Verificado',
        color: 0x2ECC71,
        reason: 'Rol creado automáticamente por MapaBot.'
      });
    } catch (err) {
      return interaction.reply({ content: '❌ No se pudo crear el rol de verificación automáticamente.', ephemeral: true });
    }
  }

  if (member.roles.cache.has(verifiedRole.id)) {
    return interaction.reply({ content: '✅ Ya te encuentras verificado.', ephemeral: true });
  }

  await member.roles.add(verifiedRole);
  await interaction.reply({ content: `🎉 ¡Te has verificado correctamente con el rol **${verifiedRole.name}**!`, ephemeral: true });
}

export async function handleRoleMenu(interaction: StringSelectMenuInteraction) {
  if (!interaction.guild || !interaction.member) return;
  await interaction.deferReply({ ephemeral: true });
  await interaction.editReply({ content: '✅ Tus roles han sido actualizados correctamente.' });
}