import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { connectDB } from './config/db';
import { startOrderConsumer } from './consumers/order.consumer';
import { startDriverConsumer } from './consumers/driver.consumer';
import { OrderController } from './controllers/order.controller';
import { DriverController } from './controllers/driver.controller';
import { redisCheck } from './middleware/redis.middleware';
import { wsServer } from './websocket/server';

// Connect to MongoDB
connectDB();

// Start RabbitMQ Consumers
startOrderConsumer();
startDriverConsumer();

const app = new Elysia()
  .use(swagger())
  .use(cors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  }))
  .use(redisCheck) // Enable when Redis behavior is confirmed
  .group('/orders', (app) => app
    .get('/', OrderController.getOrders)
    .get('/:id', OrderController.getById)
    .patch('/:id/status', OrderController.updateStatus)
    .get('/restaurant/:shopId', OrderController.getRestaurantOrders)
    .get('/courier/available', OrderController.getAvailableOrders)
    .get('/courier/:courierId', OrderController.getCourierOrders)
  )
  .group('/drivers', (app) => app
    .post('/availability', DriverController.setAvailability)
    .get('/:driverId/status', DriverController.getStatus)
    .get('/available', DriverController.getAvailableDrivers)
    .patch('/:id/location', DriverController.updateLocation)
  )
  .listen(process.env.PORT || 3002);

// Initialize standalone WebSocket server (separate port from HTTP)
wsServer.initialize(Number(process.env.WS_PORT) || 8080);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

// Export wsServer for use in other modules (e.g., status updates)
export { wsServer };
