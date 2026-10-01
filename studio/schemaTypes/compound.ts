import {defineField, defineType} from 'sanity';
export default defineType({
  name: 'compound',
  title: 'Compound / Emission Class',
  type: 'document',
  fields: [
    defineField({name: 'name', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'classes', type: 'array', of: [{type: 'string'}]}),
    defineField({
      name: 'affectsArtifactMaterials',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'artifactMaterial'}]}],
    }),
    defineField({name: 'notes', type: 'text'}),
    defineField({
      name: 'sources',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'source'}]}],
    }),
  ],
});
