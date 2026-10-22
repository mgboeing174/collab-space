import mongoose from 'mongoose';
import User from './server/models/User.js';
import Workspace from './server/models/Workspace.js';

async function listAccounts() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/collabspace');
    const users = await User.find({}, 'name email createdAt');
    
    console.log('\n========================================');
    console.log('       CollabSpace Registered Users     ');
    console.log('========================================\n');

    if (users.length === 0) {
      console.log('No registered accounts found in the database.');
    } else {
      for (const u of users) {
        const workspaces = await Workspace.find({ 'members.userId': u._id }, 'name');
        const wsNames = workspaces.map(w => w.name).join(', ') || 'None';
        console.log(`• Name:       ${u.name}`);
        console.log(`  Email:      ${u.email}`);
        console.log(`  Workspaces: ${wsNames}`);
        console.log(`  Created:    ${new Date(u.createdAt).toLocaleString()}`);
        console.log('----------------------------------------');
      }
    }
  } catch (err) {
    console.error('Error fetching accounts:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

listAccounts();
