import mongoose from 'mongoose';

const WhiteboardSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    title: { type: String, required: true, trim: true },
    shareCode: { type: String, unique: true, sparse: true },
    collaborators: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      role: { type: String, enum: ['editor', 'viewer'], default: 'editor' },
      joinedAt: { type: Date, default: Date.now }
    }],
    canvasData: { type: Array, default: [] },
    version: { type: Number, default: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.workspace_id = ret.workspaceId?.toString();
        ret.project_id = ret.projectId ? ret.projectId.toString() : null;
        ret.share_code = ret.shareCode;
        ret.canvas_data = ret.canvasData;
        ret.created_by = ret.createdBy?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export default mongoose.model('Whiteboard', WhiteboardSchema);
