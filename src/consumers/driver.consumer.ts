import * as amqplib from 'amqplib';
import { Driver } from '../models/driver.model';

export async function startDriverConsumer() {
    try {
        const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
        const connection = await amqplib.connect(url);
        const channel = await connection.createChannel();

        await channel.assertQueue('drivers', { durable: true });
        console.log('🐰 Waiting for driver events');

        channel.consume('drivers', async (msg: amqplib.ConsumeMessage | null) => {
            if (msg) {
                const content = JSON.parse(msg.content.toString());
                console.log('📦 Received driver event:', content);

                if (content.event === 'driver.created') {
                    try {
                        // Check if driver already exists
                        const existingDriver = await Driver.findOne({ driverId: content.data.driverId });

                        if (!existingDriver) {
                            const driver = new Driver({
                                driverId: content.data.driverId,
                                isAvailable: false, // Default to unavailable
                                createdAt: new Date(content.data.createdAt)
                            });

                            await driver.save();
                            console.log(`✅ Driver created: ${driver.driverId}`);
                        } else {
                            console.log(`⚠️ Driver already exists: ${content.data.driverId}`);
                        }

                        channel.ack(msg);
                    } catch (error) {
                        console.error('Error processing driver event:', error);
                        channel.nack(msg, false, false); // Don't requeue on error
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error starting driver consumer:', error);
    }
}
