import {defineField, defineType} from 'sanity';
export default defineType({
  name: 'interaction',
  title: 'Interaction',
  type: 'document',
  fields: [
    defineField({
      name: 'leftCompound',
      type: 'reference',
      to: [{type: 'compound'}],
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'rightClass',
      type: 'string',
      description:
        'Pollutant class the artifact must be sensitive to, or direct-contact, or any-object when the cited sources report the effect on exhibited objects generally.',
    }),
    defineField({name: 'conditions', type: 'array', of: [{type: 'string'}]}),
    defineField({name: 'effect', type: 'text'}),
    defineField({
      name: 'affectedArtifactMaterials',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'artifactMaterial'}]}],
    }),
    defineField({name: 'evidenceClass', type: 'string'}),
    defineField({
      name: 'sources',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'source'}]}],
    }),
  ],
});
