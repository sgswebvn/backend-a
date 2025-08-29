import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    _id: Schema.Types.ObjectId;
    email: string;
    password: string;
    name: string;
    role: 'user' | 'admin';
    facebookToken?: string;
    facebookId?: string;
    facebookName?: string;
    facebookEmail?: string;
    facebookAvatar?: string;
    packageId?: Schema.Types.ObjectId;
    packageExpiry?: Date;
    updatedAt: Date;
    comparePassword(password: string): Promise<boolean>;
    notificationPreferences?: { types: ('message' | 'comment' | 'payment' | 'package_expiry')[] };
}

const userSchema = new Schema<IUser>(
    {
        email: {
            type: String,
            required: [true, 'Please add an email'],
            unique: true,
            match: [/\S+@\S+\.\S+/, 'Please add a valid email']
        },
        password: {
            type: String,
            required: [true, 'Please add a password'],
            minlength: 6,
            select: false
        },
        name: {
            type: String,
            required: [true, 'Please add a name']
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
            required: true
        },
        facebookToken: String,
        facebookId: String,
        packageId: {
            type: Schema.Types.ObjectId,
            ref: 'Package'
        },
        packageExpiry: Date,
        notificationPreferences: {
            types: [{
                type: String,
                enum: ['message', 'comment', 'payment', 'package_expiry'],
                default: ['message', 'comment', 'payment', 'package_expiry']
            }]
        }
    },
    {
        timestamps: true
    }
);

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        console.log('Hashing password for:', this.email);
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        console.log('Password hashed successfully');
        next();
    } catch (error: any) {
        console.error('Password hashing error:', error);
        next(error);
    }
});

userSchema.methods.comparePassword = async function (enteredPassword: string) {
    return await bcrypt.compare(enteredPassword, this.password);
};

export const User = model<IUser>('User', userSchema);