import {defineField, defineType} from 'sanity';
export default defineType({
  name: 'artifactMaterial',
  title: 'Artifact Material',
  type: 'document',
  fields: [
    defineField({name: 'name', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'sensitiveTo', type: 'array', of: [{type: 'string'}]}),
    defineField({
      name: 'couponMetal',
      type: 'string',
      options: {list: ['silver', 'copper', 'lead']},
      description:
        'The Oddy test coupon that speaks directly to this material. Leave empty for other materials.',
    }),
    defineField({name: 'notes', type: 'text'}),
    defineField({
      name: 'sources',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'source'}]}],
    }),
  ],
});
