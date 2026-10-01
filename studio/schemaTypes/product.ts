import {defineField, defineType} from 'sanity';
export default defineType({
  name: 'product',
  title: 'Product / Material',
  type: 'document',
  fields: [
    defineField({name: 'name', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'manufacturer', type: 'string'}),
    defineField({name: 'category', type: 'string'}),
    defineField({name: 'description', type: 'text'}),
    defineField({name: 'aliases', type: 'array', of: [{type: 'string'}]}),
    defineField({
      name: 'sources',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'source'}]}],
    }),
  ],
});
