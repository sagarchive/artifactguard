import {defineField, defineType} from 'sanity';
export default defineType({
  name: 'emissionObservation',
  title: 'Emission Observation',
  type: 'document',
  fields: [
    defineField({
      name: 'revision',
      type: 'reference',
      to: [{type: 'productRevision'}],
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'compound',
      type: 'reference',
      to: [{type: 'compound'}],
      validation: (r) => r.required(),
    }),
    defineField({name: 'method', type: 'string'}),
    defineField({name: 'observedEffect', type: 'text'}),
    defineField({name: 'evidenceClass', type: 'string'}),
    defineField({
      name: 'sources',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'source'}]}],
    }),
  ],
});
