import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'mapabot_data.json');

interface DatabaseSchema {
  tempVoices: Record<string, { ownerId: string; locked: number }>;
  tickets: Record<string, { ownerId: string; claimedBy: string | null; subject: string }>;
  giveaways: Record<string, { channelId: string; prize: string; winnersCount: number; endTime: number; participants: string[]; ended: boolean }>;
  settings: Record<string, string>;
}

function loadDb(): DatabaseSchema {
  if (!fs.existsSync(dbPath)) {
    const initial: DatabaseSchema = { tempVoices: {}, tickets: {}, giveaways: {}, settings: { lockdown: '0' } };
    fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const data = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { tempVoices: {}, tickets: {}, giveaways: {}, settings: { lockdown: '0' } };
  }
}

function saveDb(data: DatabaseSchema) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

export const db = {
  getTempVoice(channelId: string) {
    const d = loadDb();
    return d.tempVoices[channelId];
  },
  setTempVoice(channelId: string, ownerId: string, locked: number) {
    const d = loadDb();
    d.tempVoices[channelId] = { ownerId, locked };
    saveDb(d);
  },
  updateTempVoiceLock(channelId: string, locked: number) {
    const d = loadDb();
    if (d.tempVoices[channelId]) {
      d.tempVoices[channelId].locked = locked;
      saveDb(d);
    }
  },
  updateTempVoiceOwner(channelId: string, ownerId: string) {
    const d = loadDb();
    if (d.tempVoices[channelId]) {
      d.tempVoices[channelId].ownerId = ownerId;
      saveDb(d);
    }
  },
  deleteTempVoice(channelId: string) {
    const d = loadDb();
    delete d.tempVoices[channelId];
    saveDb(d);
  },
  getAllTempVoices() {
    const d = loadDb();
    return Object.entries(d.tempVoices).map(([channel_id, v]) => ({ channel_id, ...v }));
  },

  getTicket(channelId: string) {
    const d = loadDb();
    return d.tickets[channelId];
  },
  getTicketByOwner(ownerId: string) {
    const d = loadDb();
    return Object.entries(d.tickets).find(([_, t]) => t.ownerId === ownerId);
  },
  setTicket(channelId: string, ownerId: string, claimedBy: string | null, subject: string) {
    const d = loadDb();
    d.tickets[channelId] = { ownerId, claimedBy, subject };
    saveDb(d);
  },
  claimTicket(channelId: string, claimedBy: string) {
    const d = loadDb();
    if (d.tickets[channelId]) {
      d.tickets[channelId].claimedBy = claimedBy;
      saveDb(d);
    }
  },
  deleteTicket(channelId: string) {
    const d = loadDb();
    delete d.tickets[channelId];
    saveDb(d);
  },

  getSetting(key: string): string {
    const d = loadDb();
    return d.settings[key] || '0';
  },
  setSetting(key: string, value: string) {
    const d = loadDb();
    d.settings[key] = value;
    saveDb(d);
  },

  saveGiveaway(msgId: string, channelId: string, prize: string, winnersCount: number, endTime: number) {
    const d = loadDb();
    d.giveaways[msgId] = { channelId, prize, winnersCount, endTime, participants: [], ended: false };
    saveDb(d);
  },
  getGiveaway(msgId: string) {
    const d = loadDb();
    return d.giveaways[msgId];
  },
  toggleGiveawayParticipant(msgId: string, userId: string): { participants: string[]; joined: boolean } {
    const d = loadDb();
    const gw = d.giveaways[msgId];
    if (!gw) return { participants: [], joined: false };
    const index = gw.participants.indexOf(userId);
    let joined = false;
    if (index > -1) {
      gw.participants.splice(index, 1);
    } else {
      gw.participants.push(userId);
      joined = true;
    }
    saveDb(d);
    return { participants: gw.participants, joined };
  },
  getExpiredGiveaways(now: number) {
    const d = loadDb();
    return Object.entries(d.giveaways)
      .filter(([_, gw]) => !gw.ended && gw.endTime <= now)
      .map(([message_id, gw]) => ({ message_id, ...gw }));
  },
  endGiveaway(msgId: string) {
    const d = loadDb();
    if (d.giveaways[msgId]) {
      d.giveaways[msgId].ended = true;
      saveDb(d);
    }
  }
};