import mongoose, { Schema, Document } from 'mongoose';

export interface IDriver extends Document {
    driverId: string;
    isAvailable: boolean;
    currentLocation?: {
        latitude: number;
        longitude: number;
        timestamp: Date;
    };
    lastLocationUpdate?: Date;
    currentOrderId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const DriverSchema: Schema = new Schema({
    driverId: { type: String, required: true, unique: true },
    isAvailable: { type: Boolean, default: false },
    currentOrderId: { type: String },
    currentLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
        timestamp: { type: Date }
    },
    lastLocationUpdate: { type: Date }
}, { timestamps: true });

export const Driver = mongoose.model<IDriver>('Driver', DriverSchema);
