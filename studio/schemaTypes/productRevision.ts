import {defineField, defineType} from 'sanity';
export default defineType({
  name: 'productRevision',
  title: 'Product Revision',
  type: 'document',
  fields: [
    defineField({
      name: 'product',
      type: 'reference',
      to: [{type: 'product'}],
      validation: (r) => r.required(),
    }),
    defineField({name: 'label', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'description', type: 'text'}),
    defineField({name: 'supplier', type: 'string'}),
    defineField({
      name: 'purchaseDate',
      type: 'string',
      description: 'As reported, e.g. 09.2021 or unknown.',
    }),
    defineField({name: 'batch', type: 'string'}),
    defineField({name: 'validFrom', type: 'date'}),
    defineField({name: 'validUntil', type: 'date'}),
    defineField({name: 'formulationIdentity', type: 'string'}),
    defineField({
      name: 'identityNote',
      type: 'text',
      description: 'Where cited sources disagree about what this revision is.',
    }),
    defineField({name: 'previousRevision', type: 'reference', to: [{type: 'productRevision'}]}),
    defineField({
      name: 'sources',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'source'}]}],
    }),
  ],
});
