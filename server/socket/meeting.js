import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import meeting from "../Modals/meeting.js";
import * as store from "./meetingStore.js";

const MEET_SECRET = process.env.MEET_SECRET || "yourtube-meet-secret";

function participantPayload(p) {
  return {
    socketId: p.socketId,
    id: p.id,
    email: p.email,
    name: p.name,
    image: p.image,
    micOn: p.micOn,
    camOn: p.camOn,
    raisedHand: p.raisedHand,
    speaking: p.speaking,
    isHost: p.isHost,
    isCohost: p.isCohost,
    quality: p.quality || "good",
    presenting: p.presenting || false,
    joinedAt: p.joinedAt,
    reconnecting: Boolean(p.ghost),
  };
}

export function initMeetingSocket(io) {
  io.on("connection", (socket) => {
    let roomId = null;
    let self = null;
    let disconnectTimer = null;

    const currentRoom = () => (roomId ? store.getRoom(roomId) : undefined);
    const canModerate = () => Boolean(self && (self.isHost || self.isCohost));

    function handleHostChange(rid) {
      const r = store.getRoom(rid);
      if (!r) return;
      if (r.participants.size === 0) {
        store.deleteRoom(rid);
        return;
      }
      const p = [...r.participants.values()][0];
      r.hostId = p.id;
      r.hostName = p.name;
      p.isHost = true;
      p.isCohost = false;
      r.coHostIds.delete(p.id);
      io.to(rid).emit("host:changed", { hostId: p.id, newHostSocketId: p.socketId });
      meeting
        .findOneAndUpdate({ roomId: rid }, { hostId: p.id, hostName: p.name })
        .catch(console.error);
    }

    function deny(reason) {
      socket.emit("meet:join-denied", { reason });
    }

    socket.on("meet:join", async (payload) => {
      try {
        const { roomId: rid, token, user, reconnectKey, micOn, camOn } =
          payload || {};
        if (!rid || !token || !user || !user.id || !user.email) {
          return deny("Invalid join payload");
        }
        let decoded;
        try {
          decoded = jwt.verify(token, MEET_SECRET);
        } catch (error) {
          return deny("Invalid or expired join token");
        }
        if (decoded.roomId !== rid || decoded.userId !== user.id) {
          return deny("Join token mismatch");
        }

        const m = await meeting.findOne({ roomId: rid });
        if (!m) return deny("Meeting not found");
        if (m.endedAt) return deny("This meeting has ended");

        let r = store.getRoom(rid);
        const existing = r && store.findParticipantByUser(rid, user.id);

        // ---- Reconnect path (network drop / browser refresh) ----
        if (existing) {
          if (existing.ghost || (reconnectKey && reconnectKey === existing.reconnectKey)) {
            existing.socketId = socket.id;
            existing.ghost = false;
            existing.reconnecting = false;
            existing.reconnectKey = reconnectKey || existing.reconnectKey;
            if (micOn !== undefined) existing.micOn = Boolean(micOn);
            if (camOn !== undefined) existing.camOn = Boolean(camOn);
            self = existing;
            roomId = rid;
            if (disconnectTimer) {
              clearTimeout(disconnectTimer);
              disconnectTimer = null;
            }
            socket.join(rid);
            const all = store.listParticipants(rid);
            socket.emit("meet:reconnected", {
              roomId: rid,
              self: participantPayload(existing),
              participants: all
                .filter((p) => p.socketId !== socket.id)
                .map(participantPayload),
              hostId: r.hostId,
              coHostIds: [...r.coHostIds],
              permissions: r.permissions,
              locked: r.locked,
              chat: r.chat,
            });
            io.to(rid).emit("meet:participant-status", {
              socketId: socket.id,
              id: user.id,
              reconnecting: false,
            });
            return;
          }
        }

        // ---- New participant path ----
        if (!r) {
          const isDbHost = String(m.hostId) === user.id;
          r = store.createRoom(rid, {
            id: isDbHost ? user.id : String(m.hostId),
            name: m.hostName || m.hostId,
          });
          r.locked = Boolean(m.locked);
        }

        if (existing) {
          return deny("You are already in this meeting on another tab");
        }

        if (r.locked && String(m.hostId) !== user.id && !r.coHostIds.has(user.id)) {
          return deny("This meeting is locked");
        }

        if (store.getActiveCount(rid, user.id) >= store.MAX_PARTICIPANTS) {
          return deny(`This meeting is full (max ${store.MAX_PARTICIPANTS} participants)`);
        }

        const isHost = String(r.hostId) === user.id;
        self = {
          socketId: socket.id,
          id: user.id,
          email: user.email,
          name: user.name || user.email,
          image: user.image || "",
          micOn: micOn !== undefined ? Boolean(micOn) : true,
          camOn: camOn !== undefined ? Boolean(camOn) : true,
          raisedHand: false,
          speaking: false,
          isHost,
          isCohost: r.coHostIds.has(user.id),
          quality: "good",
          presenting: false,
          joinedAt: Date.now(),
          reconnectKey: reconnectKey || null,
          ghost: false,
        };
        roomId = rid;
        socket.join(rid);
        store.addParticipant(rid, self);

        socket.emit("meet:joined", {
          roomId: rid,
          self: participantPayload(self),
          participants: store
            .listParticipants(rid)
            .filter((p) => p.socketId !== socket.id)
            .map(participantPayload),
          hostId: r.hostId,
          coHostIds: [...r.coHostIds],
          permissions: r.permissions,
          locked: r.locked,
          chat: r.chat,
        });
        socket.to(rid).emit("meet:participant-joined", participantPayload(self));
      } catch (error) {
        console.error("meet:join error", error);
        return deny("Server error");
      }
    });

    // ---------- WebRTC signaling relay (full-mesh P2P) ----------
    const relay = (event, data) => {
      const r = currentRoom();
      if (!r || !data || !data.to) return;
      const target = r.participants.get(data.to);
      if (!target || target.ghost) return;
      io.to(target.socketId).emit(event, { from: self.socketId, ...data });
    };

    socket.on("rtc:offer", (data) => relay("rtc:offer", data));
    socket.on("rtc:answer", (data) => relay("rtc:answer", data));
    socket.on("rtc:ice", (data) => relay("rtc:ice", data));

    // ---------- Media / presence state ----------
    socket.on("media:state", ({ micOn, camOn }) => {
      if (!roomId || !self) return;
      store.updateParticipant(roomId, self.socketId, {
        micOn: Boolean(micOn),
        camOn: Boolean(camOn),
      });
      socket.to(roomId).emit("media:state", {
        socketId: self.socketId,
        id: self.id,
        micOn: Boolean(micOn),
        camOn: Boolean(camOn),
      });
    });

    socket.on("speaking", ({ speaking }) => {
      if (!roomId || !self) return;
      const r = currentRoom();
      if (!r) return;
      const p = r.participants.get(self.socketId);
      if (!p || p.speaking === Boolean(speaking)) return;
      p.speaking = Boolean(speaking);
      socket.to(roomId).emit("speaking", {
        socketId: self.socketId,
        id: self.id,
        speaking: p.speaking,
      });
    });

    socket.on("hand:raise", ({ raised }) => {
      if (!roomId || !self) return;
      const r = currentRoom();
      if (!r) return;
      const p = r.participants.get(self.socketId);
      if (!p || p.raisedHand === Boolean(raised)) return;
      p.raisedHand = Boolean(raised);
      socket.to(roomId).emit("hand:raise", {
        socketId: self.socketId,
        id: self.id,
        raised: p.raisedHand,
      });
    });

    socket.on("quality", ({ quality }) => {
      if (!roomId || !self) return;
      const r = currentRoom();
      if (!r) return;
      const p = r.participants.get(self.socketId);
      const q = ["excellent", "good", "poor"].includes(quality) ? quality : "good";
      if (!p || p.quality === q) return;
      p.quality = q;
      socket.to(roomId).emit("quality", {
        socketId: self.socketId,
        id: self.id,
        quality: q,
      });
    });

    socket.on("screen:state", ({ on }) => {
      if (!roomId || !self) return;
      store.updateParticipant(roomId, self.socketId, { presenting: Boolean(on) });
      socket.to(roomId).emit("screen:state", {
        socketId: self.socketId,
        id: self.id,
        presenting: Boolean(on),
      });
    });

    // ---------- In-call chat ----------
    socket.on("chat:message", (msg) => {
      const r = currentRoom();
      if (!r || !self) return;
      if (!r.permissions.canChat && !self.isHost && !self.isCohost) {
        return socket.emit("chat:denied");
      }
      const text = String(msg.text || "").trim().slice(0, 2000);
      if (!text) return;
      const message = {
        id: msg.id || `${self.socketId}-${Date.now()}`,
        type: "text",
        text,
        sender: { id: self.id, name: self.name, image: self.image },
        ts: msg.ts || Date.now(),
      };
      r.chat.push(message);
      if (r.chat.length > store.CHAT_LIMIT) r.chat.splice(0, r.chat.length - store.CHAT_LIMIT);
      io.to(roomId).emit("chat:message", message);
    });

    socket.on("chat:file", (msg) => {
      const r = currentRoom();
      if (!r || !self) return;
      if (!r.permissions.canChat && !self.isHost && !self.isCohost) {
        return socket.emit("chat:denied");
      }
      const message = {
        id: msg.id || `${self.socketId}-${Date.now()}`,
        type: "file",
        url: String(msg.url || "").slice(0, 500),
        name: String(msg.name || "file").slice(0, 200),
        size: Number(msg.size) || 0,
        fileType: String(msg.fileType || "").slice(0, 100),
        sender: { id: self.id, name: self.name, image: self.image },
        ts: msg.ts || Date.now(),
      };
      if (!message.url) return;
      r.chat.push(message);
      if (r.chat.length > store.CHAT_LIMIT) r.chat.splice(0, r.chat.length - store.CHAT_LIMIT);
      io.to(roomId).emit("chat:file", message);
    });

    // ---------- Host moderation ----------
    socket.on("mod:set-mic", ({ targetId, on }) => {
      const r = currentRoom();
      if (!r || !canModerate()) return;
      const target =
        r.participants.get(targetId) || store.findParticipantByUser(roomId, targetId);
      if (!target || target.socketId === self.socketId) return;
      target.micOn = Boolean(on);
      io.to(target.socketId).emit("media:force-mic", { on: Boolean(on) });
      io.to(roomId).emit("media:state", {
        socketId: target.socketId,
        id: target.id,
        micOn: target.micOn,
        camOn: target.camOn,
      });
    });

    socket.on("mod:remove", ({ targetId }) => {
      const r = currentRoom();
      if (!r || !canModerate()) return;
      const target =
        r.participants.get(targetId) || store.findParticipantByUser(roomId, targetId);
      if (!target || target.isHost || target.socketId === self.socketId) return;
      io.to(target.socketId).emit("meet:removed", {
        reason: "You were removed from the meeting by the host",
      });
      store.removeParticipant(roomId, target.socketId);
      io.to(roomId).emit("meet:participant-left", {
        socketId: target.socketId,
        id: target.id,
        removed: true,
      });
      const targetSocket = io.sockets.sockets.get(target.socketId);
      if (targetSocket) targetSocket.disconnect(true);
    });

    socket.on("mod:lock", ({ locked }) => {
      if (!canModerate()) return;
      const r = currentRoom();
      if (!r) return;
      r.locked = Boolean(locked);
      meeting
        .findOneAndUpdate({ roomId }, { locked: Boolean(locked) })
        .catch(console.error);
      io.to(roomId).emit("meet:locked", { locked: Boolean(locked) });
    });

    socket.on("mod:cohost", ({ targetId, isCohost }) => {
      if (!self || !self.isHost) return;
      const r = currentRoom();
      if (!r) return;
      const target = store.findParticipantByUser(roomId, targetId);
      if (!target || target.isHost) return;
      if (isCohost) r.coHostIds.add(targetId);
      else r.coHostIds.delete(targetId);
      target.isCohost = Boolean(isCohost);
      io.to(roomId).emit("role:changed", {
        socketId: target.socketId,
        id: target.id,
        isCohost: target.isCohost,
        hostId: r.hostId,
      });
    });

    socket.on("mod:permissions", ({ canShareScreen, canChat }) => {
      if (!self || !self.isHost) return;
      const r = currentRoom();
      if (!r) return;
      r.permissions = {
        canShareScreen: Boolean(canShareScreen),
        canChat: Boolean(canChat),
      };
      io.to(roomId).emit("meet:permissions", r.permissions);
    });

    socket.on("mod:end", async () => {
      if (!self || !self.isHost) return;
      const r = currentRoom();
      if (!r) return;
      io.to(roomId).emit("meet:ended", { reason: "The host ended the meeting" });
      await meeting.findOneAndUpdate({ roomId }, { endedAt: new Date() }).catch(console.error);
      const sockets = await io.in(roomId).fetchSockets();
      sockets.forEach((s) => s.disconnect(true));
      store.deleteRoom(roomId);
    });

    // ---------- Leave / disconnect ----------
    socket.on("meet:leave", () => {
      const rid = roomId;
      const p = self;
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
      if (rid && p) {
        const r = store.getRoom(rid);
        if (r) {
          const cur = r.participants.get(p.socketId);
          if (cur) {
            r.participants.delete(p.socketId);
            io.to(rid).emit("meet:participant-left", { socketId: p.socketId, id: p.id });
            if (cur.isHost) handleHostChange(rid);
            if (r.participants.size === 0) store.deleteRoom(rid);
          }
        }
      }
      self = null;
      roomId = null;
      socket.disconnect(true);
    });

    socket.on("disconnect", () => {
      if (!roomId || !self) return;
      const r = currentRoom();
      if (!r) return;
      const p = r.participants.get(self.socketId);
      // Participant was re-adopted by a reconnecting socket -> nothing to do.
      if (!p || p.socketId !== socket.id) return;
      p.ghost = true;
      p.reconnecting = true;
      io.to(roomId).emit("meet:participant-status", {
        socketId: socket.id,
        id: p.id,
        reconnecting: true,
      });
      disconnectTimer = setTimeout(() => {
        const cur = r.participants.get(socket.id);
        if (!cur || !cur.ghost) return;
        r.participants.delete(socket.id);
        io.to(roomId).emit("meet:participant-left", { socketId: socket.id, id: cur.id });
        if (cur.isHost) handleHostChange(roomId);
        if (r.participants.size === 0) store.deleteRoom(roomId);
      }, store.RECONNECT_GRACE_MS);
    });
  });
}

export default initMeetingSocket;
