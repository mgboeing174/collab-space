import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import User from '../models/User.js';

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/collabspace');
  const workspaces = await Workspace.find().populate('members.userId', 'name email');
  console.log('Workspaces count:', workspaces.length);
  for (const w of workspaces) {
    console.log({
      id: w._id.toString(),
      name: w.name,
      inviteCode: w.inviteCode,
      members: w.members.map(m => ({ email: m.userId?.email, role: m.role }))
    });
  }
  await mongoose.disconnect();
}

check().catch(console.error);
