export interface NetworkState {
  position: [number, number, number];
  rotation: [number, number, number];
  car: {
    position: [number, number, number];
    rotation: [number, number, number];
  } | null;
}

export interface RemotePlayer {
  playerId: string;
  /** Phase 38: display name (server-sanitised; absent when talking
   * to a pre-Phase-38 server, which never sends one). Presentation
   * only — identity is the playerId. */
  name?: string;
  state?: NetworkState;
}

export interface ChatLine {
  playerId: string;
  name: string;
  text: string;
}

type Message =
  | { type: "joined"; roomId: string; playerId: string; name?: string; players: RemotePlayer[] }
  | { type: "player_joined"; playerId: string; name?: string }
  | { type: "player_left"; playerId: string }
  | { type: "state"; playerId: string; state: NetworkState }
  | { type: "chat"; playerId: string; name: string; text: string }
  | { type: "error"; message: string }
  | { type: "event"; playerId: string; event: string; data: Record<string, unknown> };

export class Multiplayer {
  private socket: WebSocket | null = null;
  private readonly playerId = crypto.randomUUID();

  constructor(
    private readonly onPlayers: (players: RemotePlayer[]) => void,
    private readonly onStatus: (status: string) => void,
    private readonly onChat?: (line: ChatLine) => void,
  ) {}

  connect(url: string, roomId: string, name = "Rayan"): void {
    let socketUrl: URL;
    try {
      socketUrl = new URL(url, window.location.href);
      if (socketUrl.protocol === "http:") socketUrl.protocol = "ws:";
      if (socketUrl.protocol === "https:") socketUrl.protocol = "wss:";
      if (socketUrl.protocol !== "ws:" && socketUrl.protocol !== "wss:") {
        throw new Error("The multiplayer URL must use ws:// or wss://.");
      }
      if (!socketUrl.pathname.endsWith("/ws")) {
        socketUrl.pathname = `${socketUrl.pathname.replace(/\/$/, "")}/ws`;
      }
      this.socket = new WebSocket(socketUrl);
    } catch (error) {
      this.onStatus(`Connection failed: ${String(error)}`);
      return;
    }
    const socket = this.socket;
    const players = new Map<string, RemotePlayer>();
    this.onStatus("Connecting");
    socket.addEventListener("open", () => {
      this.onStatus(`Joining ${roomId}`);
      // Phase 38: roomId is the Phase 26 field (an old server reads
      // only it); "room" is the new room-code field (a new server
      // prefers it). Same value in both — and the display name rides
      // along for the server to sanitise and relay.
      socket.send(JSON.stringify({ type: "join", roomId, room: roomId, playerId: this.playerId, name }));
    });
    socket.addEventListener("message", (event: MessageEvent<string>) => {
      let message: Message;
      try {
        message = JSON.parse(event.data) as Message;
      } catch {
        this.onStatus("Received invalid server data");
        return;
      }
      if (message.type === "joined") {
        players.clear();
        for (const player of message.players) players.set(player.playerId, player);
        this.onStatus(`Connected to ${message.roomId}`);
        this.publish(players);
      } else if (message.type === "player_joined") {
        players.set(message.playerId, { playerId: message.playerId, name: message.name });
        this.publish(players);
      } else if (message.type === "player_left") {
        players.delete(message.playerId);
        this.publish(players);
      } else if (message.type === "state") {
        // a state packet carries no name — keep the one from the join
        const prev = players.get(message.playerId);
        players.set(message.playerId, { playerId: message.playerId, name: prev?.name, state: message.state });
        this.publish(players);
      } else if (message.type === "chat") {
        this.onChat?.({ playerId: message.playerId, name: message.name, text: message.text });
      } else if (message.type === "error") {
        this.onStatus(`Server: ${message.message}`);
      }
    });
    socket.addEventListener("close", () => {
      if (this.socket === socket) this.onStatus("Disconnected");
    });
    socket.addEventListener("error", () => {
      if (this.socket === socket) this.onStatus("Connection error");
    });
  }

  /** Phase 38: room text chat. The server validates (membership,
   * 200-char cap, 1.5 s rate limit) and relays to room peers with
   * our display name; it never echoes back, so the caller appends
   * its own line locally. Errors arrive via onStatus. */
  sendChat(text: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "chat", text }));
    }
  }

  /** Relay a gameplay event (crime / mission) to the room. Server validates + rebroadcasts. */
  sendEvent(event: string, data: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "event", event, data }));
    }
  }

  sendState(state: NetworkState): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "state", state }));
    }
  }

  disconnect(): void {
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  private publish(players: Map<string, RemotePlayer>): void {
    this.onPlayers([...players.values()]);
  }
}
