# Numeric text inputs

Read this before binding an `<input>` whose submitted value is numeric.

Use one schema codec. Never combine it with `valueAsNumber`, `setValueAs`, or
manual conversion: competing converters disagree on blank input and can leak `NaN` into
an untranslated developer error.

The input schema owns textual shape, while the exported value schema owns numeric range.
Keep `decode` as bare `Number` so a value such as `-1` reaches the range rule and receives
the correct message. Treat blank, malformed, and out-of-range as separate failures; abort
after blank and use the validation library's format constants instead of copied regexes.

```ts
const slaveId = z.codec(
  z
    .string()
    .trim()
    .min(1, { error: errors.blank, abort: true })
    .regex(z.regexes.integer, { error: errors.invalid }),
  SlaveIdSchema,
  { decode: Number, encode: String },
);
```

Here `SlaveIdSchema` is the exported value contract, for example
`z.int().min(1).max(247)`, and is reused when validating stored values.
