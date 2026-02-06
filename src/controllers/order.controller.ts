import { Context } from 'elysia';
import { Order } from '../models/order.model';

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['prepared', 'cancelled'],
    'prepared': ['picked_up', 'cancelled'],
    'picked_up': ['delivered', 'cancelled'],
    'delivered': [],
    'cancelled': []
};

// Import WebSocket server (will be initialized after server starts)
let wsServer: any = null;
setTimeout(async () => {
    const module = await import('../index');
    wsServer = module.wsServer;
}, 1000);

export const OrderController = {
    getOrders: async ({ query, set }: Context) => {
        try {
            const { role, userId } = query;

            let filter: any = {};

            if (role === 'shop' && userId) {
                filter.shopId = userId;
            } else if (role === 'customer' && userId) {
                filter.customerId = userId;
            } else if (role === 'courier' && userId) {
                filter.courierId = userId;
            }

            const orders = await Order.find(filter).sort({ createdAt: -1 });
            return orders.map((order) => order.toJSON());
        } catch (error) {
            console.error('Error in getOrders:', error);
            set.status = 500;
            return { message: 'Error fetching orders', error: String(error) };
        }
    },

    getById: async ({ params: { id }, set }: Context) => {
        try {
            const order = await Order.findById(id);
            if (!order) {
                set.status = 404;
                return { message: 'Order not found' };
            }
            return order.toJSON();
        } catch (error) {
            console.error('Error in getById:', error);
            set.status = 500;
            return { message: 'Error fetching order', error: String(error) };
        }
    },

    updateStatus: async ({ params: { id }, body, set }: Context) => {
        try {
            console.log('updateStatus called with:', { id, body });
            const { status, courierId, deliveryCode } = body as {
                status: string;
                courierId?: string;
                deliveryCode?: string;
            };

            const order = await Order.findById(id);
            if (!order) {
                console.log('Order not found:', id);
                set.status = 404;
                return { message: 'Order not found' };
            }

            console.log('Updating order status from', order.status, 'to', status);

            // Validate delivery code when marking as delivered
            if (status === 'delivered') {
                if (!deliveryCode) {
                    set.status = 400;
                    return { message: 'Delivery code is required to complete delivery' };
                }
                if (deliveryCode !== order.deliveryCode) {
                    set.status = 400;
                    return { message: 'Invalid delivery code' };
                }
                order.deliveredAt = new Date();
            }

            // Update status
            order.status = status as any;
            if (courierId) {
                order.courierId = courierId;
                order.assignedAt = new Date();
            }

            await order.save();
            console.log('Order saved successfully');

            // Notify couriers via WebSocket when order is prepared
            if (status === 'prepared' && wsServer) {
                // Try to auto-assign to an available driver
                const { Driver } = await import('../models/driver.model');
                const availableDriver = await Driver.findOne({
                    isAvailable: true,
                    currentOrderId: { $exists: false }
                }).sort({ lastLocationUpdate: -1 });

                if (availableDriver) {
                    // Notify specific driver
                    wsServer.notifyRole('courier', {
                        type: 'order.available',
                        order: order.toJSON(),
                        targetDriverId: availableDriver.driverId
                    });
                    console.log(`📤 Auto-assigned order to driver ${availableDriver.driverId}`);
                } else {
                    // Broadcast to all couriers
                    wsServer.notifyRole('courier', {
                        type: 'order.prepared',
                        order: order.toJSON()
                    });
                }
            }

            // Notify customer via WebSocket on any status change
            if (wsServer) {
                wsServer.notifyRole('customer', {
                    type: 'order.updated',
                    order: order.toJSON()
                });
            }

            console.log('Order update completed successfully');
            return {
                message: 'Order updated successfully',
                order: order.toJSON()
            };
        } catch (error) {
            console.error('Error in updateStatus:', error);
            set.status = 500;
            return { message: 'Error updating order status', error: String(error) };
        }
    },

    getRestaurantOrders: async ({ params: { shopId }, set }: Context) => {
        try {
            const orders = await Order.find({ shopId }).sort({ createdAt: -1 });
            return orders.map((order) => order.toJSON());
        } catch (error) {
            console.error('Error in getRestaurantOrders:', error);
            set.status = 500;
            return { message: 'Error fetching restaurant orders', error: String(error) };
        }
    },

    getAvailableOrders: async ({ set }: Context) => {
        try {
            const orders = await Order.find({
                status: 'prepared',
                courierId: { $exists: false }
            }).sort({ createdAt: -1 });
            return orders.map((order) => order.toJSON());
        } catch (error) {
            console.error('Error in getAvailableOrders:', error);
            set.status = 500;
            return { message: 'Error fetching available orders', error: String(error) };
        }
    },

    getCourierOrders: async ({ params: { courierId }, set }: Context) => {
        try {
            const orders = await Order.find({ courierId }).sort({ createdAt: -1 });
            return orders.map((order) => order.toJSON());
        } catch (error) {
            console.error('Error in getCourierOrders:', error);
            set.status = 500;
            return { message: 'Error fetching courier orders', error: String(error) };
        }
    }
};
