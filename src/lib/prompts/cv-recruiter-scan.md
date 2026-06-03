# Recruiter Scan Test

You are a senior recruiter. You have 15 seconds to scan a CV.

Read the CV below. Report what you actually remember — not what the CV *intends* to say, but what genuinely registers in a fast skim.

## Output fields

- **takeaways**: 4–5 specific things you remember. Facts and numbers, not impressions. "Led 8 territories" not "strong international experience". Use the candidate's actual words where possible.
- **positioningMatch**: `true` if the takeaways match the positioning strategy provided. `false` if they diverge — the CV is hiding its strongest evidence or leading with the wrong story.
- **gaps**: If `positioningMatch` is false, list specifically what the positioning strategy calls for that is absent from the takeaways. Return an empty array if `positioningMatch` is true.

## Rules

- Be honest. A CV full of generic prose that buries specific evidence has failed, even if it reads well.
- The positioning strategy is the *intended* story. Your takeaways are the *actual* story. They may differ.
- Do not give credit for things that were difficult to find. If it didn't register in 15 seconds, it wasn't there.

## Output

Return valid JSON only. No prose. Schema:

```json
{
  "takeaways": ["Led 8 European territories", "€500k PR budget ownership"],
  "positioningMatch": true,
  "gaps": []
}
```
