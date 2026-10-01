import {defineField, defineType} from 'sanity';
export default defineType({
  name: 'testProtocol',
  title: 'Test Protocol',
  type: 'document',
  fields: [
    defineField({name: 'name', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'temperatureC', type: 'number'}),
    defineField({name: 'durationDays', type: 'number'}),
    defineField({name: 'sampleMassG', type: 'number'}),
    defineField({name: 'vesselType', type: 'string'}),
    defineField({name: 'vesselVolumeMl', type: 'number'}),
    defineField({name: 'waterVolumeMl', type: 'number'}),
    defineField({name: 'stopper', type: 'string'}),
    defineField({name: 'couponAbrasion', type: 'string'}),
    defineField({name: 'glasswareCleaning', type: 'text'}),
    defineField({name: 'standardized', type: 'boolean'}),
    defineField({name: 'notes', type: 'text'}),
    defineField({
      name: 'sources',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'source'}]}],
    }),
  ],
});
