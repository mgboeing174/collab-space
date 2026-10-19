import mongoose from 'mongoose';

const DocumentVersionSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    versionNumber: { type: Number, required: true },
    title: { type: String, required: true },
    sectionsSnapshot: { type: Array, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
    summary: { type: String, default: '' }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.document_id = ret.documentId?.toString();
        ret.version_number = ret.versionNumber;
        ret.created_by_name = ret.createdByName;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export default mongoose.model('DocumentVersion', DocumentVersionSchema);
