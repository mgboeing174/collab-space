import mongoose from 'mongoose';
import User from '../models/User.js';

async function update() {
  await mongoose.connect('mongodb://127.0.0.1:27017/collabspace');
  const res = await User.updateMany(
    { $or: [{ avatarIcon: { $exists: false } }, { avatarIcon: null }] },
    { $set: { avatarIcon: 'user' } }
  );
  console.log('Updated user records:', res);
  await mongoose.disconnect();
}

update().catch(console.error);
