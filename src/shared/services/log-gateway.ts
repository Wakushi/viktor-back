import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'https://viktor-monitor.wakushi.com'],
  },
})
export class LogGateway implements OnGatewayConnection {
  private readonly logger = new Logger(LogGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: any) {
    this.logger.log(`Client connected to websocket: ${client.id}`);
  }

  sendLog(message: string) {
    this.server.emit('log', message);
  }
}
