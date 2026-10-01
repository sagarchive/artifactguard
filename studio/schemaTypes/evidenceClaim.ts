import {defineField, defineType} from 'sanity';
const evidenceTargets = [{type: 'oddyTest'}, {type: 'emissionObservation'}, {type: 'interaction'}];
export default defineType({
  name: 'evidenceClaim',
  title: 'Evidence Claim',
  type: 'document',
  fields: [
    defineField({name: 'statement', type: 'text', validation: (r) => r.required()}),
    defineField({
      name: 'status',
      type: 'string',
      options: {list: ['supported', 'challenged', 'superseded', 'conditional', 'insufficient']},
    }),
    defineField({name: 'scope', type: 'string'}),
    defineField({
      name: 'rationale',
      type: 'text',
      description: 'Why the claim has this status, in terms the cited sources support.',
    }),
    defineField({name: 'supports', type: 'array', of: [{type: 'reference', to: evidenceTargets}]}),
    defineField({
      name: 'challenges',
      type: 'array',
      of: [{type: 'reference', to: evidenceTargets}],
    }),
    defineField({
      name: 'sources',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'source'}]}],
    }),
  ],
});
