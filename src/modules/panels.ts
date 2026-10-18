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
  GuildMember
} from 'discord.js';
import { CONFIG } from '../config';
import { GuildResolver } from '../utils/resolver';
import { db } from '../database';

export async function deployAllPanels(guild: Guild) {
  // 1. Panel de Verificación
  const verifChannel = GuildResolver.getTextChannel(guild, CONFIG.NAMES.CHANNELS.VERIFICATE);
  if (verifChannel) {
    const embed = new EmbedBuilder()
      .setTitle('🪪 Verificación Oficial — MotoMapaches')
      .setDescription(
        '¡Bienvenido a la madriguera! Antes de entrar a los canales generales y de voz:\n\n' +
        '1. Lee detenidamente las reglas en **#📜・reglas-de-convivencia**.\n' +
        '2. Haz clic en el botón de abajo para obtener el rol de **🦝 │ Mapachin**.'
      )
      .setColor(0x2ECC71);

    const btn = new ButtonBuilder()
      .setCustomId('btn_verify')
      .setLabel('Aceptar reglas y verificarme')
      .setEmoji('🦝')
      .setStyle(ButtonStyle.Success);

    await verifChannel.send({
      embeds: [embed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(btn)]
    });
  }

  // 2. Panel de Autoroles
  const rolesChannel = GuildResolver.getTextChannel(guild, CONFIG.NAMES.CHANNELS.ELIGE_ROLES);
  if (rolesChannel) {
    const embed = new EmbedBuilder()
      .setTitle('🎭 Selección de Roles y Notificaciones')
      .setDescription('Selecciona en el menú desplegable tus juegos favoritos para encontrar squad y los avisos que deseas recibir.')
      .setColor(0x9B59B6);

    const roleMappings = [
      { key: CONFIG.NAMES.ROLES.LOL, label: 'League of Legends', emoji: '⚔️', desc: 'Búsqueda de partidas y Clash' },
      { key: CONFIG.NAMES.ROLES.DBD, label: 'Dead by Daylight', emoji: '💀', desc: 'Survive with Friends y Customs' },
      { key: CONFIG.NAMES.ROLES.FORTNITE, label: 'Fortnite', emoji: '🪓', desc: 'Battle Royale, Cero Construcción' },
      { key: CONFIG.NAMES.ROLES.MINECRAFT, label: 'Minecraft', emoji: '⛏️', desc: 'Servidores técnicos, mods y survival' },
      { key: CONFIG.NAMES.ROLES.OTROS, label: 'Otros Juegos', emoji: '🎲', desc: 'Variedad y cooperativos' },
      { key: CONFIG.NAMES.ROLES.ANUNCIOS, label: 'Anuncios', emoji: '📢', desc: 'Avisos importantes del servidor' },
      { key: CONFIG.NAMES.ROLES.EVENTOS, label: 'Eventos & Dinámicas', emoji: '🎉', desc: 'Torneos, sorteos y noches de juegos' }
    ];

    const options: StringSelectMenuOptionBuilder[] = [];
    for (const item of roleMappings) {
      const role = GuildResolver.getRole(guild, item.key);
      if (role) {
        options.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(item.label)
            .setValue(role.id)
            .setEmoji(item.emoji)
            .setDescription(item.desc)
        );
      }
    }

    if (options.length > 0) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId('menu_autoroles')
        .setPlaceholder('Haz clic aquí para elegir o quitar roles...')
        .setMinValues(0)
        .setMaxValues(options.length)
        .addOptions(options);

      await rolesChannel.send({
        embeds: [embed],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)]
      });
    }
  }

  // 3. Panel de Tickets
  const ticketChannel = GuildResolver.getTextChannel(guild, CONFIG.NAMES.CHANNELS.CREAR_TICKET);
  if (ticketChannel) {
    const embed = new EmbedBuilder()
      .setTitle('💻 Centro de Soporte — MotoMapaches')
      .setDescription(
        '¿Tienes algún problema en el servidor, necesitas reportar a un usuario o tienes dudas con algún rol/canal?\n\n' +
        'Pulsa el botón de abajo para completar el formulario y abrir un canal privado con el Staff.'
      )
      .setColor(0xE67E22);

    const btn = new ButtonBuilder()
      .setCustomId('btn_open_ticket')
      .setLabel('Crear Ticket de Soporte')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary);

    await ticketChannel.send({
      embeds: [embed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(btn)]
    });
  }
}

export async function handleVerifyButton(interaction: ButtonInteraction) {
  if (!interaction.guild || !interaction.member) return;

  if (db.getSetting('lockdown') === '1') {
    return interaction.reply({
      content: '🔒 **Verificación en pausa:** El sistema de seguridad Anti-Raid está activo temporalmente.',
      ephemeral: true
    });
  }

  const member = interaction.member as GuildMember;
  const verifiedRole = GuildResolver.getRole(interaction.guild, CONFIG.NAMES.ROLES.VERIFIED);

  if (!verifiedRole) {
    return interaction.reply({ content: '❌ No se encontró el rol Mapachin en el servidor.', ephemeral: true });
  }

  if (member.roles.cache.has(verifiedRole.id)) {
    return interaction.reply({ content: '✅ Ya te encuentras verificado como **Mapachin**.', ephemeral: true });
  }

  await member.roles.add(verifiedRole);
  await interaction.reply({ content: '🎉 ¡Te has verificado correctamente! Bienvenido a **MotoMapaches**.', ephemeral: true });
}

export async function handleRoleMenu(interaction: StringSelectMenuInteraction) {
  if (!interaction.guild || !interaction.member) return;
  await interaction.deferReply({ ephemeral: true });

  const member = interaction.member as GuildMember;
  const selectedRoleIds = interaction.values;

  const managedRoleNames = [
    CONFIG.NAMES.ROLES.LOL,
    CONFIG.NAMES.ROLES.DBD,
    CONFIG.NAMES.ROLES.FORTNITE,
    CONFIG.NAMES.ROLES.MINECRAFT,
    CONFIG.NAMES.ROLES.OTROS,
    CONFIG.NAMES.ROLES.ANUNCIOS,
    CONFIG.NAMES.ROLES.EVENTOS
  ];

  const allManagedRoles = managedRoleNames
    .map(name => GuildResolver.getRole(interaction.guild!, name))
    .filter((r): r is NonNullable<typeof r> => r !== undefined);

  const toAdd: string[] = [];
  const toRemove: string[] = [];

  for (const role of allManagedRoles) {
    if (selectedRoleIds.includes(role.id)) {
      if (!member.roles.cache.has(role.id)) toAdd.push(role.id);
    } else {
      if (member.roles.cache.has(role.id)) toRemove.push(role.id);
    }
  }

  if (toAdd.length > 0) await member.roles.add(toAdd);
  if (toRemove.length > 0) await member.roles.remove(toRemove);

  await interaction.editReply({
    content: `✅ Tus roles han sido actualizados correctamente (${selectedRoleIds.length} seleccionados).`
  });
}