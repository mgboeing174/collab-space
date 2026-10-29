import mongoose from 'mongoose';
import crypto from 'crypto';
import Document from '../models/Document.js';
import Whiteboard from '../models/Whiteboard.js';

async function migrate() {
  await mongoose.connect('mongodb://127.0.0.1:27017/collabspace');

  const docs = await Document.find({ $or: [{ shareCode: { $exists: false } }, { shareCode: null }] });
  for (const d of docs) {
    d.shareCode = crypto.randomBytes(6).toString('hex');
    await d.save();
  }
  console.log(`Updated ${docs.length} documents with share codes.`);

  const wbs = await Whiteboard.find({ $or: [{ shareCode: { $exists: false } }, { shareCode: null }] });
  for (const w of wbs) {
    w.shareCode = crypto.randomBytes(6).toString('hex');
    await w.save();
  }
  console.log(`Updated ${wbs.length} whiteboards with share codes.`);

  await mongoose.disconnect();
}

migrate().catch(console.error);
