import mongoose from "mongoose";
import { z } from "zod";

export const User = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["superadmin", "admin", "manager", "user"]),
  plan: z.enum(["free", "plus", "pro"]),
});

export const Plan = z.object({
  id: z.string().optional(),
  name: z.enum(["free", "plus", "pro"]),
  description: z.string().optional(),
  price: z.number().positive(),
});


const UserMongooseSchema = new mongoose.Schema({
    name: { type: String},
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
     role: {
        type: String,
        enum: ["superadmin", "admin", "manager", "user"],
        required: true,
    },
    plan: { type: String, enum: ["free", "plus", "pro"], required: true },
});

const PlanMongooseSchema = new mongoose.Schema({
    name: { type: String, enum: ["free", "plus", "pro"], required: true },
    description: { type: String, required: false },
    price: { type: Number, required: true },
});

// Mongoose models
export const UserModel = mongoose.models.User || mongoose.model('User', UserMongooseSchema);
export const PlanModel = mongoose.models.Plan || mongoose.model('Plan', PlanMongooseSchema);

export type User = z.infer<typeof User>;
export type Plan = z.infer<typeof Plan>;