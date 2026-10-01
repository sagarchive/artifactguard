import {defineField, defineType} from 'sanity';
export default defineType({
  name: 'source',
  title: 'Source',
  type: 'document',
  fields: [
    defineField({name: 'title', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'publisher', type: 'string'}),
    defineField({name: 'url', type: 'url', validation: (r) => r.required()}),
    defineField({name: 'authority', type: 'string'}),
    defineField({name: 'reviewed', type: 'date'}),
  ],
});
