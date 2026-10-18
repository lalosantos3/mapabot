import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  Client,
  TextChannel
} from 'discord.js';
import { CONFIG } from '../config';
import { GuildResolver } from '../utils/resolver';
import { db } from '../database';

export async function handleGiveawayCommand(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) return;

  const prize = interaction.options.getString('premio', true);
  const minutes = interaction.options.getInteger('minutos', true);
  const winnersCount = interaction.options.getInteger('ganadores') || 1;
  const endTime = Date.now() + minutes * 60 * 1000;
  const endTimestamp = Math.floor(endTime / 1000);

  const eventosRole = GuildResolver.getRole(guild, CONFIG.NAMES.ROLES.EVENTOS);

  const embed = new EmbedBuilder()
    .setTitle(`🎉 ¡SORTEO OFICIAL: ${prize}!`)
    .setDescription(
      `Haz clic en el botón Participar para entrar.\n\n` +
      `Ganadores: ${winnersCount}\n` +
      `Termina: <t:${endTimestamp}:R>\n` +
      `Participantes: 0`
    )
    .setColor(0xF1C40F)
    .setTimestamp();

  const btn = new ButtonBuilder()
    .setCustomId('gw_enter')
    .setLabel('Participar (0)')
    .setStyle(ButtonStyle.Primary);

  await interaction.reply({ content: '✅ Sorteo creado.', ephemeral: true });

  const channel = interaction.channel as TextChannel;
  const msg = await channel.send({
    content: eventosRole ? `<@&${eventosRole.id}> ¡Nuevo sorteo!` : '🎉 ¡Nuevo sorteo!',
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(btn)]
  });

  db.saveGiveaway(msg.id, channel.id, prize, winnersCount, endTime);
}

export async function handleGiveawayButton(interaction: ButtonInteraction) {
  const gw = db.getGiveaway(interaction.message.id);
  if (!gw || gw.ended) {
    return interaction.reply({ content: '❌ Este sorteo ya finalizó.', ephemeral: true });
  }

  const { participants, joined } = db.toggleGiveawayParticipant(interaction.message.id, interaction.user.id);
  const endTimestamp = Math.floor(gw.endTime / 1000);

  const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setDescription(
    `Haz clic en el botón Participar para entrar.\n\n` +
    `Ganadores: ${gw.winnersCount}\n` +
    `Termina: <t:${endTimestamp}:R>\n` +
    `Participantes: ${participants.length}`
  );

  const btn = new ButtonBuilder()
    .setCustomId('gw_enter')
    .setLabel(`Participar (${participants.length})`)
    .setStyle(ButtonStyle.Primary);

  await interaction.update({
    embeds: [updatedEmbed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(btn)]
  });

  await interaction.followUp({
    content: joined ? '✅ ¡Ya estás participando!' : '➖ Saliste del sorteo.',
    ephemeral: true
  });
}

export function startGiveawayTicker(client: Client) {
  setInterval(async () => {
    const now = Date.now();
    const expired = db.getExpiredGiveaways(now);

    for (const gw of expired as any[]) {
      db.endGiveaway(gw.message_id);

      const channel = client.channels.cache.get(gw.channelId) as TextChannel | undefined;
      if (!channel) continue;

      const msg = await channel.messages.fetch(gw.message_id).catch(() => null);
      const participants = gw.participants;

      let winnersText = 'Nadie participó';
      const winners: string[] = [];

      if (participants.length > 0) {
        const pool = [...participants];
        while (winners.length < gw.winnersCount && pool.length > 0) {
          const rand = Math.floor(Math.random() * pool.length);
          winners.push(pool.splice(rand, 1)[0]);
        }
        winnersText = winners.map(id => `<@${id}>`).join(', ');
      }

      if (msg) {
        const endEmbed = new EmbedBuilder()
          .setTitle(`🎊 SORTEO FINALIZADO: ${gw.prize}`)
          .setDescription(`Ganador(es): ${winnersText}\nParticipantes: ${participants.length}`)
          .setColor(0x2ECC71);

        await msg.edit({ embeds: [endEmbed], components: [] }).catch(() => {});
      }

      if (winners.length > 0) {
        await channel.send(`🎉 ¡Felicidades ${winnersText}! Ganaste **${gw.prize}**. Abre un ticket para reclamarlo.`);
      }
    }
  }, 15_000);
}

export async function handlePollCommand(interaction: ChatInputCommandInteraction) {
  const question = interaction.options.getString('pregunta', true);
  const rawOptions = interaction.options.getString('opciones', true);
  const options = rawOptions.split(',').map(o => o.trim()).filter(Boolean).slice(0, 9);

  if (options.length < 2) return interaction.reply({ content: '❌ Pon al menos 2 opciones.', ephemeral: true });

  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
  const desc = options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n\n');

  const embed = new EmbedBuilder().setTitle(`📊 Encuesta: ${question}`).setDescription(desc).setColor(0x3498DB);

  await interaction.reply({ content: '✅ Encuesta publicada.', ephemeral: true });
  const channel = interaction.channel as TextChannel;
  const pollMsg = await channel.send({ embeds: [embed] });

  for (let i = 0; i < options.length; i++) {
    await pollMsg.react(emojis[i]).catch(() => {});
  }
}