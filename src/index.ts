import { Client, GatewayIntentBits, Partials, ActivityType } from 'discord.js';
import { CONFIG } from './config';
import { handleVerifyButton, handleRoleMenu, handleSetupSelector } from './modules/panels';
import { showTicketModal, handleTicketModalSubmit, handleTicketButtons, handleTicketUserModal } from './modules/tickets';
import { handleVoiceUpdate, handleVoiceControlButton, handleVoiceModals, cleanupOrphanVoiceChannels } from './modules/tempVoice';
import { handleWelcomeAndAntiRaid, handleAutoMod, handleMessageDelete, handleMessageUpdate } from './modules/logsAndAutomod';
import { handleSlashCommand } from './modules/moderation';
import { handleLfgButton, handleLfgModalSubmit } from './modules/lfg';
import { handleGiveawayButton, startGiveawayTicker } from './modules/events';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

client.once('ready', async () => {
  console.log(`🦝 MapaBot activo como ${client.user?.tag}`);
  client.user?.setActivity('MotoMapaches 🦝', { type: ActivityType.Watching });
  await cleanupOrphanVoiceChannels(client);
  startGiveawayTicker(client);
});

client.on('guildMemberAdd', handleWelcomeAndAntiRaid);
client.on('voiceStateUpdate', handleVoiceUpdate);
client.on('messageCreate', handleAutoMod);
client.on('messageDelete', handleMessageDelete);
client.on('messageUpdate', handleMessageUpdate);

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) await handleSlashCommand(interaction);
    else if (interaction.isButton()) {
      const id = interaction.customId;
      if (id === 'btn_verify') await handleVerifyButton(interaction);
      else if (id === 'btn_open_ticket') await showTicketModal(interaction);
      else if (['btn_claim_ticket', 'btn_add_user_ticket', 'btn_close_ticket'].includes(id)) await handleTicketButtons(interaction);
      else if (id.startsWith('vc_')) await handleVoiceControlButton(interaction);
      else if (id.startsWith('lfg_')) await handleLfgButton(interaction);
      else if (id === 'gw_enter') await handleGiveawayButton(interaction);
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'menu_autoroles') await handleRoleMenu(interaction);
      else if (interaction.customId === 'setup_selector') await handleSetupSelector(interaction);
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_create_ticket') await handleTicketModalSubmit(interaction);
      else if (interaction.customId === 'modal_ticket_user') await handleTicketUserModal(interaction);
      else if (interaction.customId.startsWith('modal_vc_')) await handleVoiceModals(interaction);
      else if (interaction.customId === 'modal_armar_partida') await handleLfgModalSubmit(interaction);
    }
  } catch (err) {
    console.error('Error:', err);
  }
});

client.login(CONFIG.TOKEN);