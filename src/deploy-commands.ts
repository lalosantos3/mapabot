import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { CONFIG } from './config';

const commands = [
  new SlashCommandBuilder().setName('setup').setDescription('Despliega paneles').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('armar-partida')
    .setDescription('Crea lobby LFG')
    .addStringOption(opt => opt.setName('juego').setDescription('Juego').setRequired(true).addChoices(
      { name: 'LoL', value: 'League of Legends' },
      { name: 'DbD', value: 'Dead by Daylight' },
      { name: 'Fortnite', value: 'Fortnite' },
      { name: 'Minecraft', value: 'Minecraft' },
      { name: 'Otros', value: 'Otros Juegos' }
    ))
    .addStringOption(opt => opt.setName('modo').setDescription('Modo').setRequired(true))
    .addIntegerOption(opt => opt.setName('faltan').setDescription('Faltan').setRequired(true)),
  new SlashCommandBuilder().setName('sorteo').setDescription('Crea sorteo').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt => opt.setName('premio').setDescription('Premio').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutos').setDescription('Minutos').setRequired(true))
    .addIntegerOption(opt => opt.setName('ganadores').setDescription('Ganadores')),
  new SlashCommandBuilder().setName('encuesta').setDescription('Crea encuesta').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt => opt.setName('pregunta').setDescription('Pregunta').setRequired(true))
    .addStringOption(opt => opt.setName('opciones').setDescription('Opciones separadas por coma').setRequired(true)),
  new SlashCommandBuilder().setName('lockdown').setDescription('Anti-raid').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption(opt => opt.setName('activar').setDescription('Estado').setRequired(true)),
  new SlashCommandBuilder().setName('clear').setDescription('Borra mensajes').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad').setRequired(true)),
  new SlashCommandBuilder().setName('kick').setDescription('Expulsa').setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt => opt.setName('usuario').setDescription('User').setRequired(true)),
  new SlashCommandBuilder().setName('ban').setDescription('Banea').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt => opt.setName('usuario').setDescription('User').setRequired(true)),
  new SlashCommandBuilder().setName('timeout').setDescription('Mute').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('usuario').setDescription('User').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutos').setDescription('Mins').setRequired(true)),
  new SlashCommandBuilder().setName('anuncio').setDescription('Anuncio').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt => opt.setName('titulo').setDescription('Titulo').setRequired(true))
    .addStringOption(opt => opt.setName('mensaje').setDescription('Mensaje').setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);

(async () => {
  await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: commands });
  console.log('✅ Comandos registrados.');
})();