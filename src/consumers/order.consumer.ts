import * as amqplib from 'amqplib';
import { Order } from '../models/order.model';
import { calculateDistance, estimateDeliveryTime } from '../utils/distance';

// Import WebSocket server (will be initialized after server starts)
let wsServer: any = null;
setTimeout(async () => {
    const module = await import('../index');
    wsServer = module.wsServer;
}, 1000);

async function fetchShopAddress(shopId: string) {
    try {
        const SHOP_API_URL = process.env.SHOP_API_URL || 'http://localhost:3001';
        const response = await fetch(`${SHOP_API_URL}/shops/${shopId}`);
        if (!response.ok) {
            console.error('Failed to fetch shop details');
            return null;
        }
        const shop = await response.json();
        return {
            street: shop.address || 'Unknown',
            city: shop.city || 'Rouen',
            zipCode: shop.zipCode || '76000',
            coordinates: shop.coordinates || { latitude: 49.4432, longitude: 1.0993 } // Rouen coords
        };
    } catch (error) {
        console.error('Error fetching shop address:', error);
        return null;
    }
}

export async function startOrderConsumer() {
    try {
        const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
        const connection = await amqplib.connect(url);
        const channel = await connection.createChannel();

        await channel.assertQueue('orders', { durable: true });
        console.log('🐰 Waiting for messages in orders');

        channel.consume('orders', async (msg: amqplib.ConsumeMessage | null) => {
            if (msg) {
                const content = JSON.parse(msg.content.toString());
                console.log('📦 Received order event:', content);

                if (content.event === 'order.created') {
                    try {
                        // Get shop address from the event (no need to fetch)
                        const pickupAddress = content.data.shopAddress;
                        if (!pickupAddress) {
                            console.error('Shop address missing in event data');
                            throw new Error('Shop address is required');
                        }

                        const deliveryAddress = content.data.deliveryAddress;
                        if (!deliveryAddress) {
                            console.error('Delivery address missing in event data');
                            throw new Error('Delivery address is required');
                        }

                        // Geocode addresses if they don't have coordinates
                        if (!pickupAddress.coordinates) {
                            console.log('🌍 Geocoding pickup address...');
                            const { geocodeAddress } = await import('../services/geocoding.service');
                            const coords = await geocodeAddress({
                                street: pickupAddress.street,
                                city: pickupAddress.city,
                                zipCode: pickupAddress.zipCode
                            });
                            if (coords) {
                                pickupAddress.coordinates = coords;
                            }
                        }

                        if (!deliveryAddress.coordinates) {
                            console.log('🌍 Geocoding delivery address...');
                            const { geocodeAddress } = await import('../services/geocoding.service');
                            const coords = await geocodeAddress({
                                street: deliveryAddress.street,
                                city: deliveryAddress.city,
                                zipCode: deliveryAddress.zipCode
                            });
                            if (coords) {
                                deliveryAddress.coordinates = coords;
                            }
                        }

                        // Calculate distance if both have coordinates
                        let distance, estimatedTime;
                        if (pickupAddress.coordinates && deliveryAddress.coordinates) {
                            distance = calculateDistance(
                                pickupAddress.coordinates.latitude,
                                pickupAddress.coordinates.longitude,
                                deliveryAddress.coordinates.latitude,
                                deliveryAddress.coordinates.longitude
                            );
                            estimatedTime = estimateDeliveryTime(distance);
                        }

                        // Generate random 4-digit delivery code
                        const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();

                        const order = new Order({
                            menuId: content.data.menuId,
                            shopId: content.data.shopId,
                            customerId: content.data.customerId,
                            items: content.data.items,
                            pickupAddress,
                            deliveryAddress,
                            distance,
                            estimatedDeliveryTime: estimatedTime,
                            deliveryCode,
                            status: 'pending',
                            createdAt: new Date(content.data.createdAt)
                        });

                        await order.save();
                        console.log('✅ Order saved to database:', order._id);
                        console.log(`📍 Pickup: ${pickupAddress.street}, ${pickupAddress.city}`);
                        console.log(`📍 Delivery: ${deliveryAddress.street}, ${deliveryAddress.city}`);
                        if (distance) console.log(`📏 Distance: ${distance} km, ETA: ${estimatedTime} min`);
                        console.log(`🔐 Delivery code: ${deliveryCode}`);

                        // Notify shop via WebSocket
                        if (wsServer) {
                            wsServer.notifyRole('shop', {
                                type: 'order.created',
                                order: order.toJSON()
                            });
                            console.log(`📤 Notified shop ${order.shopId} of new order`);
                        }

                        channel.ack(msg);
                    } catch (error) {
                        console.error('Error processing order:', error);
                        channel.nack(msg, false, false); // Don't requeue on error
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error starting order consumer:', error);
    }
}
