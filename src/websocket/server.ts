import { WebSocket, WebSocketServer } from 'ws';

class OrderWebSocketServer {
    private wss: WebSocketServer | null = null;
    private clients: Map<string, Set<WebSocket>> = new Map(); // role -> Set of connections

    public initialize(port: number = Number(process.env.WS_PORT) || 8080) {
        // Avec Bun/Elysia, `app.server` n'est pas un `http.Server` Node.
        // On démarre donc un serveur WebSocket autonome sur son propre port.
        this.wss = new WebSocketServer({ port, path: '/ws' });

        this.wss.on('connection', (ws: WebSocket, req) => {
            console.log('🔌 WebSocket client connected');

            // Extract role from query params or headers
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const role = url.searchParams.get('role') || 'guest';

            // Add to clients map
            if (!this.clients.has(role)) {
                this.clients.set(role, new Set());
            }
            this.clients.get(role)?.add(ws);

            ws.on('message', (message: string) => {
                console.log('📩 Received:', message.toString());
            });

            ws.on('close', () => {
                console.log('🔌 WebSocket client disconnected');
                this.clients.get(role)?.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });

            // Send initial message
            ws.send(JSON.stringify({ type: 'connected', message: 'Welcome to Order API WebSocket' }));
        });

        console.log(`🌐 WebSocket server initialized on ws://localhost:${port}/ws`);
    }

    // Notify specific role (e.g., 'courier')
    public notifyRole(role: string, data: any) {
        const clients = this.clients.get(role);
        if (!clients || clients.size === 0) {
            console.log(`No WebSocket clients connected for role: ${role}`);
            return;
        }

        const message = JSON.stringify(data);
        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });

        console.log(`📤 Notified ${clients.size} clients in role: ${role}`);
    }

    // Broadcast to all connections
    public broadcast(data: any) {
        const message = JSON.stringify(data);
        this.clients.forEach((clientSet) => {
            clientSet.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        });
    }
}

export const wsServer = new OrderWebSocketServer();
