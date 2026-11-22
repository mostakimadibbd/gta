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
  state?: NetworkState;
}

type Message =
  | { type: "joined"; roomId: string; playerId: string; players: RemotePlayer[] }
  | { type: "player_joined"; playerId: string }
  | { type: "player_left"; playerId: string }
  | { type: "state"; playerId: string; state: NetworkState }
  | { type: "error"; message: string };

export class Multiplayer {
  private socket: WebSocket | null = null;
  private readonly playerId = crypto.randomUUID();

  constructor(
    private readonly onPlayers: (players: RemotePlayer[]) => void,
    private readonly onStatus: (status: string) => void,
  ) {}

  connect(url: string, roomId: string): void {
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
      socket.send(JSON.stringify({ type: "join", roomId, playerId: this.playerId }));
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
        players.set(message.playerId, { playerId: message.playerId });
        this.publish(players);
      } else if (message.type === "player_left") {
        players.delete(message.playerId);
        this.publish(players);
      } else if (message.type === "state") {
        players.set(message.playerId, { playerId: message.playerId, state: message.state });
        this.publish(players);
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
