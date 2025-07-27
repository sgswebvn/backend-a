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
    comparePassword(password: string): Promise<boolean>;
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
            default: 'user'
        },
        facebookToken: String,
        facebookId: String,
        packageId: {
            type: Schema.Types.ObjectId,
            ref: 'Package'
        },
        packageExpiry: Date
    },
    {
        timestamps: true
    }
);

// Encrypt password
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare password
userSchema.methods.comparePassword = async function (enteredPassword: string) {
    return await bcrypt.compare(enteredPassword, this.password);
};

export const User = model<IUser>('User', userSchema);
