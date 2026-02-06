import { Context } from 'elysia';
import { Driver } from '../models/driver.model';
import { Order } from '../models/order.model';

// Import WebSocket server
let wsServer: any = null;
setTimeout(async () => {
    const module = await import('../index');
    wsServer = module.wsServer;
}, 1000);

export const DriverController = {
    // Toggle driver availability
    setAvailability: async ({ body, set }: Context) => {
        const { driverId, isAvailable, location } = body as {
            driverId: string;
            isAvailable: boolean;
            location?: { latitude: number; longitude: number };
        };

        try {
            let driver = await Driver.findOne({ driverId });

            if (!driver) {
                // Create new driver record
                driver = new Driver({
                    driverId,
                    isAvailable,
                    currentLocation: location ? { ...location, timestamp: new Date() } : undefined,
                    lastLocationUpdate: location ? new Date() : undefined
                });
            } else {
                // Update existing driver
                driver.isAvailable = isAvailable;
                if (location) {
                    driver.currentLocation = {
                        ...location,
                        timestamp: new Date()
                    };
                    driver.lastLocationUpdate = new Date();
                }
            }

            await driver.save();

            // If driver becomes available, try to assign pending prepared orders
            if (isAvailable) {
                await tryAssignOrder(driverId);
            }

            return {
                message: `Driver ${isAvailable ? 'available' : 'unavailable'}`,
                driver: driver.toJSON()
            };
        } catch (error) {
            set.status = 500;
            return { message: 'Error updating driver availability', error };
        }
    },

    // Get driver status
    getStatus: async ({ params: { driverId }, set }: Context) => {
        try {
            const driver = await Driver.findOne({ driverId });
            if (!driver) {
                set.status = 404;
                return { message: 'Driver not found' };
            }
            return driver.toJSON();
        } catch (error) {
            console.error('Error fetching driver status:', error);
            set.status = 500;
            return { message: 'Error fetching driver status', error: String(error) };
        }
    },

    // Update driver location and broadcast to customers
    updateLocation: async ({ params: { id }, body, set }: Context) => {
        try {
            const { latitude, longitude, orderId } = body as {
                latitude: number;
                longitude: number;
                orderId?: string;
            };

            console.log(`📍 Received location update for driver ${id}:`, { latitude, longitude, orderId });

            const driver = await Driver.findOne({ driverId: id });
            if (!driver) {
                set.status = 404;
                return { message: 'Driver not found' };
            }

            driver.currentLocation = {
                latitude,
                longitude,
                timestamp: new Date()
            };
            driver.lastLocationUpdate = new Date();
            await driver.save();

            console.log(`✅ Driver location saved to DB`);

            // Broadcast location to customer via WebSocket
            if (orderId && wsServer) {
                const locationData = {
                    type: 'delivery.location.update',
                    orderId,
                    driverLocation: { latitude, longitude }
                };
                console.log(`📡 Broadcasting location update:`, locationData);
                wsServer.notifyRole('customer', locationData);
            }

            return {
                message: 'Location updated successfully',
                location: driver.currentLocation
            };
        } catch (error: any) {
            console.error('❌ Error in updateLocation:', error);
            set.status = 500;
            return { message: 'Error updating location', error: error.message };
        }
    },

    // Get all available drivers
    getAvailableDrivers: async () => {
        try {
            const drivers = await Driver.find({ isAvailable: true }).sort({ lastLocationUpdate: -1 });
            return drivers.map((driver) => driver.toJSON());
        } catch (error) {
            return { message: 'Error fetching available drivers', error };
        }
    }
};

// Helper function to assign order to available driver
async function tryAssignOrder(driverId: string) {
    try {
        // Find prepared orders without courier
        const order = await Order.findOne({
            status: 'prepared',
            courierId: { $exists: false }
        }).sort({ createdAt: 1 }); // Oldest first

        if (order && wsServer) {
            // Notify specific driver about available order
            wsServer.notifyRole('courier', {
                type: 'order.available',
                order: order.toJSON(),
                targetDriverId: driverId
            });
            console.log(`📤 Notified driver ${driverId} about order ${order._id}`);
        }
    } catch (error) {
        console.error('Error assigning order to driver:', error);
    }
}
