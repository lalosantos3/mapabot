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
  ChannelType
} from 'discord.js';
import { CONFIG } from '../config';
import { GuildResolver } from '../utils/resolver';
import { db } from '../database';

export async function deployAllPanels(guild: Guild) {
  // 1. Panel de Verificación (Busca o crea automáticamente el canal)
  let verifChannel = GuildResolver.getTextChannel(guild, CONFIG.NAMES.CHANNELS.VERIFICATE);
  if (!verifChannel) {
    verifChannel = guild.channels.cache.find(c => c.name.includes('verific') && c.isTextBased()) as any;
  }
  if (!verifChannel) {
    verifChannel = await guild.channels.create({
      name: 'verificacion',
      type: ChannelType.GuildText
    });
  }

  const verifEmbed = new EmbedBuilder()
    .setTitle('🪪 Verificación Oficial')
    .setDescription(
      '¡Bienvenido al servidor!\n\n' +
      '1. Lee detenidamente las reglas de convivencia.\n' +
      '2. Haz clic en el botón de abajo para verificarte y obtener acceso completo.'
    )
    .setColor(0x2ECC71);

  const verifBtn = new ButtonBuilder()
    .setCustomId('btn_verify')
    .setLabel('Aceptar reglas y verificarme')
    .setEmoji('🦝')
    .setStyle(ButtonStyle.Success);

  await verifChannel.send({
    embeds: [verifEmbed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(verifBtn)]
  });

  // 2. Panel de Autoroles (Busca o crea automáticamente el canal)
  let rolesChannel = GuildResolver.getTextChannel(guild, CONFIG.NAMES.CHANNELS.ELIGE_ROLES);
  if (!rolesChannel) {
    rolesChannel = guild.channels.cache.find(c => c.name.includes('rol') && c.isTextBased()) as any;
  }
  if (!rolesChannel) {
    rolesChannel = await guild.channels.create({
      name: 'roles',
      type: ChannelType.GuildText
    });
  }

  const rolesEmbed = new EmbedBuilder()
    .setTitle('🎭 Selección de Roles y Notificaciones')
    .setDescription('Selecciona en el menú desplegable los roles o notificaciones que deseas recibir.')
    .setColor(0x9B59B6);

  // Intentamos mapear los roles configurados; si no existen en este servidor, creamos un menú genérico o con los que encuentre
  const roleMappings = [
    { key: CONFIG.NAMES.ROLES.LOL, label: 'League of Legends', emoji: '⚔️', desc: 'Partidas y equipo' },
    { key: CONFIG.NAMES.ROLES.DBD, label: 'Dead by Daylight', emoji: '💀', desc: 'Supervivientes y asesinos' },
    { key: CONFIG.NAMES.ROLES.FORTNITE, label: 'Fortnite', emoji: '🪓', desc: 'Battle Royale' },
    { key: CONFIG.NAMES.ROLES.MINECRAFT, label: 'Minecraft', emoji: '⛏️', desc: 'Survival y construcciones' },
    { key: CONFIG.NAMES.ROLES.OTROS, label: 'Otros Juegos', emoji: '🎲', desc: 'Variedad' },
    { key: CONFIG.NAMES.ROLES.ANUNCIOS, label: 'Anuncios', emoji: '📢', desc: 'Avisos importantes' },
    { key: CONFIG.NAMES.ROLES.EVENTOS, label: 'Eventos & Dinámicas', emoji: '🎉', desc: 'Torneos y sorteos' }
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

  // Si el servidor actual no tiene creados esos roles de la plantilla, agregamos una opción genérica para evitar que falle
  if (options.length === 0) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel('Notificaciones Generales')
        .setValue('general_notif')
        .setEmoji('🔔')
        .setDescription('Recibir avisos del servidor')
    );
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId('menu_autoroles')
    .setPlaceholder('Haz clic aquí para elegir tus roles...')
    .setMinValues(0)
    .setMaxValues(options.length)
    .addOptions(options);

  await rolesChannel.send({
    embeds: [rolesEmbed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)]
  });

  // 3. Panel de Tickets (Busca o crea automáticamente el canal)
  let ticketChannel = GuildResolver.getTextChannel(guild, CONFIG.NAMES.CHANNELS.CREAR_TICKET);
  if (!ticketChannel) {
    ticketChannel = guild.channels.cache.find(c => c.name.includes('ticket') && c.isTextBased()) as any;
  }
  if (!ticketChannel) {
    ticketChannel = await guild.channels.create({
      name: 'soporte-tickets',
      type: ChannelType.GuildText
    });
  }

  const ticketEmbed = new EmbedBuilder()
    .setTitle('💻 Centro de Soporte')
    .setDescription(
      '¿Tienes algún problema en el servidor o necesitas ayuda?\n\n' +
      'Pulsa el botón de abajo para completar el formulario y abrir un canal privado con el Staff.'
    )
    .setColor(0xE67E22);

  const ticketBtn = new ButtonBuilder()
    .setCustomId('btn_open_ticket')
    .setLabel('Crear Ticket de Soporte')
    .setEmoji('🎫')
    .setStyle(ButtonStyle.Primary);

  await ticketChannel.send({
    embeds: [ticketEmbed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(ticketBtn)]
  });
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
  let verifiedRole = GuildResolver.getRole(interaction.guild, CONFIG.NAMES.ROLES.VERIFIED);
  if (!verifiedRole) {
    // Si no encuentra el rol exacto de la plantilla, busca uno genérico llamado "Miembro" o "Verificado"
    verifiedRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase().includes('verific') || r.name.toLowerCase().includes('miembro'));
  }

  if (!verifiedRole) {
    return interaction.reply({ content: '❌ No se encontró un rol de verificación en este servidor.', ephemeral: true });
  }

  if (member.roles.cache.has(verifiedRole.id)) {
    return interaction.reply({ content: '✅ Ya te encuentras verificado.', ephemeral: true });
  }

  await member.roles.add(verifiedRole);
  await interaction.reply({ content: '🎉 ¡Te has verificado correctamente!', ephemeral: true });
}

export async function handleRoleMenu(interaction: StringSelectMenuInteraction) {
  if (!interaction.guild || !interaction.member) return;
  await interaction.deferReply({ ephemeral: true });

  const member = interaction.member as GuildMember;
  const selectedRoleIds = interaction.values;

  // Si seleccionaron la opción genérica de respaldo
  if (selectedRoleIds.includes('general_notif')) {
    return interaction.editReply({ content: '✅ Preferencias guardadas.' });
  }

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