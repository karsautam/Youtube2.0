export const MAX_PARTICIPANTS = Number(process.env.MEET_MAX_PARTICIPANTS) || 8;
export const RECONNECT_GRACE_MS = Number(process.env.MEET_RECONNECT_GRACE_MS) || 45000;
export const CHAT_LIMIT = 200;

const rooms = new Map();

export function createRoom(roomId, host) {
  const room = {
    roomId,
    hostId: host.id,
    hostName: host.name,
    participants: new Map(),
    coHostIds: new Set(),
    locked: false,
    permissions: { canShareScreen: true, canChat: true },
    chat: [],
  };
  rooms.set(roomId, room);
  return room;
}

export function getRoom(roomId) {
  return rooms.get(roomId);
}

export function getActiveCount(roomId, excludeUserId) {
  const room = rooms.get(roomId);
  if (!room) return 0;
  let count = 0;
  for (const p of room.participants.values()) {
    if (!p.ghost && p.id !== excludeUserId) count += 1;
  }
  return count;
}

export function addParticipant(roomId, participant) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.participants.set(participant.socketId, participant);
  return room;
}

export function getParticipant(roomId, socketId) {
  const room = rooms.get(roomId);
  return room ? room.participants.get(socketId) : undefined;
}

export function findParticipantByUser(roomId, userId) {
  const room = rooms.get(roomId);
  if (!room) return undefined;
  for (const p of room.participants.values()) {
    if (p.id === userId) return p;
  }
  return undefined;
}

export function updateParticipant(roomId, socketId, patch) {
  const room = rooms.get(roomId);
  const p = room && room.participants.get(socketId);
  if (p) Object.assign(p, patch);
  return p;
}

export function removeParticipant(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return undefined;
  const p = room.participants.get(socketId);
  room.participants.delete(socketId);
  return p;
}

export function listParticipants(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return [...room.participants.values()];
}

export function broadcastRoom(room, io, event, payload) {
  io.to(room.roomId).emit(event, payload);
}

export function deleteRoom(roomId) {
  rooms.delete(roomId);
}
