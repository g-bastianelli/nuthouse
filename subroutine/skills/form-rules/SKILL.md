---
name: form-rules
description: Form discipline for TypeScript — the schema is the only converter, input and output are different types, a required field is seeded blank not absent, submit is never gated on validity, and each failure names itself.
user-invocable: false
paths:
  - "**/*Form*.ts"
  - "**/*Form*.tsx"
  - "**/*Form*/**/*.ts"
  - "**/*Form*/**/*.tsx"
  - "**/*Fields.tsx"
---

# subroutine — form discipline

Apply this to a form's schema and the components that bind it. The nearest
`AGENTS.md` picks the form, validation, design-system and i18n libraries and
wins; the APIs below assume Zod >= 4.1 and React Hook Form. A schema no form
binds is out of scope.

## Convert in the schema, nowhere else

- An `<input>` holds a string: convert in a codec, never in the form library
  (`valueAsNumber`, `setValueAs`) or by hand. Two converters disagree on what
  empty means — `valueAsNumber` yields `NaN`, which `z.number()` rejects with an
  untranslated developer string.
- Split the codec: the input schema owns the shape, so `decode` stays a bare
  `Number`; the exported value schema owns the range, so `-1` is told to be
  positive instead of unreadable.
- Blank, malformed and out-of-range are three failures with three messages, and
  `abort` after blank. Use the library's format constants, never a copied regex.
- Mirror the contract's bounds: a form looser than its API turns an inline
  message into a failed request.
- Route messages through the repo i18n as thunks (`{ error: () => m.key() }`) —
  a plain string in a module-scope schema freezes the locale active at import.
- A closed option set (Select, Switch, radio) parses nothing: convert in the
  control's `onChange`.

```ts
// `abort` matters: without it a blank field fails both checks and reports
// "invalid" for a value the user never entered.
const slaveId = z.codec(
  z
    .string()
    .trim()
    .min(1, { error: errors.blank, abort: true })
    .regex(z.regexes.integer, { error: errors.invalid }),
  SlaveIdSchema, // exported: z.int().min(1).max(247), reused on stored data
  { decode: Number, encode: String },
);
```

## Input and output are different types

- Wire both into the hook (`useForm<FormInput, unknown, FormOutput>`) and name
  them by direction, not after the form.
- Form state speaks input: `watch`, `getValues`, `setValue` and `field.value`
  see the raw string. Converted values exist at submit and nowhere earlier.
- Seed an edit form through encode, field by field: encoding a whole object
  blanks the entire prefill over one unrelated invalid stored value.
- `safeParse` on a codec is the decode direction, so it rejects the very value
  the API returns. Validate stored data against the exported value schema.

## Seed a required field blank, never absent

- A schema shared by form variants marks each variant's fields optional, so
  absent is how the other variants submit. It cannot also mean "untouched".
- The binding decides which of the two an untouched field lands on, not the
  schema: a registered input seeds from the DOM as `""`, a controlled one stays
  `undefined`. Same blank field, required or optional by accident of wiring.
- Seed every required field with its empty value in the defaults, per variant,
  and reseed on a variant switch — a value left by the previous variant is still
  validated, from behind an input nothing renders.
- Do this before removing a submit gate: a controlled required field reads valid
  while empty, so the freed button throws inside the submit handler and floats
  the rejection.

## Let the submit run

- Disable submit while a submission is in flight, never on validity. An invalid
  submit is what publishes the whole error map and focuses the first offender;
  the validity flag is recomputed without writing errors, so gating on it
  removes the only remedy, on a button that announces nothing.
- Gating on dirtiness is a different rule and a legitimate one.
- Map a rejected submit back onto the field that caused it (`setError`) or a
  form-level alert. A toast that vanishes is not an error message.
