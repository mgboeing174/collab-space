import mongoose from 'mongoose';

const ActivitySchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    entityTitle: { type: String, required: true },
    details: { type: String, default: '' }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.workspace_id = ret.workspaceId?.toString();
        ret.user_id = ret.userId?.toString();
        ret.user_name = ret.userName;
        ret.entity_type = ret.entityType;
        ret.entity_id = ret.entityId;
        ret.entity_title = ret.entityTitle;
        ret.created_at = ret.createdAt?.toISOString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

ActivitySchema.index({ workspaceId: 1, createdAt: -1 });

export default mongoose.model('Activity', ActivitySchema);
