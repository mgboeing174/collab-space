import mongoose from 'mongoose';

const MemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member', 'viewer'],
    default: 'member'
  },
  joinedAt: { type: Date, default: Date.now }
});

const WorkspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    inviteCode: { type: String, required: true, unique: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [MemberSchema]
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.invite_code = ret.inviteCode;
        ret.owner_id = ret.ownerId?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

WorkspaceSchema.index({ 'members.userId': 1 });

export default mongoose.model('Workspace', WorkspaceSchema);
