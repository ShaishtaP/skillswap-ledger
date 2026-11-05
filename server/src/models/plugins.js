// Shared JSON shape for every model: `id` instead of `_id`, no `__v`.
export function cleanJSON(schema) {
  schema.set('toJSON', {
    virtuals: true,
    transform(_doc, ret) {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  });
}
