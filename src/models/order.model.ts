import mongoose, { Schema, Document } from 'mongoose';

interface Address {
    street: string;
    city: string;
    zipCode: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };
}

export interface IOrder extends Document {
    menuId: string;
    shopId: string;
    customerId: string;
    courierId?: string;
    items: any[];
    status: 'pending' | 'confirmed' | 'prepared' | 'picked_up' | 'delivered' | 'cancelled';
    pickupAddress: Address;
    deliveryAddress: Address;
    distance?: number; // in km
    estimatedDeliveryTime?: number; // in minutes
    deliveryCode?: string; // Code for delivery verification
    assignedAt?: Date;
    deliveredAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const AddressSchema = new Schema({
    street: { type: String, required: true },
    city: { type: String, required: true },
    zipCode: { type: String, required: true },
    coordinates: {
        latitude: { type: Number },
        longitude: { type: Number }
    }
}, { _id: false });

const OrderSchema: Schema = new Schema({
    menuId: { type: String, required: true },
    shopId: { type: String, required: true },
    customerId: { type: String, required: true },
    courierId: { type: String },
    items: { type: Array, required: true },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'prepared', 'picked_up', 'delivered', 'cancelled'],
        default: 'pending'
    },
    pickupAddress: { type: AddressSchema, required: true },
    deliveryAddress: { type: AddressSchema, required: true },
    distance: { type: Number },
    estimatedDeliveryTime: { type: Number },
    deliveryCode: { type: String }, // 4-digit code for delivery verification
    assignedAt: { type: Date },
    deliveredAt: { type: Date }
}, { timestamps: true });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
