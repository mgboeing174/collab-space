import mongoose from 'mongoose';

const SectionSchema = new mongoose.Schema({
  sectionKey: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, default: '' },
  orderIndex: { type: Number, default: 0 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedName: { type: String, default: null },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lockedByName: { type: String, default: null },
  lockedAt: { type: Date, default: null },
  lockHeartbeat: { type: Date, default: null },
  version: { type: Number, default: 1 },
  updatedAt: { type: Date, default: Date.now }
});

SectionSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.section_key = ret.sectionKey;
    ret.order_index = ret.orderIndex;
    ret.assigned_to = ret.assignedTo ? ret.assignedTo.toString() : null;
    ret.assigned_name = ret.assignedName;
    ret.locked_by = ret.lockedBy ? ret.lockedBy.toString() : null;
    ret.locked_by_name = ret.lockedByName;
    ret.locked_at = ret.lockedAt ? ret.lockedAt.toISOString() : null;
    ret.lock_heartbeat = ret.lockHeartbeat ? ret.lockHeartbeat.toISOString() : null;
    delete ret._id;
    return ret;
  }
});

const DocumentSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    title: { type: String, required: true, trim: true },
    templateType: { type: String, default: 'custom' },
    version: { type: Number, default: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sections: [SectionSchema]
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.workspace_id = ret.workspaceId?.toString();
        ret.project_id = ret.projectId ? ret.projectId.toString() : null;
        ret.template_type = ret.templateType;
        ret.created_by = ret.createdBy?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export default mongoose.model('Document', DocumentSchema);
