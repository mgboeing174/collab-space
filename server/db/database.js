import mongoose from 'mongoose';
import Activity from '../models/Activity.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/collabspace';

export async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`>>> Connected to MongoDB database successfully: ${mongoose.connection.name}`);
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

export async function logActivity({ workspaceId, userId, userName, action, entityType, entityId, entityTitle, details = '' }) {
  try {
    const act = await Activity.create({
      workspaceId,
      userId,
      userName,
      action,
      entityType,
      entityId: entityId ? entityId.toString() : '',
      entityTitle,
      details
    });
    return act;
  } catch (err) {
    console.error('Error logging activity:', err);
    return null;
  }
}

export default mongoose;
