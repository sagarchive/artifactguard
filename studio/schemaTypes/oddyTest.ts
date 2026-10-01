import {defineField, defineType} from 'sanity';
const rating = ['P', 'T', 'U'];
const coupon = (name: string) => defineField({name, type: 'string', options: {list: rating}});
export default defineType({
  name: 'oddyTest',
  title: 'Oddy Test',
  type: 'document',
  fields: [
    defineField({
      name: 'revision',
      type: 'reference',
      to: [{type: 'productRevision'}],
      validation: (r) => r.required(),
    }),
    defineField({name: 'testDate', type: 'date'}),
    defineField({name: 'institution', type: 'string'}),
    defineField({
      name: 'corrosionProducts',
      type: 'string',
      description: 'As reported, e.g. identified by Raman spectroscopy.',
    }),
    defineField({name: 'notes', type: 'text'}),
    defineField({name: 'protocol', type: 'reference', to: [{type: 'testProtocol'}]}),
    coupon('silverResult'),
    coupon('copperResult'),
    coupon('leadResult'),
    defineField({
      name: 'overallResult',
      type: 'string',
      options: {list: rating},
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'evidenceClass',
      type: 'string',
      options: {list: ['real-source', 'synthetic-rule']},
    }),
    defineField({
      name: 'sources',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'source'}]}],
    }),
    defineField({
      name: 'basisSources',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'source'}]}],
    }),
  ],
});
