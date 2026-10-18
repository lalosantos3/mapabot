import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN!,
  CLIENT_ID: process.env.CLIENT_ID!,
  GUILD_ID: process.env.GUILD_ID || '1166810499950837851',

  BAD_WORDS: ['estafa', 'free nitro', 'steamgift', 'hack'],

  ANTIRAID: {
    JOIN_THRESHOLD: 6,
    TIME_WINDOW_MS: 10000,
    MIN_ACCOUNT_DAYS: 3
  },

  NAMES: {
    ROLES: {
      ADMIN: '👑 │ Administrador',
      STAFF: '🔧 │ Mapache Chambeador',
      VERIFIED: '🦝 │ Mapachin',
      LOL: '⚔️ │ League of Legends',
      DBD: '💀 │ Dead by Daylight',
      FORTNITE: '🪓 │ Fortnite',
      MINECRAFT: '⛏️ │ Minecraft',
      OTROS: '🎲 │ Otros Juegos',
      ANUNCIOS: '📢 │ Anuncios',
      EVENTOS: '🎉 │ Eventos & Dinámicas'
    },
    CHANNELS: {
      VERIFICATE: '🪪・verificate',
      ELIGE_ROLES: '🎭・elige-tus-roles',
      BIENVENIDAS: '👋・bienvenidas',
      ANUNCIOS: '📢・anuncios-mapache',
      ARMAR_PARTIDA: '🎮・armar-partida',
      CREAR_SALA: '➕ ➔ Crear Sala',
      CREAR_TICKET: '🎫・crear-ticket',
      MOD_ONLY: '👮・moderator-only',
      MOD_LOGS: '📋・mod-logs',
      MSG_LOGS: '💬・mensajes-logs',
      VOZ_LOGS: '🔊・voz-logs',
      CAT_VOZ: '🎤 ➔ CHISMEANDO ANDO',
      CAT_SOPORTE: '💻 ➔ SOPORTE & AYUDA'
    }
  }
};